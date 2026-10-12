// Shared by the Node server and the paste-in browser form (inlined by
// scripts/build-embed.js), so keep this file free of require() and browser APIs.

/* exported buildReport, isFieldVisible */

function isFieldVisible(field, sectionValues) {
  if (!field.showIf) return true;
  var v = (sectionValues || {})[field.showIf.field];
  return field.showIf.in.indexOf(v) !== -1;
}

// Turns stored answers into a flat, render-ready report model used by both the
// PDF and Word builders. Unanswered questions and empty rows are left out.
function buildReport(sections, answers, opts) {
  opts = opts || {};
  var redact = opts.redactSecrets !== false;
  var redactedText = opts.redactedText || '[stored securely; not included in this copy]';
  var provider = opts.provider || '';

  function present(value) {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && String(value).trim() !== '';
  }
  function format(field, value) {
    if (Array.isArray(value)) return value.join(', ');
    var s = String(value).trim();
    if (field.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
      var p = s.split('-');
      return p[2] + '/' + p[1] + '/' + p[0];
    }
    return s;
  }
  function cell(field, value) {
    var secret = field.type === 'secret';
    return { label: field.label, value: secret && redact ? redactedText : format(field, value), secret: secret };
  }

  return sections.map(function (section) {
    var values = answers[section.id] || {};
    var items = [];
    var tables = [];
    section.fields.forEach(function (field) {
      if (!isFieldVisible(field, values)) return;
      var label = field.label.replace('{{provider}}', provider);
      if (field.type === 'table') {
        var rows = (values[field.id] || [])
          .map(function (row) {
            return field.columns
              .filter(function (c) { return present(row[c.id]); })
              .map(function (c) { return cell(c, row[c.id]); });
          })
          .filter(function (cells) { return cells.length > 0; });
        if (rows.length) tables.push({ label: label, rows: rows });
      } else if (present(values[field.id])) {
        var c = cell(field, values[field.id]);
        c.label = label;
        items.push(c);
      }
    });
    return { id: section.id, title: section.title, items: items, tables: tables, empty: !items.length && !tables.length };
  });
}

if (typeof module !== 'undefined') module.exports = { buildReport: buildReport, isFieldVisible: isFieldVisible };
