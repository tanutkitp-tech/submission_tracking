const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');
const { validEmail } = require('../src/validators/auth-validator');

async function main() {
  const email = process.env.INITIAL_TEACHER_EMAIL;
  const password = process.env.INITIAL_TEACHER_PASSWORD;
  const fullName = process.env.INITIAL_TEACHER_NAME;
  if (!validEmail(email) || typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 150 || typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set a valid teacher email and name, and a password of 12 to 72 bytes in backend/.env.');
  }
  const normalizedEmail = email.trim().toLowerCase();
  const [existing] = await db.execute('SELECT id FROM teachers WHERE email=?', [normalizedEmail]);
  if (existing.length) throw new Error('A teacher with this email already exists; no changes were made.');
  const hash = await bcrypt.hash(password, 12);
  await db.execute('INSERT INTO teachers (full_name,email,password_hash) VALUES (?,?,?)', [fullName.trim(), normalizedEmail, hash]);
  console.log('Teacher account created. Remove INITIAL_TEACHER_PASSWORD from backend/.env when finished.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());
