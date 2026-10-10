const assignmentService = require('../services/assignment-service');
const { validateAssignment, validateAssignmentId, validateSubmissionParams, validateSubmissionReview, validateAssignmentListQuery } = require('../validators/assignment-validator');
const submissionService = require('../services/submission-service');

async function list(req, res) {
  const data = await assignmentService.listPublic();
  res.json({ success: true, message: 'Request successful', data });
}
async function listMine(req, res) {
  const result = await assignmentService.listMine(req.user.id, validateAssignmentListQuery(req.query));
  res.json({ success: true, message: 'Request successful', data: result.rows, pagination: result.pagination });
}
async function get(req, res) {
  const data = await assignmentService.getPublicById(validateAssignmentId(req.params));
  res.json({ success: true, message: 'Request successful', data });
}
async function create(req, res) {
  const data = await assignmentService.create(req.user.id, validateAssignment(req.body));
  res.status(201).json({ success: true, message: 'Assignment created', data });
}
async function update(req, res) {
  const data = await assignmentService.update(req.user.id, validateAssignmentId(req.params), validateAssignment(req.body));
  res.json({ success: true, message: 'Assignment updated', data });
}
async function remove(req, res) {
  await assignmentService.remove(req.user.id, validateAssignmentId(req.params));
  res.json({ success: true, message: 'Assignment deleted', data: null });
}
async function submissions(req, res) {
  const data = await assignmentService.listSubmissions(req.user.id, validateAssignmentId(req.params));
  res.json({ success: true, message: 'Request successful', data });
}
async function markReviewed(req, res) {
  const { assignmentId, studentId } = validateSubmissionParams(req.params);
  const data = await submissionService.grade(req.user.id, assignmentId, studentId, validateSubmissionReview(req.body));
  res.json({ success: true, message: 'Submission marked as reviewed', data });
}
async function downloadSubmission(req, res) {
  const { assignmentId, studentId } = validateSubmissionParams(req.params);
  const file = await submissionService.getTeacherFile(req.user.id, assignmentId, studentId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(file.path, file.name);
}

async function previewSubmission(req, res) {
  const { assignmentId, studentId } = validateSubmissionParams(req.params);
  const file = await submissionService.getTeacherPreview(req.user.id, assignmentId, studentId);
  res.set({
    'Content-Type': file.contentType,
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  res.send(file.buffer);
}

module.exports = { list, listMine, get, create, update, remove, submissions, markReviewed, downloadSubmission, previewSubmission };
