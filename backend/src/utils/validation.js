const HttpError = require('./http-error');
function fail(message) { throw new HttpError(400, message); }
function idParam(value) {
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isSafeInteger(value))) {
    fail('ID must be a positive integer');
  }
  const stringValue = String(value);
  const id = Number(stringValue);
  if (!/^\d+$/.test(stringValue) || !Number.isSafeInteger(id) || id < 1) fail('ID must be a positive integer');
  return id;
}
function text(value, name, max, required = true, maxBytes = null) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) fail(`Invalid ${name}`);
  const normalized = value.trim();
  if (maxBytes != null && Buffer.byteLength(normalized, 'utf8') > maxBytes) fail(`Invalid ${name}`);
  return normalized || null;
}
function dateTime(value) {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/i);
  if (!match) fail('due_at must be a valid ISO date and time');
  const [, year, month, day, hour, minute, secondValue, , zone] = match;
  const second = secondValue || '0';
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  if (Number(year) < 1000 || parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) fail('due_at must be a valid ISO date and time');

  // DATETIME and CURRENT_TIMESTAMP in this project use the Bangkok wall clock.
  // Convert explicitly zoned inputs (including the common Z suffix) to that zone.
  if (zone) {
    if (zone.toUpperCase() !== 'Z') {
      const [, offsetHour, offsetMinute] = zone.match(/^[+-](\d{2}):(\d{2})$/) || [];
      if (Number(offsetHour) > 14 || Number(offsetMinute) > 59 || (Number(offsetHour) === 14 && Number(offsetMinute) !== 0)) {
        fail('due_at must be a valid ISO date and time');
      }
    }
    const normalized = value.replace(/\.\d+(?=(?:Z|[+-]\d{2}:\d{2})$)/i, '');
    const instant = new Date(normalized);
    if (Number.isNaN(instant.getTime())) fail('due_at must be a valid ISO date and time');
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    if (Number(parts.year) < 1000 || Number(parts.year) > 9999) fail('due_at must be a valid ISO date and time');
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  }

  return `${year}-${month}-${day} ${hour}:${minute}${secondValue ? `:${second.padStart(2, '0')}` : ''}`;
}
function pagination(query = {}) {
  query = objectBody(query, ['page', 'limit'], 'pagination query');
  function queryInteger(value, name, fallback) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' && !(typeof value === 'number' && Number.isSafeInteger(value))) {
      fail(`${name} must be an integer`);
    }
    const raw = String(value);
    const number = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(number)) fail(`${name} must be an integer`);
    return number;
  }
  const page = queryInteger(query.page, 'page', 1);
  const limit = queryInteger(query.limit, 'limit', 20);
  if (page < 1) fail('page must be a positive integer');
  if (limit < 1 || limit > 100) fail('limit must be an integer between 1 and 100');
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) fail('page is out of range');
  return { page, limit, offset };
}

function objectBody(body, allowedFields, resource) {
  if (body == null) body = {};
  if (typeof body !== 'object' || Array.isArray(body)) fail(`${resource} body must be an object`);
  const unexpected = Object.keys(body).find((field) => !allowedFields.includes(field));
  if (unexpected) fail(`Unexpected field in ${resource} body`);
  return body;
}

module.exports = { fail, idParam, text, dateTime, pagination, objectBody };
