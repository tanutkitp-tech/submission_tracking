const { idParam, text, pagination } = require('../utils/validation');

function validateCourseBody(body = {}) {
  body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  return {
    courseCode: text(body.course_code, 'course_code', 30).toUpperCase(),
    courseName: text(body.course_name, 'course_name', 200),
    description: text(body.description, 'description', 65535, false),
  };
}
function validateCourseId(params) { return idParam(params.id); }
function validateCourseListQuery(query) { return pagination(query); }
module.exports = { validateCourseBody, validateCourseId, validateCourseListQuery };
