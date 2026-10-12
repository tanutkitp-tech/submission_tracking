const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const assignmentRoutes = require('./routes/assignments');
const studentRoutes = require('./routes/students');
const db = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errors');
const { isAllowedOrigin } = require('./utils/cors-origin');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((item) => item.trim()).filter(Boolean);
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
  throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
}
app.set('trust proxy', trustProxyHops);
app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin, allowedOrigins, process.env.NODE_ENV === 'production')) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (req, res) => res.json({ success: true, message: 'API is running' }));
app.get('/api/health/db', async (req, res) => {
  const [rows] = await db.execute('SELECT 1 AS connected');
  res.json({ success: true, message: 'Database connection successful', data: { connected: Boolean(rows[0].connected) } });
});
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/student', studentRoutes);
app.use(notFound);
app.use(errorHandler);
module.exports = app;
