'use strict';

require('./env');
const crypto = require('crypto');
const path = require('path');
const express = require('express');

const store = require('./store');
const { sections, isVisible } = require('./schema');
const { buildReport, customerName } = require('./report');
const { renderPdf } = require('./pdf');
const { renderDocx } = require('./docx');
const mailer = require('./mailer');

const PROVIDER = process.env.COMPANY_NAME || 'Sterling iT';
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const START_CODE = process.env.START_CODE || '';
const PUBLIC_START = process.env.PUBLIC_START !== 'false';
const EMAIL_INCLUDE_SECRETS = process.env.EMAIL_INCLUDE_SECRETS === 'true';

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:",
  });
  next();
});

// --- small in-memory rate limiter for unauthenticated endpoints ------------
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.path}|${req.ip}`;
    const now = Date.now();
    const entry = hits.get(key) || { n: 0, reset: now + windowMs };
    if (now > entry.reset) { entry.n = 0; entry.reset = now + windowMs; }
    entry.n += 1;
    hits.set(key, entry);
    if (entry.n > max) return res.status(429).json({ error: 'Too many requests, please try again shortly.' });
    next();
  };
}

// --- helpers ----------------------------------------------------------------
const clientSchema = () => JSON.parse(JSON.stringify(sections).replaceAll('{{provider}}', PROVIDER));

function sanitizeAnswers(input) {
  // Only keep known sections/fields, coerce to strings, cap sizes.
  const out = {};
  const str = (v) => (v === undefined || v === null ? '' : String(v).slice(0, 5000));
  for (const section of sections) {
    const src = (input && input[section.id]) || {};
    const dst = {};
    for (const f of section.fields) {
      const v = src[f.id];
      if (v === undefined) continue;
      if (f.type === 'table') {
        if (!Array.isArray(v)) continue;
        dst[f.id] = v.slice(0, 500).map((row) => {
          const r = {};
          for (const c of f.columns) if (row && row[c.id] !== undefined) r[c.id] = str(row[c.id]);
          return r;
        });
      } else if (f.type === 'checkboxes') {
        dst[f.id] = Array.isArray(v) ? v.map(str).filter((x) => f.options.includes(x)) : [];
      } else {
        dst[f.id] = str(v);
      }
    }
    out[section.id] = dst;
  }
  return out;
}

function missingRequired(answers) {
  const missing = [];
  for (const section of sections) {
    const values = answers[section.id] || {};
    for (const f of section.fields) {
      if (!f.required || !isVisible(f, values)) continue;
      const v = values[f.id];
      if (Array.isArray(v) ? v.length === 0 : !String(v || '').trim()) {
        missing.push({ section: section.id, field: f.id, label: f.label.replace('{{provider}}', PROVIDER) });
      }
    }
  }
  return missing;
}

async function buildFiles(record, { redact }) {
  const name = customerName(record.answers);
  const when = new Date(record.submittedAt || record.updatedAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });
  const meta = {
    provider: PROVIDER,
    title: `New Customer Handover: ${name}`,
    subtitle: `${record.status === 'submitted' ? 'Submitted' : 'Draft saved'} ${when} (ref ${record.id})`,
    redacted: redact,
  };
  const report = buildReport(record.answers, { redactSecrets: redact, provider: PROVIDER });
  const safe = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'customer';
  const suffix = redact ? '' : '-FULL-CONFIDENTIAL';
  return {
    name,
    pdf: { filename: `Handover-${safe}${suffix}.pdf`, content: await renderPdf(report, meta), contentType: 'application/pdf' },
    docx: { filename: `Handover-${safe}${suffix}.docx`, content: await renderDocx(report, meta), contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  };
}

async function emailSubmission(record) {
  const redact = !EMAIL_INCLUDE_SECRETS;
  const files = await buildFiles(record, { redact });
  const lines = [
    `A new customer handover questionnaire has been submitted.`,
    ``,
    `Customer: ${files.name}`,
    `Completed by: ${record.answers.final?.completed_by || '-'} ${record.answers.final?.completed_email ? `<${record.answers.final.completed_email}>` : ''}`,
    `Reference: ${record.id}`,
    ``,
    redact
      ? `Credentials are NOT included in the attached copies. View or download the full report in the admin portal: ${BASE_URL}/admin`
      : `WARNING: the attached copies include credentials.`,
  ];
  return mailer.send({
    subject: `Customer handover: ${files.name}`,
    text: lines.join('\n'),
    attachments: [files.pdf, files.docx],
  });
}

// --- customer API -----------------------------------------------------------
app.get('/api/config', (req, res) => {
  res.json({ provider: PROVIDER, publicStart: PUBLIC_START, startCodeRequired: Boolean(START_CODE) });
});

app.get('/api/schema', (req, res) => res.json(clientSchema()));

app.post('/api/questionnaires', rateLimit(10, 60 * 60 * 1000), (req, res) => {
  if (!PUBLIC_START) return res.status(403).json({ error: 'Please use the link provided by ' + PROVIDER + '.' });
  if (START_CODE) {
    const given = Buffer.from(String(req.body?.startCode || ''));
    const want = Buffer.from(START_CODE);
    if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
      return res.status(403).json({ error: 'That access code is not correct.' });
    }
  }
  const { record, token } = store.create();
  res.status(201).json({ id: record.id, token, url: `${BASE_URL}/q/${record.id}#${token}` });
});

function loadForCustomer(req, res) {
  const record = store.get(req.params.id);
  if (!record || !store.checkToken(record, req.get('X-Access-Token'))) {
    res.status(404).json({ error: 'Questionnaire not found. Check you have the full link.' });
    return null;
  }
  return record;
}

