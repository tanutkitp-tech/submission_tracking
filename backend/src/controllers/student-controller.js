const studentService = require('../services/student-service');
const { idParam } = require('../utils/validation');
const { validateEnrollmentBody, validateCourseId } = require('../validators/student-validator');
const submissionService = require('../services/submission-service');
const { validateAssignmentId } = require('../validators/assignment-validator');

async function courses(req, res) {
  const data = await studentService.listCourses(req.student.id);
  res.json({ success: true, message: 'Request successful', data });
}

async function enroll(req, res) {
  const data = await studentService.enroll(req.student.id, validateEnrollmentBody(req.body).courseId);
  res.status(201).json({ success: true, message: 'Student enrolled in course', data });
}

async function assignments(req, res) {
  const data = await studentService.listAssignments(req.student.id);
  res.json({ success: true, message: 'Request successful', data });
}

async function assignment(req, res) {
  const assignmentId = idParam(req.params.id);
  const data = await studentService.getAssignment(req.student.id, assignmentId);
  res.json({ success: true, message: 'Request successful', data });
}

async function submitAssignment(req, res) {
  const assignmentId = validateAssignmentId(req.params);
  const data = await submissionService.submit(req.student.id, assignmentId, req.file);
  res.status(201).json({ success: true, message: 'File submitted successfully', data });
}

module.exports = { courses, enroll, assignments, assignment, submitAssignment };
