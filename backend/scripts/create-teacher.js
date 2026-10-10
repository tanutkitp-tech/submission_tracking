const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

async function main() {
  const email = process.env.INITIAL_TEACHER_EMAIL;
  const password = process.env.INITIAL_TEACHER_PASSWORD;
  const fullName = process.env.INITIAL_TEACHER_NAME;
  if (!email || !password || !fullName || password.length < 12) throw new Error('Set INITIAL_TEACHER_EMAIL, INITIAL_TEACHER_NAME, and INITIAL_TEACHER_PASSWORD (at least 12 characters) in backend/.env first.');
  const [existing] = await db.execute('SELECT id FROM teachers WHERE email=?', [email.trim().toLowerCase()]);
  if (existing.length) throw new Error('A teacher with this email already exists; no changes were made.');
  const hash = await bcrypt.hash(password, 12);
  await db.execute('INSERT INTO teachers (full_name,email,password_hash) VALUES (?,?,?)', [fullName.trim(), email.trim().toLowerCase(), hash]);
  console.log('Teacher account created. Remove INITIAL_TEACHER_PASSWORD from backend/.env when finished.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());
