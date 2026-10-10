require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/config/database');

let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/health/db`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.database, process.env.DB_NAME || 'assignment_tracking');
});

test('serves public course and published assignment lists without private fields', async () => {
  const courses = await fetch(`${base}/api/courses`).then((r) => r.json());
  const assignments = await fetch(`${base}/api/assignments`).then((r) => r.json());
  assert.equal(courses.success, true);
  assert.equal(assignments.success, true);
  assert.ok(courses.data.every((item) => !('password_hash' in item)));
  assert.ok(assignments.data.every((item) => item.status === 'PUBLISHED' && !('student_code' in item) && !('password_hash' in item)));
});

test('rejects missing/invalid auth and handles validation and 404 responses', async () => {
  assert.equal((await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email', password: 'wrong' }) })).status, 400);
  const badLogin = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'no-such-user@example.invalid', password: 'incorrect-password' }) });
  assert.equal(badLogin.status, 401);
  assert.ok(!JSON.stringify(await badLogin.json()).includes('password_hash'));
  assert.equal((await fetch(`${base}/api/auth/me`)).status, 401);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { authorization: 'Bearer invalid' } })).status, 401);
  assert.equal((await fetch(`${base}/api/courses/mine`)).status, 401);
  assert.equal((await fetch(`${base}/api/assignments/mine`)).status, 401);
  assert.equal((await fetch(`${base}/api/assignments/1/submissions/1`, { method: 'PATCH' })).status, 401);
  assert.equal((await fetch(`${base}/api/courses/not-an-id`)).status, 400);
  assert.equal((await fetch(`${base}/api/no-such-route`)).status, 404);
  assert.equal((await fetch(`${base}/api/courses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ course_code: 'UNAUTH', course_name: 'Denied' }) })).status, 401);
});

after(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await db.end();
});
