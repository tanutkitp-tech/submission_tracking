const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/config/database');

async function main() {
  const [tables] = await db.execute(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments'",
  );
  if (!tables.length) throw new Error('The assignments table is missing. Initialize database/init.sql first.');

  const [columns] = await db.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND COLUMN_NAME = 'max_score'",
  );
  if (!columns.length) {
    await db.execute('ALTER TABLE assignments ADD COLUMN max_score DECIMAL(8,2) NOT NULL DEFAULT 100.00 AFTER due_at');
  }
  console.log('Assignment maximum score is ready. Existing assignments keep their data and use 100 as the default maximum.');
}

main()
  .catch((error) => { console.error(error.message || 'Assignment score migration failed'); process.exitCode = 1; })
  .finally(() => db.end());
