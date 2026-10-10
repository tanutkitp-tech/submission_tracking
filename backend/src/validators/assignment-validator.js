const { idParam, text, dateTime, fail, pagination } = require('../utils/validation');
const statuses = ['DRAFT', 'PUBLISHED', 'CLOSED'];

function validateAssignment(body) {
  body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const courseId = idParam(body.course_id);
  const title = text(body.title, 'title', 200);
  const description = text(body.description, 'description', 65535, false);
  const dueAt = dateTime(body.due_at);
  const status = body.status || 'DRAFT';
  if (!statuses.includes(status)) fail('Invalid assignment status');
  return { courseId, title, description, dueAt, status };
}

function validateAssignmentId(params) { return idParam(params.id); }
function validateSubmissionParams(params) {
  return { assignmentId: idParam(params.id), studentId: idParam(params.studentId) };
}
function validateAssignmentListQuery(query) { return pagination(query); }

module.exports = { validateAssignment, validateAssignmentId, validateSubmissionParams, validateAssignmentListQuery };
