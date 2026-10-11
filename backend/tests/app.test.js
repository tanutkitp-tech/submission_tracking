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

test('validates positive integer identifiers', () => {
  assert.equal(idParam('12'), 12);
  assert.throws(() => idParam('0'), HttpError);
  assert.throws(() => idParam('1; DROP TABLE courses'), HttpError);
});
test('validates bounded text and optional values', () => {
  assert.equal(text('  Intro  ', 'title', 20), 'Intro');
  assert.equal(text(null, 'description', 20, false), null);
  assert.throws(() => text('', 'title', 20), HttpError);
  assert.throws(() => text('x'.repeat(21), 'title', 20), HttpError);
});
test('validates date and time inputs', () => {
  assert.equal(dateTime('2026-11-30T12:00'), '2026-11-30 12:00');
  assert.equal(dateTime('2026-11-30T12:00:00Z'), '2026-11-30 19:00:00');
  assert.equal(dateTime('2026-11-30T12:00:00+07:00'), '2026-11-30 12:00:00');
  assert.equal(dateTime('2026-11-30T12:00:00-05:00'), '2026-12-01 00:00:00');
  assert.throws(() => dateTime('not-a-date'), HttpError);
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
  const item = validateAssignment({ course_id: 2, title: 'Lab 1', due_at: '2026-11-30T12:00', status: 'PUBLISHED' });
  assert.equal(item.courseId, 2);
  assert.equal(item.status, 'PUBLISHED');
  assert.equal(item.maxScore, undefined);
  assert.equal(validateAssignment({ course_id: 2, title: 'Lab', due_at: '2026-11-30T12:00', max_score: '30.50' }).maxScore, 30.5);
  assert.throws(() => validateAssignment({ course_id: 2, title: 'Lab', due_at: '2026-11-30T12:00', max_score: 0 }), HttpError);
  assert.throws(() => validateAssignment({ course_id: 2, title: 'Lab', due_at: '2026-11-30T12:00', max_score: 1000000 }), HttpError);
  assert.throws(() => validateAssignment({ course_id: 2, title: 'Lab', due_at: '2026-11-30T12:00', status: 'OPEN' }), HttpError);
  assert.throws(() => validateAssignment(null), HttpError);
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
});
