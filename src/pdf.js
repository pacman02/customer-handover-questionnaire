'use strict';

const { jsPDF } = require('jspdf');
const { buildPdf } = require('./shared/pdf-builder');

const NOTICE = 'Passwords and other secrets are stored encrypted and are not included in this copy. View them in the secure admin portal.';

// Returns a Buffer containing the PDF report.
async function renderPdf(report, meta) {
  const doc = buildPdf(jsPDF, report, { ...meta, notice: meta.redacted ? NOTICE : '' });
  return Buffer.from(doc.output('arraybuffer'));
}

module.exports = { renderPdf, NOTICE };
