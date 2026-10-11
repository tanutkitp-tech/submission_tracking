const HttpError = require('./http-error');
function fail(message) { throw new HttpError(400, message); }
function idParam(value) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) fail('ID must be a positive integer');
  return Number(value);
}
function text(value, name, max, required = true) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) fail(`Invalid ${name}`);
  return value.trim() || null;
}
function dateTime(value) {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/i);
  if (!match) fail('due_at must be a valid ISO date and time');
  const [, year, month, day, hour, minute, secondValue, , zone] = match;
  const second = secondValue || '0';
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  if (Number(year) < 100 || parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) fail('due_at must be a valid ISO date and time');

  // DATETIME and CURRENT_TIMESTAMP in this project use the Bangkok wall clock.
  // Convert explicitly zoned inputs (including the common Z suffix) to that zone.
  if (zone) {
    if (zone.toUpperCase() !== 'Z') {
      const [, offsetHour, offsetMinute] = zone.match(/^[+-](\d{2}):(\d{2})$/) || [];
      if (Number(offsetHour) > 14 || Number(offsetMinute) > 59 || (Number(offsetHour) === 14 && Number(offsetMinute) !== 0)) {
        fail('due_at must be a valid ISO date and time');
      }
    }
    const normalized = value.replace(' ', 'T');
    const instant = new Date(normalized);
    if (Number.isNaN(instant.getTime())) fail('due_at must be a valid ISO date and time');
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  }

  return `${year}-${month}-${day} ${hour}:${minute}${secondValue ? `:${second.padStart(2, '0')}` : ''}`;
}
function pagination(query = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1) fail('page must be a positive integer');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail('limit must be an integer between 1 and 100');
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) fail('page is out of range');
  return { page, limit, offset };
}
module.exports = { fail, idParam, text, dateTime, pagination };
