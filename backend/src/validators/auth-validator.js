const HttpError = require('../utils/http-error');
const { objectBody, text } = require('../utils/validation');

function validEmail(value) {
  if (typeof value !== 'string' || value.length > 255) return false;
  const email = value.trim();
  const [local, domain, ...extra] = email.split('@');
  if (extra.length || !local || !domain || local.length > 64 || domain.length > 253) return false;
  const localPart = /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i;
  const domainPart = /^(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?$/i;
  return localPart.test(local) && domainPart.test(domain);
}

function passwordValue(value) {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) {
    throw new HttpError(400, 'Password must be at least 8 characters and no more than 72 bytes');
  }
  return value;
}

function validateTeacherRegisterBody(body = {}) {
  body = objectBody(body, ['full_name', 'email', 'password', 'invite_code'], 'teacher registration');
  if (!validEmail(body.email)) throw new HttpError(400, 'Valid email with a domain ending is required');
  if (body.invite_code != null && (typeof body.invite_code !== 'string' || body.invite_code.length > 255)) {
    throw new HttpError(400, 'Invalid invitation code');
  }
  return {
    fullName: text(body.full_name, 'full_name', 150),
    email: body.email.trim().toLowerCase(),
    password: passwordValue(body.password),
    inviteCode: typeof body.invite_code === 'string' ? body.invite_code.trim() : '',
  };
}

function validateLoginBody(body) {
  body = objectBody(body, ['email', 'password'], 'login');
  const email = body?.email;
  const password = body?.password;
  if (!validEmail(email) || typeof password !== 'string' || !password) {
    throw new HttpError(400, 'Valid email and password are required');
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new HttpError(400, 'Password must be no more than 72 bytes');
  }
  return { email: email.trim().toLowerCase(), password };
}
module.exports = { validEmail, validateTeacherRegisterBody, validateLoginBody };
