const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const directory = path.resolve(__dirname, '../../storage/submissions');

function safeOriginalName(value) {
  const basename = String(value || 'submission').replace(/\\/g, '/').split('/').pop();
  return basename.replace(/[\0-\x1f\x7f]/g, '_').normalize('NFC').slice(0, 255) || 'submission';
}

async function store(buffer) {
  await fs.mkdir(directory, { recursive: true });
  const key = randomUUID();
  await fs.writeFile(path.join(directory, key), buffer, { flag: 'wx' });
  return key;
}

function resolve(key) {
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return null;
  return path.join(directory, key);
}

async function remove(key) {
  const filePath = resolve(key);
  if (filePath) await fs.unlink(filePath).catch((error) => { if (error.code !== 'ENOENT') throw error; });
}

module.exports = { safeOriginalName, store, resolve, remove };
