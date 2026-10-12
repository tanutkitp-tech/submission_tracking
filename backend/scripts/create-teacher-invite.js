const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/config/database');

const INVITE_LIFETIME_MS = 24 * 60 * 60 * 1000;

async function main() {
  const code = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + INVITE_LIFETIME_MS;
  const codeHash = createHash('sha256').update(code).digest();
  await db.execute(
    'INSERT INTO teacher_signup_invites (code_hash, expires_at) VALUES (?, ?)',
    [codeHash, expiresAt],
  );
  console.log(`Teacher invitation code: ${code}`);
  console.log(`Expires: ${new Date(expiresAt).toISOString()}`);
  console.log('Send this code directly to one teacher. It can be used once.');
}

main()
  .catch((error) => { console.error(error.message || 'Could not create teacher invitation'); process.exitCode = 1; })
  .finally(() => db.end());
