'use strict';

const PDFDocument = require('pdfkit');

const COLORS = { brand: '#1f4e79', text: '#1a1a1a', muted: '#666666', rule: '#d0d7de', band: '#eef3f8', secret: '#8a4b00' };

// Returns a Buffer containing the PDF report.
function renderPdf(report, { title, subtitle, provider, redacted }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, info: { Title: title, Author: provider } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const labelW = Math.round(width * 0.38);

    const ensureSpace = (h) => {
      if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
    };

    // Cover block
    doc.fillColor(COLORS.brand).font('Helvetica-Bold').fontSize(20).text(provider, left, 50);
    doc.moveDown(0.3).fillColor(COLORS.text).fontSize(16).text(title);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text(subtitle);
    if (redacted) {
      doc.moveDown(0.5).fillColor(COLORS.secret).fontSize(9)
        .text('Passwords and other secrets are stored encrypted and are not included in this copy. View them in the secure admin portal.');
    }
    doc.moveDown(1);

    const row = (label, value, secret) => {
      doc.font('Helvetica').fontSize(9.5);
      const h = Math.max(
        doc.heightOfString(label, { width: labelW - 8 }),
        doc.heightOfString(value, { width: width - labelW }),
      ) + 6;
      ensureSpace(h);
      const y = doc.y;
      doc.fillColor(COLORS.muted).text(label, left, y + 3, { width: labelW - 8 });
      doc.fillColor(secret ? COLORS.secret : COLORS.text).text(value, left + labelW, y + 3, { width: width - labelW });
      doc.y = y + h;
      doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
    };

    for (const section of report) {
      ensureSpace(60);
      const y = doc.y;
      doc.rect(left, y, width, 22).fill(COLORS.brand);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text(section.title, left + 8, y + 6, { width: width - 16 });
      doc.y = y + 28;

      if (section.empty) {
        doc.fillColor(COLORS.muted).font('Helvetica-Oblique').fontSize(9.5).text('No information provided.', left, doc.y);
        doc.moveDown(1);
        continue;
      }
      for (const item of section.items) row(item.label, item.value, item.secret);

      for (const table of section.tables) {
        ensureSpace(80);
        doc.moveDown(0.6).fillColor(COLORS.brand).font('Helvetica-Bold').fontSize(10.5).text(table.label, left, doc.y);
        doc.moveDown(0.2);
        table.rows.forEach((cells, i) => {
          ensureSpace(36);
          const by = doc.y;
          doc.rect(left, by, width, 16).fill(COLORS.band);
          doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9).text(`#${i + 1}`, left + 6, by + 4);
          doc.y = by + 18;
          for (const c of cells) row(c.label, c.value, c.secret);
          doc.moveDown(0.4);
        });
      }
      doc.moveDown(1);
    }

    // Footer with page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
        .text(`${title}  |  Page ${i + 1} of ${range.count}  |  CONFIDENTIAL`, left, doc.page.height - 35, { width, align: 'center' });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}

module.exports = { renderPdf };
