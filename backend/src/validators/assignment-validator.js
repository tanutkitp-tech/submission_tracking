const { idParam, text, dateTime, fail, pagination } = require('../utils/validation');
const statuses = ['DRAFT', 'PUBLISHED', 'CLOSED'];

function validateAssignment(body) {
  body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const courseId = idParam(body.course_id);
  const title = text(body.title, 'title', 200);
  const description = text(body.description, 'description', 65535, false);
  const dueAt = dateTime(body.due_at);
  if (Date.parse(`${dueAt.replace(' ', 'T')}+07:00`) <= Date.now()) {
    fail('due_at must be in the future');
  }
  const status = body.status || 'DRAFT';
  if (!statuses.includes(status)) fail('Invalid assignment status');
  let maxScore;
  if (Object.hasOwn(body, 'max_score')) {
    const rawScore = String(body.max_score);
    maxScore = Number(rawScore);
    if (!/^\d+(?:\.\d{1,2})?$/.test(rawScore) || !Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 999999.99) {
      fail('max_score must be a positive number with up to two decimal places');
    }
  }
  return { courseId, title, description, dueAt, status, maxScore };
}

function validateAssignmentId(params) { return idParam(params.id); }
function validateSubmissionParams(params) {
  return { assignmentId: idParam(params.id), studentId: idParam(params.studentId) };
}
function validateSubmissionReview(body = {}) {
  body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const result = {};
  if (!Object.hasOwn(body, 'score') || body.score == null || body.score === '') {
    fail('Score is required to mark submission as reviewed');
  }
  const rawScore = String(body.score);
  const score = Number(rawScore);
  if (!/^\d+(?:\.\d{1,2})?$/.test(rawScore) || !Number.isFinite(score) || score > 999999.99) {
    fail('Score must be a non-negative number with up to two decimal places');
  }
  result.score = score;
  if (Object.hasOwn(body, 'remarks')) result.remarks = text(body.remarks, 'remarks', 500, false);
  return result;
}
function validateAssignmentListQuery(query) { return pagination(query); }

module.exports = { validateAssignment, validateAssignmentId, validateSubmissionParams, validateSubmissionReview, validateAssignmentListQuery };
