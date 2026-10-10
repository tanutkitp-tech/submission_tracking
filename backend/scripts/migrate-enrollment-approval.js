const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/config/database');

async function hasColumn(name) {
  const [rows] = await db.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND COLUMN_NAME = ?",
    [name],
  );
  return rows.length > 0;
}

async function main() {
  const [tables] = await db.execute(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments'",
  );
  if (!tables.length) throw new Error('The enrollments table is missing. Initialize database/init.sql first.');

  if (!(await hasColumn('enrollment_status'))) {
    // Existing self-registered rows remain usable; only new requests wait for approval.
    await db.execute("ALTER TABLE enrollments ADD COLUMN enrollment_status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED' AFTER student_id");
  }
  if (!(await hasColumn('reviewed_at'))) {
    await db.execute('ALTER TABLE enrollments ADD COLUMN reviewed_at TIMESTAMP NULL DEFAULT NULL AFTER enrolled_at');
  }
  await db.execute("ALTER TABLE enrollments MODIFY COLUMN enrollment_status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING'");
  console.log('Enrollment approval schema is ready. Existing enrollments remain approved; new requests wait for teacher review.');
}

main()
  .catch((error) => {
    console.error(error.message || 'Enrollment approval migration failed');
    process.exitCode = 1;
  })
  .finally(() => db.end());
