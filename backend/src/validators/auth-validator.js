const HttpError = require('../utils/http-error');

function validateLoginBody(body) {
  const email = body?.email;
  const password = body?.password;
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || !password) {
    throw new HttpError(400, 'Valid email and password are required');
  }
  return { email: email.trim().toLowerCase(), password };
}
module.exports = { validateLoginBody };
