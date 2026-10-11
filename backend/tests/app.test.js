const { test } = require('node:test');
const assert = require('node:assert/strict');
const { idParam, text, dateTime, pagination } = require('../src/utils/validation');
const HttpError = require('../src/utils/http-error');
const { validateAssignment, validateSubmissionReview } = require('../src/validators/assignment-validator');
const { validateLoginBody } = require('../src/validators/auth-validator');
const { validateCourseBody } = require('../src/validators/course-validator');
const { validateStudentRegisterBody, validateStudentLoginBody } = require('../src/validators/student-auth-validator');
const { validatePasswordChangeBody } = require('../src/validators/password-validator');
const { validateEnrollmentBody, validateEnrollmentReviewBody } = require('../src/validators/student-validator');
const passwordService = require('../src/services/password-service');
const previewContentType = require('../src/utils/preview-content-type');
const { createDatabaseFacade, BANGKOK_SESSION_TIME_ZONE } = require('../src/config/database-facade');
const { isAllowedOrigin } = require('../src/utils/cors-origin');

test('validates positive integer identifiers', () => {
  assert.equal(idParam('12'), 12);
  assert.throws(() => idParam('0'), HttpError);
  assert.throws(() => idParam('9007199254740992'), HttpError);
  assert.throws(() => idParam('1; DROP TABLE courses'), HttpError);
  assert.throws(() => idParam(['1']), HttpError);
});
test('validates bounded text and optional values', () => {
  assert.equal(text('  Intro  ', 'title', 20), 'Intro');
  assert.equal(text(null, 'description', 20, false), null);
  assert.throws(() => text('', 'title', 20), HttpError);
  assert.throws(() => text('x'.repeat(21), 'title', 20), HttpError);
  assert.throws(() => text('ท'.repeat(22_000), 'description', 65_535, false, 65_535), HttpError);
});
test('validates date and time inputs', () => {
  assert.equal(dateTime('2026-11-30T12:00'), '2026-11-30 12:00');
  assert.equal(dateTime('2026-11-30T12:00:00Z'), '2026-11-30 19:00:00');
  assert.equal(dateTime('2026-11-30T12:00:00+07:00'), '2026-11-30 12:00:00');
  assert.equal(dateTime('2026-11-30T12:00:00-05:00'), '2026-12-01 00:00:00');
  assert.equal(dateTime('2026-11-30T12:00:00.000Z'), '2026-11-30 19:00:00');
  assert.equal(dateTime('2026-11-30T12:00:00.123456Z'), '2026-11-30 19:00:00');
  assert.throws(() => dateTime('not-a-date'), HttpError);
  assert.throws(() => dateTime('2026-11-30 12:00'), HttpError);
  assert.throws(() => dateTime('2026-02-30T12:00'), HttpError);
  assert.throws(() => dateTime('2026-11-30T12:00:00+15:00'), HttpError);
});

test('requires a score before marking a submission reviewed', () => {
  assert.deepEqual(validateSubmissionReview({ score: '0', remarks: '' }), { score: 0, remarks: null });
  assert.throws(() => validateSubmissionReview({}), HttpError);
  assert.throws(() => validateSubmissionReview({ score: '' }), HttpError);
  assert.throws(() => validateSubmissionReview({ score: null }), HttpError);
});

