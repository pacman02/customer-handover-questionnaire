'use strict';

// Generates sample PDF and Word reports from made-up data so the layout can be
// checked without filling in the form: node scripts/sample-report.js [outDir]
process.env.DATA_DIR = process.env.DATA_DIR || require('os').tmpdir() + '/handover-sample';
const fs = require('fs');
const path = require('path');
const { buildFiles } = require('../src/server');

const record = {
  id: 'sample000000000a', status: 'submitted', submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  answers: {
    business: {
      company_name: 'Acme Rural Supplies Pty Ltd', abn: '12 345 678 901', staff_count: '18', address: '1 Example St, Tamworth NSW 2340',
      contacts: [{ name: 'Jane Citizen', role: 'Primary contact', phone: '0400 123 456', email: 'jane@example.com.au', can_approve: 'Yes' }],
      sites: [{ name: 'Head office', address: '1 Example St, Tamworth', users: '14' }, { name: 'Depot', address: '5 Sample Rd, Gunnedah', users: '4' }],
    },
    m365: {
      uses_m365: 'Yes', tenant_name: 'acmerural.onmicrosoft.com', billing: 'Through a CSP / reseller', mfa_enforced: 'Yes',
      licences: [{ sku: 'Microsoft 365 Business Premium', qty: '18', term: 'Annual (paid monthly)', renewal: '2027-03-01' }],
      admins: [{ username: 'admin@acmerural.com.au', password: 'example-password', role: 'Global Admin', mfa: 'Authenticator on Jane\'s phone' }],
    },
    domains: { list: [{ domain: 'acmerural.com.au', registrar: 'VentraIP', expiry: '2027-06-30', auto_renew: 'Yes', dns_host: 'Cloudflare', login_pass: 'example' }] },
    apps: { antivirus: 'Microsoft Defender for Business', dns_filter: 'DNSFilter', smtp_relay: 'SMTP2GO',
      list: [{ name: 'SMTP2GO', purpose: 'Scan-to-email relay', qty: '1', renewal: '2027-01-15', admin_user: 'it@acmerural.com.au', admin_pass: 'api-key-example' }] },
    hardware: { firewalls: [{ site: 'Head office', make: 'Fortinet', model: 'FortiGate 40F', serial: 'FGT40FTK00000000', lan_ip: '192.168.10.1', admin_pass: 'example', subscription: 'UTP bundle', sub_expiry: '2027-02-28' }] },
    network: {
      subnets: [{ site: 'Head office', vlan_id: '10', name: 'Staff', subnet: '192.168.10.0/24', gateway: '192.168.10.1', dhcp_server: 'FortiGate', dhcp_range: '.100-.200' },
        { site: 'Head office', vlan_id: '20', name: 'Guest Wi-Fi', subnet: '192.168.20.0/24', gateway: '192.168.20.1' }],
      s2s_vpn: 'Yes', site_vpn: [{ name: 'HQ-Depot', local_site: 'Head office', remote_site: 'Depot', ike: 'IKEv2', phase1: 'AES256 / SHA256 / DH14 / 28800s', psk: 'example' }],
    },
    backups: { jobs: [{ what: 'M365 email (Exchange Online)', product: 'Dropsuite', frequency: 'Daily', retention: 'Unlimited', offsite: 'Yes', last_test: '2026-08-01' }] },
    final: { completed_by: 'Jane Citizen', authorised: ['Yes, I am authorised'] },
  },
};

(async () => {
  const out = path.resolve(process.argv[2] || 'sample-output');
  fs.mkdirSync(out, { recursive: true });
  for (const redact of [true, false]) {
    const files = await buildFiles(record, { redact });
    for (const f of [files.pdf, files.docx]) fs.writeFileSync(path.join(out, f.filename), f.content);
  }
  console.log('Wrote sample reports to', out);
})();
