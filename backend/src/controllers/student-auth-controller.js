const studentAuthService = require('../services/student-auth-service');
const { validateStudentRegisterBody, validateStudentLoginBody } = require('../validators/student-auth-validator');
const { validatePasswordChangeBody } = require('../validators/password-validator');

async function register(req, res) {
  const data = await studentAuthService.register(validateStudentRegisterBody(req.body));
  res.status(201).json({ success: true, message: 'Student account created', data });
}

async function login(req, res) {
  const data = await studentAuthService.login(validateStudentLoginBody(req.body));
  res.json({ success: true, message: 'Login successful', data });
}

async function me(req, res) {
  const data = await studentAuthService.getStudentById(req.student.id);
  res.json({ success: true, message: 'Request successful', data });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = validatePasswordChangeBody(req.body);
  const data = await studentAuthService.changePassword(req.student.id, currentPassword, newPassword);
  res.json({ success: true, message: 'Password updated', data });
}

module.exports = { register, login, me, changePassword };
