'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SMTPServer } = require('smtp-server');
const JSZip = require('jszip');

const SECRET = 'Sup3r-Secret-Pa55!';
const received = [];
let smtp, server, base, dataDir;

before(async () => {
  smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS'],
    onData(stream, session, cb) {
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => { received.push(Buffer.concat(chunks).toString()); cb(); });
    },
  });
  await new Promise((r) => smtp.listen(0, '127.0.0.1', r));

  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-'));
  Object.assign(process.env, {
    DATA_DIR: dataDir,
    ENCRYPTION_KEY: '11'.repeat(32),
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtp.server.address().port),
    SMTP_SECURE: 'false',
    SMTP_REQUIRE_TLS: 'false',
    MAIL_FROM: 'forms@example.com',
    MAIL_TO: 'support@example.com',
    ADMIN_PASSWORD: 'adminpass',
  });
  const { app } = require('../src/server');
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  smtp.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const adminAuth = { Authorization: 'Basic ' + Buffer.from('admin:adminpass').toString('base64') };

async function docxText(buf) {
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
}

test('full questionnaire flow: create, save, submit, email, admin download', async () => {
  const created = await (await fetch(`${base}/api/questionnaires`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
  assert.ok(created.id && created.token);
  const headers = { 'Content-Type': 'application/json', 'X-Access-Token': created.token };

  // Wrong token is rejected
  const bad = await fetch(`${base}/api/questionnaires/${created.id}`, { headers: { 'X-Access-Token': 'nope' } });
  assert.equal(bad.status, 404);

  const answers = {
    business: { company_name: 'Acme Pty Ltd', staff_count: '12', contacts: [{ name: 'Jane', role: 'Primary contact', phone: '0400 000 000' }] },
    m365: { uses_m365: 'Yes', tenant_name: 'acme.onmicrosoft.com', admins: [{ username: 'admin@acme.com.au', password: SECRET }] },
    network: { s2s_vpn: 'Yes', site_vpn: [{ name: 'HQ-Branch', ike: 'IKEv2', psk: SECRET }] },
    final: { completed_by: 'Jane', authorised: ['Yes, I am authorised'] },
    bogus_section: { x: 'dropped' },
  };
  const put = await fetch(`${base}/api/questionnaires/${created.id}`, { method: 'PUT', headers, body: JSON.stringify({ answers }) });
  assert.equal(put.status, 200);

  // Stored encrypted: no plaintext on disk
  const raw = fs.readFileSync(path.join(dataDir, 'questionnaires', `${created.id}.enc`));
  assert.ok(!raw.includes(SECRET) && !raw.includes('Acme'));

  const loaded = await (await fetch(`${base}/api/questionnaires/${created.id}`, { headers })).json();
  assert.equal(loaded.answers.m365.admins[0].password, SECRET);
  assert.equal(loaded.answers.bogus_section, undefined);

  // Required fields enforced
  const missing = await fetch(`${base}/api/questionnaires/${created.id}/submit`, {
    method: 'POST', headers, body: JSON.stringify({ answers: { ...answers, final: {} } }),
  });
  assert.equal(missing.status, 400);
  assert.ok((await missing.json()).missing.length >= 2);

  const sub = await fetch(`${base}/api/questionnaires/${created.id}/submit`, { method: 'POST', headers, body: JSON.stringify({ answers }) });
  assert.equal(sub.status, 200);

  // Email arrived with PDF + Word, without secrets
  assert.equal(received.length, 1);
  const mail = received[0];
  assert.match(mail, /Subject: Customer handover: Acme Pty Ltd/);
  assert.match(mail, /Handover-Acme-Pty-Ltd\.pdf/);
  assert.match(mail, /Handover-Acme-Pty-Ltd\.docx/);
  assert.ok(!mail.includes(SECRET));

  // Locked after submit
  const again = await fetch(`${base}/api/questionnaires/${created.id}`, { method: 'PUT', headers, body: JSON.stringify({ answers }) });
  assert.equal(again.status, 409);

  // Admin requires auth
  assert.equal((await fetch(`${base}/admin/api/list`)).status, 401);
  const list = await (await fetch(`${base}/admin/api/list`, { headers: adminAuth })).json();
  assert.equal(list[0].customer, 'Acme Pty Ltd');
  assert.equal(list[0].email.sent, true);

  // Redacted vs full Word downloads
  const red = Buffer.from(await (await fetch(`${base}/admin/download/${created.id}.docx`, { headers: adminAuth })).arrayBuffer());
  const full = Buffer.from(await (await fetch(`${base}/admin/download/${created.id}.docx?full=1`, { headers: adminAuth })).arrayBuffer());
  const redText = await docxText(red);
  const fullText = await docxText(full);
  assert.ok(redText.includes('acme.onmicrosoft.com'));
  assert.ok(!redText.includes(SECRET));
  assert.ok(fullText.includes(SECRET));

  const pdf = await fetch(`${base}/admin/download/${created.id}.pdf`, { headers: adminAuth });
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
});

test('admin invite creates a working link', async () => {
  const inv = await (await fetch(`${base}/admin/api/invite`, {
    method: 'POST', headers: { ...adminAuth, 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: 'Bravo Farms' }),
  })).json();
  const [, id, token] = inv.url.match(/\/q\/([a-f0-9]+)#(.+)$/);
  const rec = await (await fetch(`${base}/api/questionnaires/${id}`, { headers: { 'X-Access-Token': token } })).json();
  assert.equal(rec.answers.business.company_name, 'Bravo Farms');
});
