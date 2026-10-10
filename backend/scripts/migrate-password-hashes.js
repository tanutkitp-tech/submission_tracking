const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/config/database');
const { hashPassword, isBcryptHash } = require('../src/services/password-service');

async function migrateTable(table) {
  if (!['teachers', 'students'].includes(table)) throw new Error('Unsupported account table');
  const [rows] = await db.execute(`SELECT id, password_hash FROM ${table} WHERE password_hash IS NOT NULL`);
  const replacements = [];
  let skippedLongPasswords = 0;
  for (const row of rows) {
    if (isBcryptHash(row.password_hash)) continue;
    if (typeof row.password_hash !== 'string' || !row.password_hash) continue;
    if (Buffer.byteLength(row.password_hash, 'utf8') > 72) {
      skippedLongPasswords += 1;
      continue;
    }
    replacements.push({ id: row.id, previousValue: row.password_hash, hash: await hashPassword(row.password_hash) });
  }
  if (!replacements.length) return { changed: 0, skippedLongPasswords };

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const item of replacements) {
      const [result] = await connection.execute(
        `UPDATE ${table} SET password_hash = ? WHERE id = ? AND password_hash = ?`,
        [item.hash, item.id, item.previousValue],
      );
      if (result.affectedRows !== 1) throw new Error('Account password changed during migration; no partial update was kept.');
    }
    await connection.commit();
    return { changed: replacements.length, skippedLongPasswords };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function main() {
  const teachers = await migrateTable('teachers');
  const students = await migrateTable('students');
  console.log(`Password hashes updated: ${teachers.changed + students.changed} account(s).`);
  if (teachers.skippedLongPasswords + students.skippedLongPasswords) {
    console.log(`Skipped ${teachers.skippedLongPasswords + students.skippedLongPasswords} legacy value(s) longer than bcrypt supports.`);
  }
}

main()
  .catch((error) => {
    console.error(error.message || 'Password migration failed');
    process.exitCode = 1;
  })
  .finally(() => db.end());
