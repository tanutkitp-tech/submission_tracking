const bcrypt = require('bcryptjs');
const db = require('../config/database');

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function verifyStoredPassword(password, storedValue) {
  if (typeof storedValue !== 'string' || !storedValue) return false;
  if (isBcryptHash(storedValue)) return bcrypt.compare(password, storedValue);
  return password === storedValue;
}

async function hashPassword(password) { return bcrypt.hash(password, 12); }

async function verifyAndUpgradeLegacyPassword(table, id, password, storedValue) {
  if (!['teachers', 'students'].includes(table)) throw new Error('Unsupported account table');
  const matches = await verifyStoredPassword(password, storedValue);
  if (!matches) return false;
  if (!isBcryptHash(storedValue)) {
    const passwordHash = await hashPassword(password);
    await db.execute(`UPDATE ${table} SET password_hash = ? WHERE id = ? AND password_hash = ?`, [passwordHash, id, storedValue]);
  }
  return true;
}

async function changePassword(table, id, currentPassword, newPassword) {
  if (!['teachers', 'students'].includes(table)) throw new Error('Unsupported account table');
  const [rows] = await db.execute(`SELECT password_hash FROM ${table} WHERE id = ?`, [id]);
  if (!rows.length || !(await verifyStoredPassword(currentPassword, rows[0].password_hash))) return false;
  const passwordHash = await hashPassword(newPassword);
  await db.execute(`UPDATE ${table} SET password_hash = ? WHERE id = ?`, [passwordHash, id]);
  return true;
}

module.exports = { isBcryptHash, hashPassword, verifyStoredPassword, verifyAndUpgradeLegacyPassword, changePassword };
