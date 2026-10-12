'use strict';

const { sections } = require('./schema');
const { buildReport: build } = require('./shared/report-core');

const REDACTED = '[stored securely; not included in this copy]';

const buildReport = (answers, opts = {}) => build(sections, answers, { redactedText: REDACTED, ...opts });

function customerName(answers) {
  return (answers.business && answers.business.company_name) || 'Unnamed customer';
}

module.exports = { buildReport, customerName, REDACTED };
