const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/config/database');

const required = {
  teachers: ['id', 'full_name', 'email', 'password_hash'],
  courses: ['id', 'course_code', 'course_name', 'description', 'teacher_id'],
  students: ['id', 'student_code', 'full_name', 'password_hash'],
  enrollments: ['id', 'course_id', 'student_id', 'enrollment_status', 'enrolled_at', 'reviewed_at'],
  assignments: ['id', 'course_id', 'title', 'description', 'due_at', 'max_score', 'status', 'created_by'],
  submissions: ['id', 'assignment_id', 'student_id', 'status', 'submitted_at', 'remarks', 'file_storage_key', 'file_original_name', 'file_mime_type', 'file_size', 'score'],
};

async function main() {
  const names = Object.keys(required);
  const [rows] = await db.execute(
    'SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?, ?, ?, ?, ?, ?)', names,
  );
  const actual = new Map();
  for (const row of rows) {
    if (!actual.has(row.TABLE_NAME)) actual.set(row.TABLE_NAME, new Set());
    actual.get(row.TABLE_NAME).add(row.COLUMN_NAME);
  }
  const missing = [];
  for (const [table, columns] of Object.entries(required)) {
    for (const column of columns) if (!actual.get(table)?.has(column)) missing.push(`${table}.${column}`);
  }
  if (missing.length) throw new Error(`Required schema fields missing: ${missing.join(', ')}`);
  console.log(`Schema OK: ${names.join(', ')}`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());
