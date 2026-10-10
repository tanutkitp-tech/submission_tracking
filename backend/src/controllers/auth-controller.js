const authService = require('../services/auth-service');
const { validateLoginBody } = require('../validators/auth-validator');

async function login(req, res) {
  const credentials = validateLoginBody(req.body);
  const data = await authService.login(credentials.email, credentials.password);
  res.json({ success: true, message: 'Login successful', data });
}

async function me(req, res) {
  const data = await authService.getTeacherById(req.user.id);
  res.json({ success: true, message: 'Request successful', data });
}

module.exports = { login, me };
