// Builds the PDF report with jsPDF. Shared by the Node server and the paste-in
// browser form; pass in the jsPDF constructor.

/* exported buildPdf */

function buildPdf(JsPDF, report, meta) {
  var C = { brand: '#1f4e79', text: '#1a1a1a', muted: '#666666', rule: '#d0d7de', band: '#eef3f8', secret: '#8a4b00' };
  var doc = new JsPDF({ unit: 'pt', format: 'a4' });
  doc.setProperties({ title: meta.title, author: meta.provider });
  var pageW = doc.internal.pageSize.getWidth();
  var pageH = doc.internal.pageSize.getHeight();
  var M = 50;
  var width = pageW - M * 2;
  var labelW = Math.round(width * 0.38);
  var y = M;

  function font(style, size, color) {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color);
  }
  function lineH(size) { return size * 1.2; }
  function ensure(h) {
    if (y + h > pageH - M) { doc.addPage(); y = M; }
  }
  function para(text, style, size, color, gap) {
    font(style, size, color);
    var lines = doc.splitTextToSize(String(text), width);
    ensure(lines.length * lineH(size));
    doc.text(lines, M, y, { baseline: 'top' });
    y += lines.length * lineH(size) + (gap || 0);
  }
  function row(label, value, secret) {
    font('normal', 9.5, C.muted);
    var l = doc.splitTextToSize(String(label), labelW - 8);
    var v = doc.splitTextToSize(String(value), width - labelW);
    var h = Math.max(l.length, v.length) * lineH(9.5) + 6;
    ensure(h);
    doc.text(l, M, y + 3, { baseline: 'top' });
    doc.setTextColor(secret ? C.secret : C.text);
    doc.text(v, M + labelW, y + 3, { baseline: 'top' });
    y += h;
    doc.setDrawColor(C.rule);
    doc.setLineWidth(0.5);
    doc.line(M, y, M + width, y);
  }

  para(meta.provider, 'bold', 20, C.brand, 4);
  para(meta.title, 'bold', 16, C.text, 2);
  para(meta.subtitle, 'normal', 10, C.muted, 6);
  if (meta.notice) para(meta.notice, 'normal', 9, C.secret, 0);
  y += 14;

  report.forEach(function (section) {
    ensure(60);
    doc.setFillColor(C.brand);
    doc.rect(M, y, width, 22, 'F');
    font('bold', 12, '#ffffff');
    doc.text(section.title, M + 8, y + 6, { baseline: 'top' });
    y += 28;

    if (section.empty) {
      para('No information provided.', 'italic', 9.5, C.muted, 14);
      return;
    }
    section.items.forEach(function (it) { row(it.label, it.value, it.secret); });
    section.tables.forEach(function (table) {
      ensure(80);
      y += 8;
      para(table.label, 'bold', 10.5, C.brand, 3);
      table.rows.forEach(function (cells, i) {
        ensure(36);
        doc.setFillColor(C.band);
        doc.rect(M, y, width, 16, 'F');
        font('bold', 9, C.text);
        doc.text('#' + (i + 1), M + 6, y + 4, { baseline: 'top' });
        y += 18;
        cells.forEach(function (c) { row(c.label, c.value, c.secret); });
        y += 6;
      });
    });
    y += 14;
  });

  var pages = doc.getNumberOfPages();
  for (var i = 1; i <= pages; i++) {
    doc.setPage(i);
    font('normal', 8, C.muted);
    doc.text(meta.title + '  |  Page ' + i + ' of ' + pages + '  |  CONFIDENTIAL', pageW / 2, pageH - 30, { align: 'center' });
  }
  return doc;
}

if (typeof module !== 'undefined') module.exports = { buildPdf: buildPdf };