test('validates assignment course, status, title, and deadline', () => {
  const dueAt = new Date(Date.now() + 86_400_000).toISOString();
  const item = validateAssignment({ course_id: 2, title: 'Lab 1', due_at: dueAt, status: 'PUBLISHED' });
  assert.equal(item.courseId, 2);
  assert.equal(item.status, 'PUBLISHED');
  assert.equal(item.maxScore, undefined);
  assert.equal(validateAssignment({ course_id: 2, title: 'Lab', due_at: dueAt, max_score: '30.50' }).maxScore, 30.5);
  assert.equal(validateAssignment({ course_id: 2, title: 'Lab', due_at: dueAt, status: 'PUBLISHED' }).dueAt, dateTime(dueAt));
  assert.equal(validateAssignment({ course_id: 2, title: 'Lab', due_at: dueAt }).status, 'DRAFT');
  assert.equal(validateAssignment({ course_id: 2, title: 'Lab', due_at: dueAt }, { isUpdate: true }).status, undefined);
  assert.throws(() => validateAssignment({ course_id: 2, title: 'Lab', due_at: dueAt, max_score: 0 }), HttpError);
  assert.throws(() => validateAssignment({ course_id: 2, title: 'Lab', due_at: dueAt, max_score: 1000000 }), HttpError);
  assert.throws(() => validateAssignment({ course_id: 2, title: 'Lab', due_at: dueAt, status: '' }), HttpError);
  assert.throws(() => validateAssignment({ course_id: 2, title: 'Lab', due_at: dueAt, status: 'OPEN' }), HttpError);
  assert.throws(() => validateAssignment({ course_id: 2, title: 'Lab', due_at: dueAt, made_up: true }), HttpError);
  assert.throws(() => validateAssignment({ course_id: 2, title: 'Lab', due_at: new Date(Date.now() - 60_000).toISOString() }), HttpError);
  const overdueDueAt = '2020-01-02T12:30';
  assert.equal(
    validateAssignment({ course_id: 2, title: 'Edited lab', due_at: overdueDueAt, status: 'CLOSED' }, { isUpdate: true }).dueAt,
    '2020-01-02 12:30',
  );
  assert.throws(() => validateAssignment(null), HttpError);
});

