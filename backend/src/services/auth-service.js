const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const HttpError = require('../utils/http-error');

async function login(email, password) {
  const [rows] = await db.execute('SELECT id, full_name, email, password_hash FROM teachers WHERE email = ?', [email]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) throw new HttpError(401, 'Email or password is incorrect');
  const teacher = rows[0];
  const token = jwt.sign({ role: 'teacher', email: teacher.email }, process.env.JWT_SECRET, {
    subject: String(teacher.id), algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  return { token, teacher: { id: teacher.id, full_name: teacher.full_name, email: teacher.email } };
}

async function getTeacherById(id) {
  const [rows] = await db.execute('SELECT id, full_name, email FROM teachers WHERE id = ?', [id]);
  if (!rows.length) throw new HttpError(401, 'Account no longer exists');
  return rows[0];
}

module.exports = { login, getTeacherById };
