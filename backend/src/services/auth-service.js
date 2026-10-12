const jwt = require('jsonwebtoken');
const { createHash } = require('node:crypto');
const db = require('../config/database');
const HttpError = require('../utils/http-error');
const passwordService = require('./password-service');

function createSession(teacher) {
  const publicTeacher = { id: teacher.id, full_name: teacher.full_name, email: teacher.email };
  const token = jwt.sign({ role: 'teacher', email: teacher.email }, process.env.JWT_SECRET, {
    subject: String(teacher.id), algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  return { token, teacher: publicTeacher };
}

async function register({ fullName, email, password, inviteCode }) {
  const requiresInvite = process.env.NODE_ENV === 'production' || Boolean(inviteCode);
  if (requiresInvite && !inviteCode) {
    throw new HttpError(403, 'A teacher invitation code is required');
  }
  const passwordHash = await passwordService.hashPassword(password);
  const connection = await db.getConnection();
  let teacher;
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    if (requiresInvite) {
      const inviteHash = createHash('sha256').update(inviteCode).digest();
      const [invites] = await connection.execute(
        'SELECT id, expires_at AS expiresAt, used_at AS usedAt FROM teacher_signup_invites WHERE code_hash = ? FOR UPDATE',
        [inviteHash],
      );
      const invite = invites[0];
      const now = Date.now();
      if (!invite || invite.usedAt != null || Number(invite.expiresAt) <= now) {
        throw new HttpError(403, 'Teacher invitation code is invalid or expired');
      }
      const [consumed] = await connection.execute(
        'UPDATE teacher_signup_invites SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?',
        [now, invite.id, now],
      );
      if (consumed.affectedRows !== 1) throw new HttpError(403, 'Teacher invitation code is invalid or expired');
    }
    const [result] = await connection.execute(
      'INSERT INTO teachers (full_name, email, password_hash) VALUES (?, ?, ?)',
      [fullName, email, passwordHash],
    );
    teacher = { id: result.insertId, full_name: fullName, email };
    await connection.commit();
  } catch (error) {
    if (transactionStarted) {
      try { await connection.rollback(); } catch {}
    }
    throw error;
  } finally {
    connection.release();
  }
  return createSession(teacher);
}

async function login(email, password) {
  const [rows] = await db.execute('SELECT id, full_name, email, password_hash FROM teachers WHERE email = ?', [email]);
  if (!rows.length || !(await passwordService.verifyAndUpgradeLegacyPassword('teachers', rows[0].id, password, rows[0].password_hash))) throw new HttpError(401, 'Email or password is incorrect');
  return createSession(rows[0]);
}

async function changePassword(teacherId, currentPassword, newPassword) {
  const changed = await passwordService.changePassword('teachers', teacherId, currentPassword, newPassword);
  if (!changed) throw new HttpError(400, 'Current password is incorrect');
  return { updated: true };
}

async function getTeacherById(id) {
  const [rows] = await db.execute('SELECT id, full_name, email FROM teachers WHERE id = ?', [id]);
  if (!rows.length) throw new HttpError(401, 'Account no longer exists');
  return rows[0];
}

module.exports = { register, login, getTeacherById, changePassword };
