const jwt = require('jsonwebtoken');
const HttpError = require('../utils/http-error');

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(new HttpError(401, 'Authentication required'));
  try {
    const claims = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (claims.role !== 'teacher' || !Number.isInteger(Number(claims.sub))) throw new Error('Invalid claims');
    req.user = { id: Number(claims.sub), email: claims.email };
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}
module.exports = { requireAuth };
