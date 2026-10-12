'use strict';

const docx = require('docx');
const { buildDocx } = require('./shared/docx-builder');
const { NOTICE } = require('./pdf');

// Returns a Buffer containing the .docx report.
function renderDocx(report, meta) {
  return docx.Packer.toBuffer(buildDocx(docx, report, { ...meta, notice: meta.redacted ? NOTICE : '' }));
}

module.exports = { renderDocx };
