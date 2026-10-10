const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('DB_USER, DB_PASSWORD, and a JWT_SECRET of at least 32 characters are required.');
  process.exit(1);
}
const app = require('./app');
const db = require('./config/database');
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`Backend listening on port ${port}`));
async function shutdown() {
  server.close(async () => { await db.end(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
