const { idParam, objectBody } = require('../utils/validation');
const HttpError = require('../utils/http-error');

function validateEnrollmentBody(body = {}) {
  body = objectBody(body, ['course_id'], 'enrollment');
  return { courseId: idParam(body.course_id) };
}

function validateEnrollmentReviewBody(body = {}) {
  body = objectBody(body, ['status'], 'enrollment review');
  const status = body.status;
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new HttpError(400, 'Enrollment status must be APPROVED or REJECTED');
  }
  return { status };
}

module.exports = { validateEnrollmentBody, validateEnrollmentReviewBody };
