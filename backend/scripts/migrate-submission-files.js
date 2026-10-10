const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/config/database');

const columns = [
  ['file_storage_key', 'CHAR(36) NULL AFTER remarks'],
  ['file_original_name', 'VARCHAR(255) NULL AFTER file_storage_key'],
  ['file_mime_type', 'VARCHAR(150) NULL AFTER file_original_name'],
  ['file_size', 'BIGINT UNSIGNED NULL AFTER file_mime_type'],
  ['score', 'DECIMAL(8,2) NULL AFTER file_size'],
];

async function main() {
  const [tables] = await db.execute(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'submissions'",
  );
  if (!tables.length) throw new Error('The submissions table is missing. Initialize database/init.sql first.');

  for (const [name, definition] of columns) {
    const [matches] = await db.execute(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'submissions' AND COLUMN_NAME = ?",
      [name],
    );
    if (!matches.length) await db.execute(`ALTER TABLE submissions ADD COLUMN ${name} ${definition}`);
  }
  console.log('Submission file and grading columns are ready. Existing submissions were preserved.');
}

main()
  .catch((error) => { console.error(error.message || 'Submission migration failed'); process.exitCode = 1; })
  .finally(() => db.end());
