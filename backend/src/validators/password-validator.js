const HttpError = require('../utils/http-error');
const { objectBody } = require('../utils/validation');

function validatePasswordChangeBody(body = {}) {
  body = objectBody(body, ['current_password', 'new_password'], 'password change');
  const currentPassword = body.current_password;
  const newPassword = body.new_password;
  if (typeof currentPassword !== 'string' || !currentPassword || Buffer.byteLength(currentPassword, 'utf8') > 255) {
    throw new HttpError(400, 'Current password is required');
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    throw new HttpError(400, 'New password must be at least 8 characters and no more than 72 bytes');
  }
  if (currentPassword === newPassword) throw new HttpError(400, 'New password must be different from current password');
  return { currentPassword, newPassword };
}

module.exports = { validatePasswordChangeBody };
