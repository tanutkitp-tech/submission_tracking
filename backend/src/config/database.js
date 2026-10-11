const mysql = require('mysql2/promise');
const { createDatabaseFacade } = require('./database-facade');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'assignment_tracking',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
  dateStrings: true,
});

module.exports = createDatabaseFacade(pool);
