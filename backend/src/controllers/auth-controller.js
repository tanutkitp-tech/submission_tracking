const authService = require('../services/auth-service');
const { validateLoginBody, validateTeacherRegisterBody } = require('../validators/auth-validator');
const { validatePasswordChangeBody } = require('../validators/password-validator');

async function register(req, res) {
  const account = validateTeacherRegisterBody(req.body);
  const data = await authService.register(account);
  res.status(201).json({ success: true, message: 'Teacher account created', data });
}

async function login(req, res) {
  const credentials = validateLoginBody(req.body);
  const data = await authService.login(credentials.email, credentials.password);
  res.json({ success: true, message: 'Login successful', data });
}

async function me(req, res) {
  const data = await authService.getTeacherById(req.user.id);
  res.json({ success: true, message: 'Request successful', data });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = validatePasswordChangeBody(req.body);
  const data = await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.json({ success: true, message: 'Password updated', data });
}

module.exports = { register, login, me, changePassword };
