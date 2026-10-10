const jwt = require('jsonwebtoken');
const db = require('../config/database');
const HttpError = require('../utils/http-error');
const passwordService = require('./password-service');

function createToken(student) {
  return jwt.sign(
    { role: 'student', student_code: student.student_code },
    process.env.JWT_SECRET,
    { subject: String(student.id), algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  );
}

function session(student) {
  const publicStudent = { id: student.id, student_code: student.student_code, full_name: student.full_name };
  return { token: createToken(publicStudent), student: publicStudent };
}

async function register({ studentCode, fullName, password }) {
  const passwordHash = await passwordService.hashPassword(password);
  const [result] = await db.execute(
    'INSERT INTO students (student_code, full_name, password_hash) VALUES (?, ?, ?)',
    [studentCode, fullName, passwordHash],
  );
  return session({ id: result.insertId, student_code: studentCode, full_name: fullName });
}

async function login({ studentCode, password }) {
  const [rows] = await db.execute(
    'SELECT id, student_code, full_name, password_hash FROM students WHERE student_code = ?',
    [studentCode],
  );
  if (!rows.length || !(await passwordService.verifyAndUpgradeLegacyPassword('students', rows[0].id, password, rows[0].password_hash))) {
    throw new HttpError(401, 'Student code or password is incorrect');
  }
  return session(rows[0]);
}

async function getStudentById(id) {
  const [rows] = await db.execute('SELECT id, student_code, full_name FROM students WHERE id = ?', [id]);
  if (!rows.length) throw new HttpError(401, 'Account no longer exists');
  return rows[0];
}

async function changePassword(studentId, currentPassword, newPassword) {
  const changed = await passwordService.changePassword('students', studentId, currentPassword, newPassword);
  if (!changed) throw new HttpError(400, 'Current password is incorrect');
  return { updated: true };
}

module.exports = { register, login, getStudentById, changePassword };
