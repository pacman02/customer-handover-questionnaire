'use strict';

const nodemailer = require('nodemailer');

// SMTP settings come from the environment. Works with SMTP2GO
// (mail.smtp2go.com:2525 or 587) or Microsoft 365 (smtp.office365.com:587,
// requires SMTP AUTH enabled on the sending mailbox).
function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM && process.env.MAIL_TO);
}

let transport;
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for STARTTLS
      requireTLS: process.env.SMTP_SECURE !== 'true' && process.env.SMTP_REQUIRE_TLS !== 'false',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

async function send({ to, subject, text, attachments }) {
  if (!isConfigured()) {
    return { sent: false, reason: 'SMTP is not configured (set SMTP_HOST, MAIL_FROM and MAIL_TO).' };
  }
  await getTransport().sendMail({
    from: process.env.MAIL_FROM,
    to: to || process.env.MAIL_TO,
    subject,
    text,
    attachments,
  });
  return { sent: true };
}

module.exports = { send, isConfigured };
