// Builds the Word report with the `docx` library. Shared by the Node server and
// the paste-in browser form; pass in the docx module (window.docx in browsers).

/* exported buildDocx */

function buildDocx(D, report, meta) {
  var BRAND = '1F4E79';
  var border = { style: D.BorderStyle.SINGLE, size: 4, color: 'D0D7DE' };
  var borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };

  function cell(text, o) {
    return new D.TableCell({
      width: { size: o.width, type: D.WidthType.PERCENTAGE },
      shading: o.shade ? { type: D.ShadingType.CLEAR, fill: o.shade, color: 'auto' } : undefined,
      children: String(text).split('\n').map(function (line) {
        return new D.Paragraph({ children: [new D.TextRun({ text: line, color: o.color, size: 19 })] });
      }),
    });
  }
  function kvTable(cells) {
    return new D.Table({
      width: { size: 100, type: D.WidthType.PERCENTAGE },
      borders: borders,
      rows: cells.map(function (c) {
        return new D.TableRow({
          children: [
            cell(c.label, { color: '555555', shade: 'F6F8FA', width: 38 }),
            cell(c.value, { color: c.secret ? '8A4B00' : undefined, width: 62 }),
          ],
        });
      }),
    });
  }
  function text(t, o) { return new D.TextRun(Object.assign({ text: t }, o || {})); }

  var children = [
    new D.Paragraph({ children: [text(meta.provider, { bold: true, color: BRAND, size: 36 })] }),
    new D.Paragraph({ children: [text(meta.title, { bold: true, size: 40 })] }),
    new D.Paragraph({ children: [text(meta.subtitle, { color: '666666' })] }),
  ];
  if (meta.notice) {
    children.push(new D.Paragraph({ spacing: { before: 120 }, children: [text(meta.notice, { color: '8A4B00', size: 18 })] }));
  }

  report.forEach(function (section) {
    children.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, spacing: { before: 360 }, children: [text(section.title, { color: BRAND })] }));
    if (section.empty) {
      children.push(new D.Paragraph({ children: [text('No information provided.', { italics: true, color: '666666' })] }));
      return;
    }
    if (section.items.length) children.push(kvTable(section.items));
    section.tables.forEach(function (table) {
      children.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_2, spacing: { before: 240 }, children: [text(table.label)] }));
      table.rows.forEach(function (cells, i) {
        children.push(new D.Paragraph({ spacing: { before: 120, after: 40 }, children: [text('#' + (i + 1), { bold: true })] }));
        children.push(kvTable(cells));
      });
    });
  });

  return new D.Document({
    creator: meta.provider,
    title: meta.title,
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
      footers: {
        default: new D.Footer({
          children: [new D.Paragraph({
            alignment: D.AlignmentType.CENTER,
            children: [
              text(meta.title + '  |  Page ', { size: 16, color: '666666' }),
              new D.TextRun({ children: [D.PageNumber.CURRENT], size: 16, color: '666666' }),
              text('  |  CONFIDENTIAL', { size: 16, color: '666666' }),
            ],
          })],
        }),
      },
      children: children,
    }],
  });
}

if (typeof module !== 'undefined') module.exports = { buildDocx: buildDocx };
