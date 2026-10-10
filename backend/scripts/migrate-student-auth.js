const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/config/database');

async function main() {
  const [tables] = await db.execute(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students'",
  );
  if (!tables.length) throw new Error('The students table is missing. Initialize database/init.sql first.');

  const [columns] = await db.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'password_hash'",
  );
  if (columns.length) {
    console.log('Student authentication schema already exists.');
    return;
  }

  await db.execute('ALTER TABLE students ADD COLUMN password_hash VARCHAR(255) NULL AFTER full_name');
  console.log('Added students.password_hash. Existing student records can sign in after a password is set.');
}

main()
  .catch((error) => {
    console.error(error.message || 'Student authentication migration failed');
    process.exitCode = 1;
  })
  .finally(() => db.end());
