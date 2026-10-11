const HttpError = require('../utils/http-error');
const { objectBody } = require('../utils/validation');

function validateLoginBody(body) {
  body = objectBody(body, ['email', 'password'], 'login');
  const email = body?.email;
  const password = body?.password;
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || !password) {
    throw new HttpError(400, 'Valid email and password are required');
  }
  return { email: email.trim().toLowerCase(), password };
}
module.exports = { validateLoginBody };
