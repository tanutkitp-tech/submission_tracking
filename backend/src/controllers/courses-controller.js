const courseService = require('../services/course-service');
const enrollmentService = require('../services/enrollment-service');
const { validateCourseBody, validateCourseId, validateCourseListQuery } = require('../validators/course-validator');
const { validateEnrollmentReviewBody } = require('../validators/student-validator');
const { idParam } = require('../utils/validation');

async function list(req, res) {
  const data = await courseService.listPublic();
  res.json({ success: true, message: 'Request successful', data });
}
async function listMine(req, res) {
  const result = await courseService.listMine(req.user.id, validateCourseListQuery(req.query));
  res.json({ success: true, message: 'Request successful', data: result.rows, pagination: result.pagination });
}
async function get(req, res) {
  const data = await courseService.getById(validateCourseId(req.params));
  res.json({ success: true, message: 'Request successful', data });
}
async function create(req, res) {
  const data = await courseService.create(req.user.id, validateCourseBody(req.body));
  res.status(201).json({ success: true, message: 'Course created', data });
}
async function update(req, res) {
  const data = await courseService.update(req.user.id, validateCourseId(req.params), validateCourseBody(req.body));
  res.json({ success: true, message: 'Course updated', data });
}
async function remove(req, res) {
  await courseService.remove(req.user.id, validateCourseId(req.params));
  res.json({ success: true, message: 'Course deleted', data: null });
}

async function listEnrollments(req, res) {
  const data = await enrollmentService.listMine(req.user.id);
  res.json({ success: true, message: 'Request successful', data });
}

async function reviewEnrollment(req, res) {
  const courseId = validateCourseId(req.params);
  const studentId = idParam(req.params.studentId);
  const { status } = validateEnrollmentReviewBody(req.body);
  const data = await enrollmentService.review(req.user.id, courseId, studentId, status);
  res.json({ success: true, message: 'Enrollment request reviewed', data });
}

module.exports = { list, listMine, get, create, update, remove, listEnrollments, reviewEnrollment };
