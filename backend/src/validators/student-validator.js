const { idParam } = require('../utils/validation');
const HttpError = require('../utils/http-error');

function validateEnrollmentBody(body = {}) {
  body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  return { courseId: idParam(body.course_id) };
}

function validateEnrollmentReviewBody(body = {}) {
  body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const status = body.status;
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new HttpError(400, 'Enrollment status must be APPROVED or REJECTED');
  }
  return { status };
}

module.exports = { validateEnrollmentBody, validateEnrollmentReviewBody };