test('allows closing an overdue assignment without changing its deadline', async () => {
  const db = require('../src/config/database');
  const assignmentService = require('../src/services/assignment-service');
  const originalGetConnection = db.getConnection;
  let updateParameters;
  let committed = false;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { committed = true; },
    rollback: async () => {},
    release: () => {},
    execute: async (sql, parameters) => {
      if (sql.startsWith('SELECT a.id,a.course_id,a.max_score,a.status')) {
        return [[{ id: 9, course_id: 2, max_score: 100, status: 'PUBLISHED' }]];
      }
      if (sql.startsWith('SELECT id FROM courses')) return [[{ id: parameters[0] }]];
      if (sql.startsWith('UPDATE assignments')) {
        updateParameters = parameters;
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  db.getConnection = async () => connection;
  try {
    const item = validateAssignment({
      course_id: 2,
      title: 'Closed overdue lab',
      due_at: '2020-01-02T12:30',
      max_score: 120,
      status: 'CLOSED',
    }, { isUpdate: true });
    const result = await assignmentService.update(4, 9, item);
    assert.equal(result.title, 'Closed overdue lab');
    assert.equal(result.due_at, '2020-01-02 12:30');
    assert.equal(result.max_score, 120);
    assert.equal(result.status, 'CLOSED');
    assert.equal(updateParameters[3], '2020-01-02 12:30');
    assert.equal(updateParameters[5], 'CLOSED');
    assert.equal(committed, true);
  } finally {
    db.getConnection = originalGetConnection;
  }
});

test('shows overdue published assignments to students but excludes closed assignments', async () => {
  const db = require('../src/config/database');
  const studentService = require('../src/services/student-service');
  const originalExecute = db.execute;
  let assignmentQuery;
  const overduePublished = { id: 12, due_at: '2020-01-02 12:30:00', assignment_status: 'PUBLISHED' };
  db.execute = async (sql) => {
    assignmentQuery = sql;
    return [[overduePublished]];
  };
  try {
    const rows = await studentService.listAssignments(6);
    assert.deepEqual(rows, [overduePublished]);
    assert.match(assignmentQuery, /a\.status\s*=\s*'PUBLISHED'/);
    assert.doesNotMatch(assignmentQuery, /due_at\s*>\s*CURRENT_TIMESTAMP/i);
  } finally {
    db.execute = originalExecute;
  }
});

test('rejects file submissions after deadline and removes the staged file', async () => {
  const db = require('../src/config/database');
  const submissionService = require('../src/services/submission-service');
  const files = require('../src/services/submission-files');
  const originalGetConnection = db.getConnection;
  const originalStore = files.store;
  const originalRemove = files.remove;
  let rolledBack = false;
  let eligibilityQuery;
  const removedKeys = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => { rolledBack = true; },
    release: () => {},
    execute: async (sql) => {
      eligibilityQuery = sql;
      return [[{ id: 12, due_at: '2020-01-02 12:30:00', deadline_passed: 1 }]];
    },
  };
  db.getConnection = async () => connection;
  files.store = async () => 'temporary-test-key';
  files.remove = async (key) => { removedKeys.push(key); };
  try {
    await assert.rejects(
      submissionService.submit(6, 12, { originalname: 'test.txt', buffer: Buffer.from('test'), mimetype: 'text/plain', size: 4 }),
      (error) => error.status === 409 && error.message === 'Submission deadline has passed',
    );
    assert.match(eligibilityQuery, /a\.due_at\s*<=\s*CURRENT_TIMESTAMP/i);
    assert.equal(rolledBack, true);
    assert.deepEqual(removedKeys, ['temporary-test-key']);
  } finally {
    db.getConnection = originalGetConnection;
    files.store = originalStore;
    files.remove = originalRemove;
  }
});

test('preserves assignment status on PUT when omitted', async () => {
  const db = require('../src/config/database');
  const assignmentService = require('../src/services/assignment-service');
  const originalGetConnection = db.getConnection;
  let updateParameters;
  let committed = false;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { committed = true; },
    rollback: async () => {},
    release: () => {},
    execute: async (sql, parameters) => {
      if (sql.startsWith('SELECT a.id,a.course_id,a.max_score,a.status')) {
        return [[{ id: 9, course_id: 2, max_score: 100, status: 'PUBLISHED' }]];
      }
      if (sql.startsWith('SELECT id FROM courses')) return [[{ id: parameters[0] }]];
      if (sql.startsWith('UPDATE assignments')) {
        updateParameters = parameters;
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  db.getConnection = async () => connection;
  try {
    const dueAt = new Date(Date.now() + 86_400_000).toISOString();
    const item = validateAssignment({ course_id: 2, title: 'Updated title', due_at: dueAt }, { isUpdate: true });
    const result = await assignmentService.update(4, 9, item);
    assert.equal(result.status, 'PUBLISHED');
    assert.equal(updateParameters[5], 'PUBLISHED');
    assert.equal(committed, true);
  } finally {
    db.getConnection = originalGetConnection;
  }
});

test('rejects moving an assignment after a submission exists', async () => {
  const db = require('../src/config/database');
  const assignmentService = require('../src/services/assignment-service');
  const originalGetConnection = db.getConnection;
  let updateCalled = false;
  let rolledBack = false;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => { rolledBack = true; },
    release: () => {},
    execute: async (sql, parameters) => {
      if (sql.startsWith('SELECT a.id,a.course_id,a.max_score,a.status')) {
        return [[{ id: 9, course_id: 2, max_score: 100, status: 'PUBLISHED' }]];
      }
      if (sql.startsWith('SELECT id FROM courses')) return [[{ id: parameters[0] }]];
      if (sql.startsWith('SELECT COUNT(*) AS submissions')) return [[{ submissions: 1 }]];
      if (sql.startsWith('UPDATE assignments')) updateCalled = true;
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  db.getConnection = async () => connection;
  try {
    const dueAt = new Date(Date.now() + 86_400_000).toISOString();
    const item = validateAssignment({ course_id: 3, title: 'Moved title', due_at: dueAt }, { isUpdate: true });
    await assert.rejects(assignmentService.update(4, 9, item), (error) => error.status === 409);
    assert.equal(updateCalled, false);
    assert.equal(rolledBack, true);
  } finally {
    db.getConnection = originalGetConnection;
  }
});

test('limits inline file previews to signatures of supported file formats', () => {
  assert.equal(previewContentType(Buffer.from('%PDF-1.7')), 'application/pdf');
  assert.equal(previewContentType(Buffer.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg');
  assert.equal(previewContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(previewContentType(Buffer.from('GIF89a')), 'image/gif');
  assert.equal(previewContentType(Buffer.from('RIFFxxxxWEBP')), 'image/webp');
  assert.equal(previewContentType(Buffer.from('<svg></svg>')), null);
  assert.equal(previewContentType(Buffer.from('<html>unsafe</html>')), null);
});

test('validates auth and course request bodies', () => {
  assert.deepEqual(validateLoginBody({ email: ' Teacher@Example.com ', password: 'secret' }), { email: 'teacher@example.com', password: 'secret' });
  assert.throws(() => validateLoginBody({ email: 'bad', password: 'x' }), HttpError);
  assert.deepEqual(validateCourseBody({ course_code: ' cs101 ', course_name: 'Intro' }), { courseCode: 'CS101', courseName: 'Intro', description: null });
  assert.throws(() => validateCourseBody(null), HttpError);
});

test('validates student registration and login credentials', () => {
  assert.deepEqual(validateStudentRegisterBody({ student_code: ' 66001 ', full_name: 'Student Example', password: 'long-pass-123' }), {
    studentCode: '66001', fullName: 'Student Example', password: 'long-pass-123',
  });
  assert.deepEqual(validateStudentLoginBody({ student_code: '66001', password: 'long-pass-123' }), {
    studentCode: '66001', password: 'long-pass-123',
  });
  assert.throws(() => validateStudentRegisterBody({ student_code: '66001', full_name: 'Student', password: 'short' }), HttpError);
  assert.throws(() => validateStudentRegisterBody({ student_code: '66001', full_name: 'Student', password: 'x'.repeat(73) }), HttpError);
});

test('validates enrollment requests and teacher decisions', () => {
  assert.deepEqual(validateEnrollmentBody({ course_id: '4' }), { courseId: 4 });
  assert.deepEqual(validateEnrollmentReviewBody({ status: 'APPROVED' }), { status: 'APPROVED' });
  assert.deepEqual(validateEnrollmentReviewBody({ status: 'REJECTED' }), { status: 'REJECTED' });
  assert.throws(() => validateEnrollmentReviewBody({ status: 'PENDING' }), HttpError);
  assert.throws(() => validateEnrollmentReviewBody({ status: 'anything' }), HttpError);
});

test('validates password changes and verifies stored hashes without exposing passwords', async () => {
  assert.deepEqual(validatePasswordChangeBody({ current_password: 'current-pass', new_password: 'new-pass-123' }), {
    currentPassword: 'current-pass', newPassword: 'new-pass-123',
  });
  assert.throws(() => validatePasswordChangeBody({ current_password: 'same-pass-123', new_password: 'same-pass-123' }), HttpError);
  assert.throws(() => validatePasswordChangeBody({ current_password: 'current-pass', new_password: 'short' }), HttpError);
  assert.equal(await passwordService.verifyStoredPassword('legacy-pass', 'legacy-pass'), true);
  const hash = await passwordService.hashPassword('hashed-pass-123');
  assert.equal(passwordService.isBcryptHash(hash), true);
  assert.equal(await passwordService.verifyStoredPassword('hashed-pass-123', hash), true);
  assert.equal(await passwordService.verifyStoredPassword('wrong-pass', hash), false);
});

test('validates pagination bounds and calculates offsets', () => {
  assert.deepEqual(pagination({ page: '3', limit: '10' }), { page: 3, limit: 10, offset: 20 });
  assert.throws(() => pagination({ page: '0' }), HttpError);
  assert.throws(() => pagination({ limit: '101' }), HttpError);
  assert.throws(() => pagination({ page: '1e2' }), HttpError);
  assert.throws(() => pagination({ page: ['2'] }), HttpError);
  assert.throws(() => pagination({ page: '1', offset: '20' }), HttpError);
});

test('rejects request fields that are outside each API contract', () => {
  assert.throws(() => validateLoginBody({ email: 'teacher@example.com', password: 'x', role: 'student' }), HttpError);
  assert.throws(() => validateCourseBody({ course_code: 'CS101', course_name: 'Intro', teacher_id: 2 }), HttpError);
  assert.throws(() => validateStudentRegisterBody({ student_code: '66001', full_name: 'Student', password: 'long-pass-123', id: 1 }), HttpError);
  assert.throws(() => validateStudentLoginBody({ student_code: '66001', password: 'long-pass-123', full_name: 'Other' }), HttpError);
  assert.throws(() => validateEnrollmentBody({ course_id: 4, student_id: 2 }), HttpError);
  assert.throws(() => validateEnrollmentReviewBody({ status: 'APPROVED', student_id: 2 }), HttpError);
  assert.throws(() => validatePasswordChangeBody({ current_password: 'current-pass', new_password: 'new-pass-123', id: 1 }), HttpError);
});

test('sets Bangkok timezone for every pooled database connection', async () => {
  const calls = [];
  const connection = {
    query: async (sql) => { calls.push(sql); },
    execute: async (sql) => { calls.push(sql); return [[], []]; },
    release: () => calls.push('release'),
  };
  const facade = createDatabaseFacade({ getConnection: async () => connection, end: async () => {} });
  await facade.execute('SELECT CURRENT_TIMESTAMP');
  assert.deepEqual(calls, [BANGKOK_SESSION_TIME_ZONE, 'SELECT CURRENT_TIMESTAMP', 'release']);
  calls.length = 0;
  const transactionConnection = await facade.getConnection();
  assert.equal(transactionConnection, connection);
  assert.deepEqual(calls, [BANGKOK_SESSION_TIME_ZONE]);
});

test('allows local Vite fallback ports only outside production', () => {
  assert.equal(isAllowedOrigin('http://localhost:5174', ['http://localhost:5173'], false), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5173', [], false), true);
  assert.equal(isAllowedOrigin('http://localhost:5175', [], false), false);
  assert.equal(isAllowedOrigin('http://localhost:5174', ['https://tester.example'], true), false);
  assert.equal(isAllowedOrigin('https://tester.example', ['https://tester.example'], true), true);
});

test('grades a submission transactionally and keeps score within the locked assignment maximum', async () => {
  const db = require('../src/config/database');
  const submissionService = require('../src/services/submission-service');
  const originalGetConnection = db.getConnection;
  const calls = [];
  let committed = false;
  let rolledBack = false;
  const resultRow = { assignment_id: 9, student_id: 6, status: 'REVIEWED', score: '84.50', remarks: 'Good' };
  const connection = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => { committed = true; },
    rollback: async () => { rolledBack = true; },
    release: () => calls.push('release'),
    execute: async (sql) => {
      calls.push(sql);
      if (sql.startsWith('SELECT a.id, a.max_score')) return [[{ id: 9, max_score: '100.00' }]];
      if (sql.startsWith('SELECT id, score, remarks')) return [[{ id: 3, score: null, remarks: null }]];
      if (sql.startsWith('UPDATE submissions')) return [{ affectedRows: 1 }];
      if (sql.startsWith('SELECT assignment_id, student_id, status')) return [[resultRow]];
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  db.getConnection = async () => connection;
  try {
    const result = await submissionService.grade(4, 9, 6, { score: 84.5, remarks: 'Good' });
    assert.deepEqual(result, resultRow);
    assert.equal(committed, true);
    assert.equal(rolledBack, false);
    assert.ok(calls.some((sql) => typeof sql === 'string' && sql.includes('FOR UPDATE')));
  } finally {
    db.getConnection = originalGetConnection;
  }
});
