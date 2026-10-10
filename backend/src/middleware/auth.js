const jwt = require('jsonwebtoken');
const HttpError = require('../utils/http-error');

function verifyToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, 'Authentication required');
  try {
    return jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
}

function requireRole(role, attach) {
  return (req, res, next) => {
    try {
      const claims = verifyToken(req);
      if (claims.role !== role || !Number.isInteger(Number(claims.sub))) {
        throw new HttpError(401, 'Invalid or expired token');
      }
      attach(req, claims);
      next();
    } catch (error) {
      next(error);
    }
  };
}

const requireAuth = requireRole('teacher', (req, claims) => {
  req.user = { id: Number(claims.sub), email: claims.email };
});
const requireStudentAuth = requireRole('student', (req, claims) => {
  req.student = { id: Number(claims.sub), student_code: claims.student_code };
});
module.exports = { requireAuth, requireStudentAuth };
