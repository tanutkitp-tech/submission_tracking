const HttpError = require('../utils/http-error');

function notFound(req, res, next) { next(new HttpError(404, 'Endpoint not found')); }
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) { status = 400; message = 'Invalid JSON body'; }
  if (err.message === 'Origin is not allowed by CORS') { status = 403; message = 'Origin is not allowed'; }
  if (err.code === 'ER_DUP_ENTRY') { status = 409; message = 'A record with the same unique value already exists'; }
  if (['ER_ROW_IS_REFERENCED_2', 'ER_NO_REFERENCED_ROW_2'].includes(err.code)) { status = 409; message = 'Related records prevent this operation'; }
  if (status >= 500) console.error('Request failed:', err.code || err.name || 'Error');
  res.status(status).json({ success: false, message: status >= 500 ? 'Internal server error' : message });
}
module.exports = { notFound, errorHandler };
