const courseService = require('../services/course-service');
const { validateCourseBody, validateCourseId, validateCourseListQuery } = require('../validators/course-validator');

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

module.exports = { list, listMine, get, create, update, remove };
