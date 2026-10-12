const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/config/database');

async function main() {
  await db.execute(`CREATE TABLE IF NOT EXISTS auth_rate_limit_buckets (
    bucket_key BINARY(32) NOT NULL,
    attempt_count INT UNSIGNED NOT NULL,
    reset_at BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (bucket_key),
    KEY idx_auth_rate_limit_reset_at (reset_at)
  ) ENGINE=InnoDB`);

  await db.execute(`CREATE TABLE IF NOT EXISTS teacher_signup_invites (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code_hash BINARY(32) NOT NULL,
    expires_at BIGINT UNSIGNED NOT NULL,
    used_at BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_teacher_signup_invite_code_hash (code_hash),
    KEY idx_teacher_signup_invite_expires_at (expires_at)
  ) ENGINE=InnoDB`);

  console.log('Production security tables are ready. Existing application tables and records were not changed.');
}

main()
  .catch((error) => { console.error(error.message || 'Security table migration failed'); process.exitCode = 1; })
  .finally(() => db.end());
