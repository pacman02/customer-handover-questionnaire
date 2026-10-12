'use strict';

// Turns stored answers into a flat, render-ready report model that both the
// PDF and the Word generators use. Unanswered questions and empty rows are
// left out so the reports stay readable.

const { sections, isVisible } = require('./schema');

const REDACTED = '[stored securely; not included in this copy]';

function formatValue(field, value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (field.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  return String(value).trim();
}

function present(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function buildReport(answers, { redactSecrets = true, provider = '' } = {}) {
  const out = [];
  for (const section of sections) {
    const values = answers[section.id] || {};
    const items = [];
    const tables = [];
    for (const field of section.fields) {
      if (!isVisible(field, values)) continue;
      const label = field.label.replace('{{provider}}', provider);
      if (field.type === 'table') {
        const rows = (values[field.id] || [])
          .map((row) => field.columns
            .filter((c) => present(row[c.id]))
            .map((c) => ({
              label: c.label,
              value: c.type === 'secret' && redactSecrets ? REDACTED : formatValue(c, row[c.id]),
              secret: c.type === 'secret',
            })))
          .filter((cells) => cells.length > 0);
        if (rows.length) tables.push({ label, rows });
      } else if (present(values[field.id])) {
        items.push({
          label,
          value: field.type === 'secret' && redactSecrets ? REDACTED : formatValue(field, values[field.id]),
          secret: field.type === 'secret',
        });
      }
    }
    out.push({ id: section.id, title: section.title, items, tables, empty: !items.length && !tables.length });
  }
  return out;
}

function customerName(answers) {
  return (answers.business && answers.business.company_name) || 'Unnamed customer';
}

module.exports = { buildReport, customerName, REDACTED };
