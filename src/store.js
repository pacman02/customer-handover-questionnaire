'use strict';

// Questionnaire records are stored one file per record, each encrypted with
// AES-256-GCM. Nothing (answers, credentials, customer name) is written to
// disk in plain text.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const RECORD_DIR = path.join(DATA_DIR, 'questionnaires');
fs.mkdirSync(RECORD_DIR, { recursive: true });

function loadKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw) {
    const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64).');
    return key;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY must be set in production. Generate one with: npm run gen-key');
  }
  const devKeyFile = path.join(DATA_DIR, '.dev-key');
  if (!fs.existsSync(devKeyFile)) {
    fs.writeFileSync(devKeyFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  console.warn('[store] ENCRYPTION_KEY not set; using a development key in', devKeyFile);
  return Buffer.from(fs.readFileSync(devKeyFile, 'utf8').trim(), 'hex');
}

const KEY = loadKey();

function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function decrypt(buf) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8'));
}

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const fileFor = (id) => path.join(RECORD_DIR, `${id}.enc`);
const validId = (id) => /^[a-f0-9]{16}$/.test(id);

function create({ customerLabel = '', createdBy = 'public' } = {}) {
  const id = crypto.randomBytes(8).toString('hex');
  const token = crypto.randomBytes(24).toString('base64url');
  const now = new Date().toISOString();
  const record = {
    id, tokenHash: hashToken(token), customerLabel, createdBy,
    status: 'draft', createdAt: now, updatedAt: now, submittedAt: null,
    answers: {},
  };
  save(record);
  return { record, token };
}

function get(id) {
  if (!validId(id) || !fs.existsSync(fileFor(id))) return null;
  return decrypt(fs.readFileSync(fileFor(id)));
}

function save(record) {
  const tmp = fileFor(record.id) + '.tmp';
  fs.writeFileSync(tmp, encrypt(record), { mode: 0o600 });
  fs.renameSync(tmp, fileFor(record.id));
}

function checkToken(record, token) {
  if (!record || !token) return false;
  const a = Buffer.from(record.tokenHash, 'hex');
  const b = Buffer.from(hashToken(token), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Issues a fresh access link for a record (the old link stops working).
function rotateToken(record) {
  const token = crypto.randomBytes(24).toString('base64url');
  record.tokenHash = hashToken(token);
  save(record);
  return token;
}

function list() {
  return fs.readdirSync(RECORD_DIR)
    .filter((f) => f.endsWith('.enc'))
    .map((f) => {
      try { return get(f.slice(0, -4)); } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function remove(id) {
  if (validId(id) && fs.existsSync(fileFor(id))) fs.unlinkSync(fileFor(id));
}

module.exports = { create, get, save, checkToken, rotateToken, list, remove };
