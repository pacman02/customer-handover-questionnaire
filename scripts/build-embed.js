'use strict';

// Builds the paste-in snippet (dist/handover-form.html) from the shared schema
// and builders, so the paste-in form and the server version never drift apart.
//
//   node scripts/build-embed.js
//   ENDPOINT=/handover/submit.php COMPANY_NAME="Sterling iT" node scripts/build-embed.js

const fs = require('fs');
const path = require('path');
const { sections } = require('../src/schema');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const stripModule = (src) => src.replace(/^if \(typeof module !== 'undefined'\).*$/m, '');

const config = {
  provider: process.env.COMPANY_NAME || 'Sterling iT',
  endpoint: process.env.ENDPOINT || '/handover/submit.php',
};

// Library versions are pinned; the same versions are used by the test suite.
const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
const DOCX = 'https://cdn.jsdelivr.net/npm/docx@9.5.1/dist/index.iife.js';

const js = [
  `var CONFIG = ${JSON.stringify(config)};`,
  `var SECTIONS = ${JSON.stringify(sections)};`,
  stripModule(read('src/shared/report-core.js')),
  stripModule(read('src/shared/pdf-builder.js')),
  stripModule(read('src/shared/docx-builder.js')),
  read('embed/src/embed.js'),
].join('\n');

// Page builders (WordPress especially) can mangle blank lines inside a Custom
// HTML block, so drop them. "</" is escaped so no string can close the script tag.
const compact = (s) => s.split('\n').filter((l) => l.trim() !== '').join('\n');
const out = [
  `<!-- ${config.provider} new customer handover questionnaire. Paste this whole block into a Custom HTML block. -->`,
  '<div id="sit-handover"></div>',
  `<style>\n${compact(read('embed/src/embed.css'))}\n</style>`,
  `<script src="${JSPDF}"></script>`,
  `<script src="${DOCX}"></script>`,
  `<script>\n(function () {\n'use strict';\n${compact(js).replace(/<\//g, '<\\/')}\n})();\n</script>`,
].join('\n');

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'handover-form.html'), out + '\n');
fs.copyFileSync(path.join(ROOT, 'embed', 'submit.php'), path.join(ROOT, 'dist', 'submit.php'));
console.log(`Wrote dist/handover-form.html (${Math.round(out.length / 1024)} KB) and dist/submit.php`);
