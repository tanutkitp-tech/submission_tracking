const { idParam, text, pagination, objectBody } = require('../utils/validation');

function validateCourseBody(body = {}) {
  body = objectBody(body, ['course_code', 'course_name', 'description'], 'course');
  return {
    courseCode: text(body.course_code, 'course_code', 30).toUpperCase(),
    courseName: text(body.course_name, 'course_name', 200),
    description: text(body.description, 'description', 65535, false, 65535),
  };
}
function validateCourseId(params) { return idParam(params.id); }
function validateCourseListQuery(query) { return pagination(query); }
module.exports = { validateCourseBody, validateCourseId, validateCourseListQuery };
