const HttpError = require('../utils/http-error');
const { text } = require('../utils/validation');

function passwordValue(value) {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) {
    throw new HttpError(400, 'Password must be at least 8 characters and no more than 72 bytes');
  }
  return value;
}

function validateStudentRegisterBody(body = {}) {
  body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  return {
    studentCode: text(body.student_code, 'student_code', 30),
    fullName: text(body.full_name, 'full_name', 150),
    password: passwordValue(body.password),
  };
}

function validateStudentLoginBody(body = {}) {
  body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  return {
    studentCode: text(body.student_code, 'student_code', 30),
    password: passwordValue(body.password),
  };
}

module.exports = { validateStudentRegisterBody, validateStudentLoginBody };
