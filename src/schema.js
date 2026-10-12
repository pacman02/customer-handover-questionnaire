'use strict';

/*
 * The questionnaire is defined once here. The browser form, the PDF and the
 * Word document are all rendered from this schema, so adding a question is a
 * one-line change.
 *
 * Field types:
 *   text, email, tel, url, number, date, textarea
 *   select   (options)            radio (options)        checkboxes (options)
 *   yesno    (Yes / No / Unsure)
 *   secret   password-type field; encrypted at rest and redacted from emails
 *   table    repeatable rows; `columns` is a list of fields (no nested tables)
 *
 * `showIf: { field, in: [...] }` hides a field or group until another field in
 * the same section has one of the listed values.
 */

const YESNO = ['Yes', 'No', 'Unsure'];

const sections = [
  {
    id: 'business',
    title: 'Business details',
    intro: 'Who you are and who we should talk to.',
    fields: [
      { id: 'company_name', label: 'Business / trading name', type: 'text', required: true },
      { id: 'legal_name', label: 'Legal entity name (if different)', type: 'text' },
      { id: 'abn', label: 'ABN', type: 'text' },
      { id: 'address', label: 'Main street address', type: 'textarea' },
      { id: 'staff_count', label: 'Number of staff / users', type: 'number' },
      { id: 'industry', label: 'Industry', type: 'text' },
      { id: 'hours', label: 'Business hours', type: 'text', placeholder: 'e.g. Mon-Fri 8:30am-5pm' },
      { id: 'handover_date', label: 'Preferred handover date', type: 'date' },
      { id: 'prev_provider', label: 'Previous IT provider (company and contact)', type: 'textarea' },
      { id: 'prev_provider_status', label: 'Is the previous provider assisting with the handover?', type: 'yesno' },
      {
        id: 'contacts', label: 'Key contacts', type: 'table',
        help: 'Include the primary decision maker, billing contact, after-hours contact and anyone authorised to approve IT changes.',
        columns: [
          { id: 'name', label: 'Name', type: 'text' },
          { id: 'role', label: 'Role', type: 'select', options: ['Primary contact', 'Decision maker', 'Billing / accounts', 'After-hours', 'Site contact', 'Other'] },
          { id: 'phone', label: 'Phone', type: 'tel' },
          { id: 'email', label: 'Email', type: 'email' },
          { id: 'can_approve', label: 'Can approve changes?', type: 'yesno' },
        ],
      },
      {
        id: 'sites', label: 'Sites / offices', type: 'table',
        columns: [
          { id: 'name', label: 'Site name', type: 'text' },
          { id: 'address', label: 'Address', type: 'text' },
          { id: 'users', label: 'Users at site', type: 'number' },
          { id: 'contact', label: 'On-site contact', type: 'text' },
          { id: 'access', label: 'Access notes (keys, alarm, hours)', type: 'text' },
        ],
      },
    ],
  },

  {
    id: 'm365',
    title: 'Microsoft 365',
    intro: 'Tenant, licensing and security configuration.',
    fields: [
      { id: 'uses_m365', label: 'Do you use Microsoft 365?', type: 'yesno' },
      { id: 'tenant_name', label: 'Tenant name (xxx.onmicrosoft.com)', type: 'text', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
      { id: 'tenant_id', label: 'Tenant ID (if known)', type: 'text', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
      { id: 'domains', label: 'Domains added to the tenant', type: 'textarea', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
      { id: 'billing', label: 'How are licences purchased?', type: 'select', options: ['Direct from Microsoft (credit card)', 'Through a CSP / reseller', 'Through previous IT provider', 'Unsure'], showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
      { id: 'csp_name', label: 'CSP / reseller name and partner of record', type: 'text', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
      {
        id: 'licences', label: 'Licences', type: 'table', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] },
        columns: [
          { id: 'sku', label: 'Licence (e.g. Business Premium)', type: 'text' },
          { id: 'qty', label: 'Quantity', type: 'number' },
          { id: 'term', label: 'Term', type: 'select', options: ['Monthly', 'Annual (paid monthly)', 'Annual (paid upfront)', 'Unsure'] },
          { id: 'renewal', label: 'Renewal date', type: 'date' },
        ],
      },
      {
        id: 'admins', label: 'Global / privileged admin accounts', type: 'table', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] },
        help: 'Passwords are encrypted when stored and are not included in emailed reports.',
        columns: [
          { id: 'username', label: 'Username', type: 'text' },
          { id: 'password', label: 'Password', type: 'secret' },
          { id: 'role', label: 'Role', type: 'text', placeholder: 'Global Admin' },
          { id: 'mfa', label: 'MFA method / who holds the device', type: 'text' },
          { id: 'breakglass', label: 'Break-glass account?', type: 'yesno' },
        ],
      },
      { id: 'mfa_enforced', label: 'Is MFA enforced for all users?', type: 'yesno', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
      { id: 'security_defaults', label: 'Security defaults or Conditional Access?', type: 'select', options: ['Security defaults', 'Conditional Access policies', 'Neither', 'Unsure'], showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
      { id: 'entra_connect', label: 'Is Entra Connect (AD sync) in use?', type: 'yesno', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
      { id: 'entra_connect_server', label: 'Entra Connect server name', type: 'text', showIf: { field: 'entra_connect', in: ['Yes'] } },
      { id: 'intune', label: 'Are devices managed with Intune / Autopilot?', type: 'yesno', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
      { id: 'exchange_hybrid', label: 'Any on-premises Exchange or hybrid setup?', type: 'yesno', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
      { id: 'teams_phone', label: 'Teams Phone / calling plans in use?', type: 'yesno', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
      { id: 'shared_mailboxes', label: 'Shared mailboxes, distribution lists, forwarding rules worth noting', type: 'textarea', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
      { id: 'notes', label: 'Other notes', type: 'textarea', showIf: { field: 'uses_m365', in: ['Yes', 'Unsure'] } },
    ],
  },

  {
    id: 'google',
    title: 'Google Workspace',
    intro: 'Only needed if you use Google Workspace (G Suite).',
    fields: [
      { id: 'uses_google', label: 'Do you use Google Workspace?', type: 'yesno' },
      { id: 'primary_domain', label: 'Primary domain', type: 'text', showIf: { field: 'uses_google', in: ['Yes', 'Unsure'] } },
      { id: 'edition', label: 'Edition', type: 'select', options: ['Business Starter', 'Business Standard', 'Business Plus', 'Enterprise', 'Legacy G Suite', 'Unsure'], showIf: { field: 'uses_google', in: ['Yes', 'Unsure'] } },
      { id: 'licence_count', label: 'Number of licences', type: 'number', showIf: { field: 'uses_google', in: ['Yes', 'Unsure'] } },
      { id: 'billing', label: 'Billed direct or via reseller (name)?', type: 'text', showIf: { field: 'uses_google', in: ['Yes', 'Unsure'] } },
      { id: 'renewal', label: 'Renewal date / plan type', type: 'text', showIf: { field: 'uses_google', in: ['Yes', 'Unsure'] } },
      {
        id: 'admins', label: 'Super admin accounts', type: 'table', showIf: { field: 'uses_google', in: ['Yes', 'Unsure'] },
        columns: [
          { id: 'username', label: 'Username', type: 'text' },
          { id: 'password', label: 'Password', type: 'secret' },
          { id: 'mfa', label: '2-Step Verification method / who holds it', type: 'text' },
        ],
      },
      { id: 'two_sv', label: 'Is 2-Step Verification enforced?', type: 'yesno', showIf: { field: 'uses_google', in: ['Yes', 'Unsure'] } },
      { id: 'secondary_domains', label: 'Secondary / alias domains', type: 'textarea', showIf: { field: 'uses_google', in: ['Yes', 'Unsure'] } },
      { id: 'migration', label: 'Any plan to migrate to or from Google Workspace?', type: 'textarea', showIf: { field: 'uses_google', in: ['Yes', 'Unsure'] } },
    ],
  },

  {
    id: 'email',
    title: 'Email security & other mail',
    intro: 'Mail filtering, relays and email hosted elsewhere.',
    fields: [
      { id: 'other_host', label: 'Is any email hosted somewhere other than M365 / Google? (cPanel, ISP, etc.)', type: 'textarea' },
      { id: 'filtering', label: 'Email filtering / archiving product (e.g. Mimecast, Proofpoint, Defender)', type: 'text' },
      { id: 'spf_dkim_dmarc', label: 'SPF, DKIM and DMARC configured?', type: 'select', options: ['All three', 'Some', 'None', 'Unsure'] },
      { id: 'dmarc_reporting', label: 'DMARC reporting service', type: 'text' },
      { id: 'signatures', label: 'Email signature tool (e.g. Exclaimer, CodeTwo)', type: 'text' },
      { id: 'scan_to_email', label: 'How do printers / scanners / apps send email? (SMTP relay, direct send, etc.)', type: 'textarea' },
    ],
  },

  {
    id: 'domains',
    title: 'Domain names & DNS',
    fields: [
      {
        id: 'list', label: 'Domain names', type: 'table',
        columns: [
          { id: 'domain', label: 'Domain', type: 'text' },
          { id: 'registrar', label: 'Registrar (e.g. VentraIP, Crazy Domains)', type: 'text' },
          { id: 'registrant', label: 'Registrant / owner name', type: 'text' },
          { id: 'expiry', label: 'Expiry date', type: 'date' },
          { id: 'auto_renew', label: 'Auto-renew on?', type: 'yesno' },
          { id: 'dns_host', label: 'DNS hosted at (registrar, Cloudflare, web host...)', type: 'text' },
          { id: 'login_user', label: 'Registrar login', type: 'text' },
          { id: 'login_pass', label: 'Registrar password', type: 'secret' },
          { id: 'dns_login', label: 'DNS host login (if different)', type: 'text' },
          { id: 'dns_pass', label: 'DNS host password', type: 'secret' },
        ],
      },
      { id: 'au_eligibility', label: '.com.au eligibility details (ABN the domain is registered against)', type: 'text' },
      { id: 'notes', label: 'Other DNS notes (unusual records, third parties with DNS access)', type: 'textarea' },
    ],
  },

  {
    id: 'websites',
    title: 'Websites',
    fields: [
      {
        id: 'list', label: 'Websites', type: 'table',
        columns: [
          { id: 'url', label: 'Website URL', type: 'url' },
          { id: 'host', label: 'Hosting provider', type: 'text' },
          { id: 'cms', label: 'Platform (WordPress, Shopify, Wix...)', type: 'text' },
          { id: 'developer', label: 'Developer / agency and contact', type: 'text' },
          { id: 'hosting_user', label: 'Hosting login', type: 'text' },
          { id: 'hosting_pass', label: 'Hosting password', type: 'secret' },
          { id: 'cms_user', label: 'Website admin login', type: 'text' },
          { id: 'cms_pass', label: 'Website admin password', type: 'secret' },
          { id: 'ssl', label: 'SSL certificate (provider / expiry)', type: 'text' },
          { id: 'backups', label: 'Website backups (who / how often)', type: 'text' },
          { id: 'renewal', label: 'Hosting renewal date', type: 'date' },
        ],
      },
    ],
  },

  {
    id: 'internet',
    title: 'Internet services',
    fields: [
      {
        id: 'services', label: 'Internet connections', type: 'table',
        help: 'One row per connection, including backup 4G/5G or Starlink links.',
        columns: [
          { id: 'site', label: 'Site', type: 'text' },
          { id: 'isp', label: 'ISP', type: 'text' },
          { id: 'type', label: 'Connection type', type: 'select', options: ['NBN FTTP', 'NBN FTTN / FTTC', 'NBN HFC', 'NBN Fixed Wireless', 'NBN Satellite', 'Business fibre (EFM / Enterprise Ethernet)', '4G / 5G', 'Starlink', 'Other'] },
          { id: 'speed', label: 'Speed plan', type: 'text' },
          { id: 'account', label: 'Account / service number', type: 'text' },
          { id: 'static_ip', label: 'Static IP address(es)', type: 'text' },
          { id: 'pppoe_user', label: 'PPPoE / connection username', type: 'text' },
          { id: 'pppoe_pass', label: 'PPPoE / connection password', type: 'secret' },
          { id: 'portal_user', label: 'ISP portal login', type: 'text' },
          { id: 'portal_pass', label: 'ISP portal password', type: 'secret' },
          { id: 'support', label: 'ISP support phone', type: 'tel' },
          { id: 'contract_end', label: 'Contract end date', type: 'date' },
          { id: 'modem', label: 'Modem / NTD make and model', type: 'text' },
        ],
      },
      { id: 'failover', label: 'Is there automatic failover between connections?', type: 'yesno' },
    ],
  },

  {
    id: 'phones',
    title: 'Phones & telephony',
    fields: [
      { id: 'system_type', label: 'Phone system type', type: 'select', options: ['Hosted VoIP / cloud PBX', 'On-premises PBX', 'Microsoft Teams Phone', 'Mobile only', 'Traditional landlines', 'Other'] },
      { id: 'provider', label: 'Provider / platform (e.g. 3CX, Telstra, Crazy Tel, Maxo)', type: 'text' },
      { id: 'account', label: 'Account number', type: 'text' },
      { id: 'numbers', label: 'Main phone numbers and any 1300 / 1800 numbers', type: 'textarea' },
      { id: 'portal_url', label: 'Admin portal URL', type: 'url' },
      { id: 'portal_user', label: 'Admin portal login', type: 'text' },
      { id: 'portal_pass', label: 'Admin portal password', type: 'secret' },
      { id: 'contract_end', label: 'Contract end date', type: 'date' },
      { id: 'call_flow', label: 'Call flow / IVR / after-hours diversion summary', type: 'textarea' },
      {
        id: 'handsets', label: 'Handsets & devices', type: 'table',
        columns: [
          { id: 'make', label: 'Make', type: 'text' },
          { id: 'model', label: 'Model', type: 'text' },
          { id: 'qty', label: 'Quantity', type: 'number' },
          { id: 'owned', label: 'Owned / leased / rented', type: 'select', options: ['Owned', 'Leased', 'Rented', 'Unsure'] },
          { id: 'notes', label: 'Notes', type: 'text' },
        ],
      },
      { id: 'mobile_carrier', label: 'Mobile carrier and number of mobile services', type: 'text' },
      { id: 'mobile_mdm', label: 'Are company mobiles managed (Intune, Apple Business Manager, etc.)?', type: 'text' },
    ],
  },

  {
    id: 'apps',
    title: 'Third-party apps & subscriptions',
    intro: 'Every service the business pays for or relies on: security tools, relays, design software, line-of-business apps.',
    fields: [
      { id: 'antivirus', label: 'Antivirus / EDR product (e.g. Defender, SentinelOne, Bitdefender, Sophos)', type: 'text' },
      { id: 'dns_filter', label: 'DNS / web filtering (e.g. DNSFilter, Cisco Umbrella)', type: 'text' },
      { id: 'smtp_relay', label: 'SMTP relay service (e.g. SMTP2GO, SendGrid)', type: 'text' },
      { id: 'adobe', label: 'Adobe licences (product, quantity, who owns the Admin Console)', type: 'textarea' },
      { id: 'password_manager', label: 'Password manager (e.g. Bitwarden, Keeper, 1Password)', type: 'text' },
      { id: 'rmm', label: 'Remote support / RMM tools currently installed (to be removed or kept)', type: 'textarea' },
      { id: 'accounting', label: 'Accounting / payroll software (Xero, MYOB, etc.)', type: 'text' },
      { id: 'lob', label: 'Line-of-business / industry-specific applications', type: 'textarea' },
      {
        id: 'list', label: 'Subscription & licence register', type: 'table',
        help: 'Add a row for each service above, plus anything else (Zoom, Canva, DocuSign, CRM, etc.).',
        columns: [
          { id: 'name', label: 'Product / service', type: 'text' },
          { id: 'vendor', label: 'Vendor / reseller', type: 'text' },
          { id: 'purpose', label: 'What it is used for', type: 'text' },
          { id: 'qty', label: 'Licences / seats', type: 'number' },
          { id: 'renewal', label: 'Renewal date', type: 'date' },
          { id: 'cost', label: 'Cost and billing frequency', type: 'text' },
          { id: 'billed_to', label: 'Billed to (card / invoice / IT provider)', type: 'text' },
          { id: 'admin_url', label: 'Admin console URL', type: 'url' },
          { id: 'admin_user', label: 'Admin username', type: 'text' },
          { id: 'admin_pass', label: 'Admin password / API key', type: 'secret' },
          { id: 'notes', label: 'Notes', type: 'text' },
        ],
      },
    ],
  },

  {
    id: 'hardware',
    title: 'Hardware & peripherals',
    intro: 'Make, model, serial and any subscription or support contract for each device.',
    fields: [
      {
        id: 'firewalls', label: 'Firewalls / routers', type: 'table',
        columns: [
          { id: 'site', label: 'Site', type: 'text' },
          { id: 'make', label: 'Make', type: 'text' },
          { id: 'model', label: 'Model', type: 'text' },
          { id: 'serial', label: 'Serial number', type: 'text' },
          { id: 'firmware', label: 'Firmware version', type: 'text' },
          { id: 'lan_ip', label: 'LAN / management IP', type: 'text' },
          { id: 'admin_url', label: 'Admin URL / port', type: 'text' },
          { id: 'admin_user', label: 'Admin username', type: 'text' },
          { id: 'admin_pass', label: 'Admin password', type: 'secret' },
          { id: 'subscription', label: 'Security subscription (e.g. FortiGuard, UTM bundle)', type: 'text' },
          { id: 'sub_expiry', label: 'Subscription / support expiry', type: 'date' },
          { id: 'cloud_mgmt', label: 'Cloud management portal (e.g. FortiCloud, Meraki)', type: 'text' },
        ],
      },
      {
        id: 'switches_wifi', label: 'Switches & wireless access points', type: 'table',
        columns: [
          { id: 'type', label: 'Type', type: 'select', options: ['Switch', 'Wireless AP', 'Wireless controller', 'Other'] },
          { id: 'site', label: 'Site / location', type: 'text' },
          { id: 'make', label: 'Make', type: 'text' },
          { id: 'model', label: 'Model', type: 'text' },
          { id: 'serial', label: 'Serial', type: 'text' },
          { id: 'ip', label: 'Management IP', type: 'text' },
          { id: 'admin_user', label: 'Admin username', type: 'text' },
          { id: 'admin_pass', label: 'Admin password', type: 'secret' },
          { id: 'controller', label: 'Controller / cloud portal (UniFi, Omada, Meraki)', type: 'text' },
          { id: 'licence_expiry', label: 'Licence expiry', type: 'date' },
        ],
      },
      {
        id: 'printers', label: 'Printers, copiers & scanners', type: 'table',
        columns: [
          { id: 'location', label: 'Location', type: 'text' },
          { id: 'make', label: 'Make', type: 'text' },
          { id: 'model', label: 'Model', type: 'text' },
          { id: 'serial', label: 'Serial', type: 'text' },
          { id: 'ip', label: 'IP address', type: 'text' },
          { id: 'ownership', label: 'Owned / leased', type: 'select', options: ['Owned', 'Leased', 'Rented', 'Unsure'] },
          { id: 'supplier', label: 'Supplier / service contract and phone', type: 'text' },
          { id: 'contract_end', label: 'Lease / contract end', type: 'date' },
          { id: 'scan_to', label: 'Scan-to (email, folder, SharePoint)', type: 'text' },
          { id: 'admin_pass', label: 'Admin panel password', type: 'secret' },
        ],
      },
      {
        id: 'security_systems', label: 'Security / alarm systems & access control', type: 'table',
        columns: [
          { id: 'site', label: 'Site', type: 'text' },
          { id: 'make', label: 'Make / model', type: 'text' },
          { id: 'installer', label: 'Installer / service company', type: 'text' },
          { id: 'monitoring', label: 'Monitoring company and account no.', type: 'text' },
          { id: 'network', label: 'Network connected? (IP)', type: 'text' },
          { id: 'app', label: 'App / remote access', type: 'text' },
          { id: 'codes', label: 'Master / installer codes', type: 'secret' },
          { id: 'contract_end', label: 'Contract end', type: 'date' },
        ],
      },
      {
        id: 'cctv', label: 'CCTV', type: 'table',
        columns: [
          { id: 'site', label: 'Site', type: 'text' },
          { id: 'nvr', label: 'NVR / DVR make and model', type: 'text' },
          { id: 'cameras', label: 'Number of cameras', type: 'number' },
          { id: 'ip', label: 'NVR IP address', type: 'text' },
          { id: 'remote', label: 'Remote viewing app / cloud service', type: 'text' },
          { id: 'admin_user', label: 'Admin username', type: 'text' },
          { id: 'admin_pass', label: 'Admin password', type: 'secret' },
          { id: 'retention', label: 'Recording retention (days)', type: 'number' },
          { id: 'installer', label: 'Installer / support company', type: 'text' },
        ],
      },
      {
        id: 'ups', label: 'UPS / power protection', type: 'table',
        columns: [
          { id: 'location', label: 'Location', type: 'text' },
          { id: 'make', label: 'Make / model', type: 'text' },
          { id: 'protects', label: 'What it protects', type: 'text' },
          { id: 'battery_date', label: 'Battery last replaced', type: 'date' },
          { id: 'managed', label: 'Network card / shutdown software?', type: 'text' },
        ],
      },
      {
        id: 'other', label: 'Other devices (NAS, IoT, door intercoms, TVs, meeting room kit...)', type: 'table',
        columns: [
          { id: 'device', label: 'Device', type: 'text' },
          { id: 'make', label: 'Make / model', type: 'text' },
          { id: 'serial', label: 'Serial', type: 'text' },
          { id: 'ip', label: 'IP address', type: 'text' },
          { id: 'subscription', label: 'Subscription / support contract', type: 'text' },
          { id: 'admin_user', label: 'Login', type: 'text' },
          { id: 'admin_pass', label: 'Password', type: 'secret' },
        ],
      },
    ],
  },

  {
    id: 'servers',
    title: 'Servers, domain & computers',
    fields: [
      {
        id: 'servers', label: 'Servers (physical and virtual, on-site)', type: 'table',
        columns: [
          { id: 'name', label: 'Server name', type: 'text' },
          { id: 'role', label: 'Roles (DC, file, print, app, SQL, Hyper-V host...)', type: 'text' },
          { id: 'os', label: 'Operating system', type: 'text' },
          { id: 'kind', label: 'Physical / virtual', type: 'select', options: ['Physical', 'Virtual (Hyper-V)', 'Virtual (VMware)', 'Other'] },
          { id: 'make', label: 'Make / model', type: 'text' },
          { id: 'serial', label: 'Serial / service tag', type: 'text' },
          { id: 'warranty', label: 'Warranty expiry', type: 'date' },
          { id: 'ip', label: 'IP address', type: 'text' },
          { id: 'location', label: 'Location', type: 'text' },
          { id: 'remote_mgmt', label: 'iDRAC / iLO IP', type: 'text' },
          { id: 'remote_mgmt_pass', label: 'iDRAC / iLO password', type: 'secret' },
        ],
      },
      { id: 'ad_used', label: 'Is there an Active Directory domain?', type: 'yesno' },
      { id: 'ad_domain', label: 'AD domain name (e.g. company.local)', type: 'text', showIf: { field: 'ad_used', in: ['Yes', 'Unsure'] } },
      { id: 'ad_netbios', label: 'NetBIOS name', type: 'text', showIf: { field: 'ad_used', in: ['Yes', 'Unsure'] } },
      { id: 'ad_dcs', label: 'Domain controllers', type: 'text', showIf: { field: 'ad_used', in: ['Yes', 'Unsure'] } },
      { id: 'ad_level', label: 'Forest / domain functional level', type: 'text', showIf: { field: 'ad_used', in: ['Yes', 'Unsure'] } },
      { id: 'dsrm', label: 'DSRM (Directory Services Restore Mode) password', type: 'secret', showIf: { field: 'ad_used', in: ['Yes', 'Unsure'] } },
      {
        id: 'domain_admins', label: 'Domain admin & service accounts', type: 'table', showIf: { field: 'ad_used', in: ['Yes', 'Unsure'] },
        columns: [
          { id: 'username', label: 'Username (DOMAIN\\user)', type: 'text' },
          { id: 'password', label: 'Password', type: 'secret' },
          { id: 'purpose', label: 'Purpose (admin, backup service, scan-to-folder...)', type: 'text' },
          { id: 'notes', label: 'Notes', type: 'text' },
        ],
      },
      {
        id: 'server_local', label: 'Server local administrator / root accounts', type: 'table',
        columns: [
          { id: 'server', label: 'Server / hypervisor', type: 'text' },
          { id: 'username', label: 'Username', type: 'text' },
          { id: 'password', label: 'Password', type: 'secret' },
        ],
      },
      { id: 'pc_count', label: 'Number of desktops / laptops', type: 'number' },
      { id: 'pc_join', label: 'How are computers joined?', type: 'checkboxes', options: ['AD domain joined', 'Entra ID (Azure AD) joined', 'Hybrid joined', 'Workgroup / not joined', 'Mac', 'Unsure'] },
      { id: 'laps', label: 'Is Windows LAPS (or similar) managing local admin passwords?', type: 'yesno' },
      {
        id: 'pc_local', label: 'Desktop / laptop local accounts', type: 'table',
        help: 'If every computer uses the same local admin account, one row with "All computers" is fine.',
        columns: [
          { id: 'device', label: 'Computer name (or "All computers")', type: 'text' },
          { id: 'user', label: 'Assigned user', type: 'text' },
          { id: 'username', label: 'Local account username', type: 'text' },
          { id: 'password', label: 'Password', type: 'secret' },
          { id: 'bitlocker', label: 'BitLocker / FileVault on? Where are recovery keys?', type: 'text' },
        ],
      },
      {
        id: 'pcs', label: 'Computer inventory (optional; we can also gather this with our tools)', type: 'table',
        columns: [
          { id: 'name', label: 'Computer name', type: 'text' },
          { id: 'user', label: 'User', type: 'text' },
          { id: 'make', label: 'Make / model', type: 'text' },
          { id: 'serial', label: 'Serial', type: 'text' },
          { id: 'os', label: 'Operating system', type: 'text' },
          { id: 'purchased', label: 'Purchase / warranty date', type: 'date' },
        ],
      },
    ],
  },

  {
    id: 'network',
    title: 'Network',
    intro: 'IP addressing, VLANs, reservations, Wi-Fi and VPNs. Attach exports or diagrams to the email afterwards if easier.',
    fields: [
      {
        id: 'subnets', label: 'Subnets & VLANs', type: 'table',
        columns: [
          { id: 'site', label: 'Site', type: 'text' },
          { id: 'vlan_id', label: 'VLAN ID', type: 'number' },
          { id: 'name', label: 'Name / purpose', type: 'text' },
          { id: 'subnet', label: 'Subnet (CIDR)', type: 'text', placeholder: '192.168.1.0/24' },
          { id: 'gateway', label: 'Gateway', type: 'text' },
          { id: 'dhcp_server', label: 'DHCP server', type: 'text' },
          { id: 'dhcp_range', label: 'DHCP range', type: 'text' },
          { id: 'dns', label: 'DNS servers', type: 'text' },
        ],
      },
      {
        id: 'reservations', label: 'DHCP reservations & static IPs', type: 'table',
        columns: [
          { id: 'device', label: 'Device', type: 'text' },
          { id: 'ip', label: 'IP address', type: 'text' },
          { id: 'mac', label: 'MAC address', type: 'text' },
          { id: 'kind', label: 'Reservation / static', type: 'select', options: ['DHCP reservation', 'Static', 'Unsure'] },
          { id: 'notes', label: 'Notes', type: 'text' },
        ],
      },
      {
        id: 'wifi', label: 'Wi-Fi networks', type: 'table',
        columns: [
          { id: 'ssid', label: 'SSID', type: 'text' },
          { id: 'purpose', label: 'Purpose (staff, guest, IoT)', type: 'text' },
          { id: 'vlan', label: 'VLAN', type: 'text' },
          { id: 'security', label: 'Security', type: 'select', options: ['WPA2-Personal', 'WPA3-Personal', 'WPA2/3-Enterprise (RADIUS)', 'Open / captive portal', 'Unsure'] },
          { id: 'password', label: 'Password', type: 'secret' },
        ],
      },
      { id: 'public_ips', label: 'Public IP addresses in use', type: 'textarea' },
      {
        id: 'port_forwards', label: 'Port forwards / NAT rules / published services', type: 'table',
        columns: [
          { id: 'service', label: 'Service', type: 'text' },
          { id: 'external', label: 'External IP:port', type: 'text' },
          { id: 'internal', label: 'Internal IP:port', type: 'text' },
          { id: 'restricted', label: 'Restricted to source IPs?', type: 'text' },
        ],
      },
      { id: 'internal_dns', label: 'Internal DNS (AD DNS, forwarders, split DNS)', type: 'textarea' },
      { id: 'ra_vpn', label: 'Is remote-access VPN in use?', type: 'yesno' },
      {
        id: 'remote_vpn', label: 'Remote-access VPN', type: 'table', showIf: { field: 'ra_vpn', in: ['Yes', 'Unsure'] },
        columns: [
          { id: 'type', label: 'Type', type: 'select', options: ['SSL VPN', 'IPSec (IKEv2)', 'IPSec (IKEv1 / L2TP)', 'WireGuard', 'OpenVPN', 'Always On VPN', 'ZTNA', 'Other'] },
          { id: 'product', label: 'Gateway product (e.g. FortiGate, SonicWall)', type: 'text' },
          { id: 'client', label: 'Client software (FortiClient, GlobalProtect...)', type: 'text' },
          { id: 'address', label: 'Server address / FQDN and port', type: 'text' },
          { id: 'auth', label: 'Authentication (local, AD/LDAP, RADIUS, SAML, MFA)', type: 'text' },
          { id: 'pool', label: 'Client IP pool', type: 'text' },
          { id: 'split', label: 'Split or full tunnel', type: 'select', options: ['Split tunnel', 'Full tunnel', 'Unsure'] },
          { id: 'psk', label: 'Pre-shared key / certificate password', type: 'secret' },
          { id: 'users', label: 'Who uses it', type: 'text' },
        ],
      },
      { id: 's2s_vpn', label: 'Are there site-to-site VPNs?', type: 'yesno' },
      {
        id: 'site_vpn', label: 'Site-to-site VPN tunnels', type: 'table', showIf: { field: 's2s_vpn', in: ['Yes', 'Unsure'] },
        columns: [
          { id: 'name', label: 'Tunnel name', type: 'text' },
          { id: 'local_site', label: 'Local site / device', type: 'text' },
          { id: 'remote_site', label: 'Remote site / device (or Azure, AWS)', type: 'text' },
          { id: 'local_peer', label: 'Local peer public IP', type: 'text' },
          { id: 'remote_peer', label: 'Remote peer public IP', type: 'text' },
          { id: 'local_subnets', label: 'Local subnets', type: 'text' },
          { id: 'remote_subnets', label: 'Remote subnets', type: 'text' },
          { id: 'ike', label: 'IKE version', type: 'select', options: ['IKEv1', 'IKEv2', 'Unsure'] },
          { id: 'phase1', label: 'Phase 1 (encryption / hash / DH group / lifetime)', type: 'text' },
          { id: 'phase2', label: 'Phase 2 (encryption / hash / PFS / lifetime)', type: 'text' },
          { id: 'psk', label: 'Pre-shared key', type: 'secret' },
        ],
      },
      { id: 'diagram', label: 'Is there an existing network diagram? Where is it?', type: 'textarea' },
    ],
  },

  {
    id: 'storage',
    title: 'Files & document storage',
    fields: [
      {
        id: 'where', label: 'Where are files and documents stored? (tick all that apply)', type: 'checkboxes',
        options: ['On-premises file server', 'NAS (Synology, QNAP...)', 'SharePoint', 'OneDrive', 'Microsoft Teams', 'Google Drive', 'Dropbox', 'Box', 'Local computers only', 'USB / external drives', 'Other'],
      },
      {
        id: 'locations', label: 'Storage locations', type: 'table',
        columns: [
          { id: 'location', label: 'Location (server share, SharePoint site, Dropbox...)', type: 'text' },
          { id: 'contents', label: 'What is stored there', type: 'text' },
          { id: 'size', label: 'Approx. size', type: 'text' },
          { id: 'access', label: 'Who has access', type: 'text' },
          { id: 'account', label: 'Account owner / admin login', type: 'text' },
          { id: 'password', label: 'Password', type: 'secret' },
        ],
      },
      { id: 'mapped_drives', label: 'Mapped drives (letter, path, how they are mapped)', type: 'textarea' },
      { id: 'permissions', label: 'How are folder permissions managed? Any sensitive areas (HR, finance)?', type: 'textarea' },
      { id: 'sync', label: 'Any sync tools in use (OneDrive sync of SharePoint, Dropbox client, etc.)?', type: 'textarea' },
      { id: 'plans', label: 'Any plans to change where files are stored?', type: 'textarea' },
    ],
  },

  {
    id: 'backups',
    title: 'Backups',
    intro: 'For each thing that is (or should be) backed up: email, SharePoint / OneDrive, servers, desktops, cloud servers.',
    fields: [
      {
        id: 'jobs', label: 'Backups', type: 'table',
        columns: [
          { id: 'what', label: 'What is backed up', type: 'select', options: ['M365 email (Exchange Online)', 'SharePoint / OneDrive / Teams', 'Google Workspace', 'Servers', 'Desktops / laptops', 'NAS', 'Cloud servers (Azure / AWS)', 'Line-of-business app / database', 'Website', 'Other'] },
          { id: 'product', label: 'Backup product (Datto, Veeam, Acronis, Dropsuite...)', type: 'text' },
          { id: 'scope', label: 'Scope (which servers / mailboxes)', type: 'text' },
          { id: 'frequency', label: 'Frequency', type: 'text' },
          { id: 'retention', label: 'Retention', type: 'text' },
          { id: 'destination', label: 'Destination (local, cloud, USB rotation...)', type: 'text' },
          { id: 'offsite', label: 'Offsite / immutable copy?', type: 'yesno' },
          { id: 'encrypted', label: 'Encrypted?', type: 'yesno' },
          { id: 'last_test', label: 'Last restore test', type: 'date' },
          { id: 'alerts', label: 'Who receives success / failure alerts', type: 'text' },
          { id: 'console', label: 'Console URL / login', type: 'text' },
          { id: 'password', label: 'Password / encryption key', type: 'secret' },
        ],
      },
      { id: 'no_backup', label: 'Is there anything you know is NOT backed up?', type: 'textarea' },
      { id: 'dr_plan', label: 'Is there a documented disaster recovery / business continuity plan?', type: 'yesno' },
      { id: 'rto', label: 'How long could the business operate without its systems? (hours / days)', type: 'text' },
    ],
  },

  {
    id: 'cloud',
    title: 'Cloud servers (Azure, AWS, other)',
    fields: [
      { id: 'uses_cloud', label: 'Do you run any servers or services in Azure, AWS or another cloud?', type: 'yesno' },
      { id: 'providers', label: 'Which providers?', type: 'checkboxes', options: ['Microsoft Azure', 'AWS', 'Google Cloud', 'Hosted / VPS provider', 'Other'], showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      { id: 'subscriptions', label: 'Subscription / account IDs and names', type: 'textarea', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      { id: 'billing', label: 'Billing model (CSP, pay-as-you-go card, EA) and who pays', type: 'text', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      { id: 'monthly_cost', label: 'Approximate monthly cost', type: 'text', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      {
        id: 'admins', label: 'Owner / admin accounts', type: 'table', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] },
        columns: [
          { id: 'username', label: 'Username', type: 'text' },
          { id: 'password', label: 'Password', type: 'secret' },
          { id: 'role', label: 'Role (Owner, Contributor, root)', type: 'text' },
          { id: 'mfa', label: 'MFA / who holds it', type: 'text' },
        ],
      },
      {
        id: 'vms', label: 'Virtual machines', type: 'table', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] },
        columns: [
          { id: 'name', label: 'VM name', type: 'text' },
          { id: 'role', label: 'Role', type: 'text' },
          { id: 'os', label: 'OS', type: 'text' },
          { id: 'size', label: 'Size / SKU', type: 'text' },
          { id: 'region', label: 'Region', type: 'text' },
          { id: 'rg', label: 'Resource group', type: 'text' },
          { id: 'private_ip', label: 'Private IP', type: 'text' },
          { id: 'public_ip', label: 'Public IP', type: 'text' },
          { id: 'reserved', label: 'Reserved instance / savings plan?', type: 'text' },
          { id: 'schedule', label: 'Auto-shutdown schedule', type: 'text' },
        ],
      },
      { id: 'vnets', label: 'Virtual networks and address spaces', type: 'textarea', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      { id: 'connectivity', label: 'Connectivity to the office', type: 'select', options: ['Site-to-site VPN gateway', 'ExpressRoute / Direct Connect', 'Point-to-site VPN only', 'Public access only', 'Unsure'], showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      { id: 'nsg', label: 'Firewalls / NSGs / security groups (inbound rules open to the internet?)', type: 'textarea', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      { id: 'identity', label: 'Identity in the cloud (Entra Domain Services, DC VM, none)', type: 'text', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      { id: 'storage', label: 'Storage accounts / file shares / S3 buckets', type: 'textarea', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      { id: 'avd', label: 'Azure Virtual Desktop / Windows 365 / RDS in use?', type: 'text', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      { id: 'backup', label: 'Cloud backup / Site Recovery vaults', type: 'text', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      { id: 'keyvault', label: 'Key Vaults / secrets managers', type: 'text', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      { id: 'monitoring', label: 'Monitoring, alerts and budget alerts configured?', type: 'text', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
      { id: 'other_services', label: 'Other cloud services (App Services, SQL databases, functions, etc.)', type: 'textarea', showIf: { field: 'uses_cloud', in: ['Yes', 'Unsure'] } },
    ],
  },

  {
    id: 'insurance',
    title: 'Insurances & warranties',
    fields: [
      { id: 'has_cyber', label: 'Do you have cyber insurance?', type: 'yesno' },
      { id: 'cyber_insurer', label: 'Insurer and broker (with contact)', type: 'text', showIf: { field: 'has_cyber', in: ['Yes', 'Unsure'] } },
      { id: 'cyber_policy', label: 'Policy number', type: 'text', showIf: { field: 'has_cyber', in: ['Yes', 'Unsure'] } },
      { id: 'cyber_renewal', label: 'Renewal date', type: 'date', showIf: { field: 'has_cyber', in: ['Yes', 'Unsure'] } },
      { id: 'cyber_requirements', label: 'Security requirements in the policy (MFA, EDR, backups, training...)', type: 'textarea', showIf: { field: 'has_cyber', in: ['Yes', 'Unsure'] } },
      { id: 'cyber_hotline', label: 'Incident response hotline', type: 'tel', showIf: { field: 'has_cyber', in: ['Yes', 'Unsure'] } },
      {
        id: 'other', label: 'Other relevant insurances', type: 'table',
        help: 'Business / equipment / professional indemnity policies that cover IT equipment or data.',
        columns: [
          { id: 'type', label: 'Type', type: 'text' },
          { id: 'insurer', label: 'Insurer / broker', type: 'text' },
          { id: 'policy', label: 'Policy number', type: 'text' },
          { id: 'renewal', label: 'Renewal date', type: 'date' },
        ],
      },
      { id: 'warranties', label: 'Hardware warranties or support contracts not listed elsewhere', type: 'textarea' },
    ],
  },

  {
    id: 'security',
    title: 'Security & compliance',
    fields: [
      { id: 'incidents', label: 'Any security incidents or breaches in the last 3 years?', type: 'textarea' },
      { id: 'training', label: 'Security awareness training in place?', type: 'yesno' },
      { id: 'essential8', label: 'Assessed against Essential Eight or other framework?', type: 'text' },
      { id: 'compliance', label: 'Compliance obligations (Privacy Act, health records, PCI, etc.)', type: 'textarea' },
      { id: 'policies', label: 'Existing IT policies (acceptable use, BYOD, password)', type: 'textarea' },
      {
        id: 'other_creds', label: 'Any other credentials we will need', type: 'table',
        columns: [
          { id: 'system', label: 'System / service', type: 'text' },
          { id: 'url', label: 'URL / address', type: 'text' },
          { id: 'username', label: 'Username', type: 'text' },
          { id: 'password', label: 'Password', type: 'secret' },
          { id: 'mfa', label: 'MFA / who holds it', type: 'text' },
          { id: 'notes', label: 'Notes', type: 'text' },
        ],
      },
    ],
  },

  {
    id: 'vendors',
    title: 'Vendors & support contacts',
    fields: [
      {
        id: 'list', label: 'Other suppliers we may need to deal with', type: 'table',
        columns: [
          { id: 'company', label: 'Company', type: 'text' },
          { id: 'service', label: 'What they provide', type: 'text' },
          { id: 'contact', label: 'Contact name', type: 'text' },
          { id: 'phone', label: 'Phone', type: 'tel' },
          { id: 'email', label: 'Email', type: 'email' },
          { id: 'account', label: 'Account / customer number', type: 'text' },
        ],
      },
    ],
  },

  {
    id: 'final',
    title: 'Anything else',
    fields: [
      { id: 'known_issues', label: 'Known problems or frustrations with your IT today', type: 'textarea' },
      { id: 'projects', label: 'Upcoming projects or changes (moves, new staff, new software)', type: 'textarea' },
      { id: 'notes', label: 'Anything else we should know', type: 'textarea' },
      { id: 'completed_by', label: 'Completed by (name)', type: 'text', required: true },
      { id: 'completed_email', label: 'Your email', type: 'email' },
      { id: 'authorised', label: 'I confirm I am authorised to share this information with {{provider}}', type: 'checkboxes', options: ['Yes, I am authorised'], required: true },
    ],
  },
];

const { isFieldVisible: isVisible } = require('./shared/report-core');

module.exports = { sections, isVisible };
