const { test } = require('node:test');
const assert = require('node:assert/strict');
const { idParam, text, dateTime, pagination } = require('../src/utils/validation');
const HttpError = require('../src/utils/http-error');
const { validateAssignment } = require('../src/validators/assignment-validator');
const { validateLoginBody } = require('../src/validators/auth-validator');
const { validateCourseBody } = require('../src/validators/course-validator');

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
  assert.throws(() => dateTime('not-a-date'), HttpError);
  assert.throws(() => dateTime('2026-02-30T12:00'), HttpError);
});

test('validates assignment course, status, title, and deadline', () => {
  const item = validateAssignment({ course_id: 2, title: 'Lab 1', due_at: '2026-11-30T12:00', status: 'PUBLISHED' });
  assert.equal(item.courseId, 2);
  assert.equal(item.status, 'PUBLISHED');
  assert.throws(() => validateAssignment({ course_id: 2, title: 'Lab', due_at: '2026-11-30T12:00', status: 'OPEN' }), HttpError);
  assert.throws(() => validateAssignment(null), HttpError);
});

test('validates auth and course request bodies', () => {
  assert.deepEqual(validateLoginBody({ email: ' Teacher@Example.com ', password: 'secret' }), { email: 'teacher@example.com', password: 'secret' });
  assert.throws(() => validateLoginBody({ email: 'bad', password: 'x' }), HttpError);
  assert.deepEqual(validateCourseBody({ course_code: ' cs101 ', course_name: 'Intro' }), { courseCode: 'CS101', courseName: 'Intro', description: null });
  assert.throws(() => validateCourseBody(null), HttpError);
});

test('validates pagination bounds and calculates offsets', () => {
  assert.deepEqual(pagination({ page: '3', limit: '10' }), { page: 3, limit: 10, offset: 20 });
  assert.throws(() => pagination({ page: '0' }), HttpError);
  assert.throws(() => pagination({ limit: '101' }), HttpError);
});
