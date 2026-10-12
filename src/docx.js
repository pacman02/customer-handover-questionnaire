'use strict';

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, Footer, AlignmentType, PageNumber,
} = require('docx');

const BRAND = '1F4E79';
const border = { style: BorderStyle.SINGLE, size: 4, color: 'D0D7DE' };
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };

const cell = (text, { bold = false, color, shade, width } = {}) => new TableCell({
  width: { size: width, type: WidthType.PERCENTAGE },
  shading: shade ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' } : undefined,
  children: String(text).split('\n').map((line) => new Paragraph({
    children: [new TextRun({ text: line, bold, color, size: 19 })],
  })),
});

function kvTable(cells) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: cells.map((c) => new TableRow({
      children: [
        cell(c.label, { color: '555555', shade: 'F6F8FA', width: 38 }),
        cell(c.value, { color: c.secret ? '8A4B00' : undefined, width: 62 }),
      ],
    })),
  });
}

// Returns a Buffer containing the .docx report.
async function renderDocx(report, { title, subtitle, provider, redacted }) {
  const children = [
    new Paragraph({ children: [new TextRun({ text: provider, bold: true, color: BRAND, size: 36 })] }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title })] }),
    new Paragraph({ children: [new TextRun({ text: subtitle, color: '666666' })] }),
  ];
  if (redacted) {
    children.push(new Paragraph({
      spacing: { before: 120 },
      children: [new TextRun({ text: 'Passwords and other secrets are stored encrypted and are not included in this copy. View them in the secure admin portal.', color: '8A4B00', size: 18 })],
    }));
  }

  for (const section of report) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360 }, children: [new TextRun({ text: section.title, color: BRAND })] }));
    if (section.empty) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'No information provided.', italics: true, color: '666666' })] }));
      continue;
    }
    if (section.items.length) children.push(kvTable(section.items));
    for (const table of section.tables) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240 }, children: [new TextRun({ text: table.label })] }));
      table.rows.forEach((cells, i) => {
        children.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: `#${i + 1}`, bold: true })] }));
        children.push(kvTable(cells));
      });
    }
  }

  const doc = new Document({
    creator: provider,
    title,
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `${title}  |  Page `, size: 16, color: '666666' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '666666' }),
              new TextRun({ text: '  |  CONFIDENTIAL', size: 16, color: '666666' }),
            ],
          })],
        }),
      },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { renderDocx };