app.get('/api/questionnaires/:id', rateLimit(120, 60 * 1000), (req, res) => {
  const record = loadForCustomer(req, res);
  if (!record) return;
  res.json({ id: record.id, status: record.status, updatedAt: record.updatedAt, submittedAt: record.submittedAt, answers: record.answers });
});

app.put('/api/questionnaires/:id', rateLimit(240, 60 * 1000), (req, res) => {
  const record = loadForCustomer(req, res);
  if (!record) return;
  if (record.status === 'submitted') return res.status(409).json({ error: 'This questionnaire has already been submitted.' });
  record.answers = sanitizeAnswers(req.body?.answers);
  record.updatedAt = new Date().toISOString();
  store.save(record);
  res.json({ ok: true, updatedAt: record.updatedAt });
});

app.post('/api/questionnaires/:id/submit', rateLimit(10, 60 * 1000), async (req, res) => {
  const record = loadForCustomer(req, res);
  if (!record) return;
  if (record.status === 'submitted') return res.status(409).json({ error: 'This questionnaire has already been submitted.' });
  if (req.body?.answers) record.answers = sanitizeAnswers(req.body.answers);
  const missing = missingRequired(record.answers);
  if (missing.length) return res.status(400).json({ error: 'Some required questions are not answered.', missing });

  record.status = 'submitted';
  record.submittedAt = record.updatedAt = new Date().toISOString();
  store.save(record);

  let email;
  try {
    email = await emailSubmission(record);
  } catch (err) {
    console.error('[email] send failed:', err.message);
    email = { sent: false, reason: 'Email failed to send; the submission is saved.' };
  }
  record.email = { ...email, at: new Date().toISOString() };
  store.save(record);
  if (!email.sent) console.warn('[email] not sent for', record.id, '-', email.reason);
  res.json({ ok: true });
});

// --- admin ------------------------------------------------------------------
function adminAuth(req, res, next) {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return res.status(503).send('Admin portal disabled: set ADMIN_PASSWORD.');
  const user = process.env.ADMIN_USER || 'admin';
  const [scheme, encoded] = (req.get('Authorization') || '').split(' ');
  if (scheme === 'Basic' && encoded) {
    const [u, ...rest] = Buffer.from(encoded, 'base64').toString().split(':');
    const p = rest.join(':');
    const eq = (a, b) => {
      const ha = crypto.createHash('sha256').update(a).digest();
      const hb = crypto.createHash('sha256').update(b).digest();
      return crypto.timingSafeEqual(ha, hb);
    };
    if (eq(u, user) & eq(p, pass)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Handover admin", charset="UTF-8"').status(401).send('Authentication required.');
}

const admin = express.Router();
admin.use(rateLimit(300, 60 * 1000), adminAuth);

admin.get('/api/list', (req, res) => {
  res.json(store.list().map((r) => ({
    id: r.id,
    customer: r.answers.business?.company_name || r.customerLabel || '(not entered yet)',
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    submittedAt: r.submittedAt,
    email: r.email || null,
  })));
});

admin.post('/api/invite', (req, res) => {
  const label = String(req.body?.customer || '').slice(0, 200);
  const { record, token } = store.create({ customerLabel: label, createdBy: 'admin' });
  if (label) {
    record.answers = { business: { company_name: label } };
    store.save(record);
  }
  res.status(201).json({ id: record.id, url: `${BASE_URL}/q/${record.id}#${token}` });
});

admin.post('/api/:id/relink', (req, res) => {
  const record = store.get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  const token = store.rotateToken(record);
  res.json({ url: `${BASE_URL}/q/${record.id}#${token}` });
});

admin.post('/api/:id/reopen', (req, res) => {
  const record = store.get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  record.status = 'draft';
  record.updatedAt = new Date().toISOString();
  store.save(record);
  res.json({ ok: true });
});

admin.post('/api/:id/resend', async (req, res) => {
  const record = store.get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  try {
    const email = await emailSubmission(record);
    record.email = { ...email, at: new Date().toISOString() };
    store.save(record);
    res.json(email);
  } catch (err) {
    res.status(502).json({ sent: false, reason: err.message });
  }
});

admin.delete('/api/:id', (req, res) => {
  store.remove(req.params.id);
  res.json({ ok: true });
});

admin.get('/download/:id.:format', async (req, res) => {
  const record = store.get(req.params.id);
  if (!record || !['pdf', 'docx'].includes(req.params.format)) return res.status(404).send('Not found');
  const files = await buildFiles(record, { redact: req.query.full !== '1' });
  const file = files[req.params.format];
  res.set({
    'Content-Type': file.contentType,
    'Content-Disposition': `attachment; filename="${file.filename}"`,
    'Cache-Control': 'no-store',
  }).send(file.content);
});

admin.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'views', 'admin.html')));
admin.get('/admin.js', (req, res) => res.sendFile(path.join(__dirname, '..', 'views', 'admin.js')));
app.use('/admin', admin);

// --- static pages -------------------------------------------------------------
const pub = path.join(__dirname, '..', 'public');
app.use(express.static(pub, { index: 'index.html' }));
app.get('/q/:id', (req, res) => res.sendFile(path.join(pub, 'form.html')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Handover questionnaire running at ${BASE_URL}`);
    if (!mailer.isConfigured()) console.warn('[email] SMTP not configured; submissions will be stored but not emailed.');
    if (!process.env.ADMIN_PASSWORD) console.warn('[admin] ADMIN_PASSWORD not set; admin portal is disabled.');
  });
}

module.exports = { app, buildFiles };
