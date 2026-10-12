# New Customer Handover Questionnaire

A web questionnaire for collecting everything needed to take over a new
customer's IT: Microsoft 365, Google Workspace, email security, domains,
websites, internet, phones, third-party subscriptions (SMTP2GO, Adobe,
DNSFilter, antivirus...), firewalls, switches, printers, alarms, CCTV, UPS,
servers and AD, local accounts, network (subnets, VLANs, DHCP reservations,
Wi-Fi, port forwards, remote-access and site-to-site VPNs), file storage,
backups, Azure / AWS, insurances, security and vendor contacts.

When the customer submits, the answers are emailed as a **PDF** and a **Word
document**.

## Two ways to run it

1. **Paste-in version (for sterlingit.com.au).** `dist/handover-form.html` is
   one block of HTML you paste into a page (WordPress Custom HTML block,
   Elementor HTML widget, etc.). `dist/submit.php` is uploaded once to the
   website; it holds the SMTP2GO login and sends the email. See
   [Paste-in version](#paste-in-version) below.
2. **Server version.** A Node.js app with links per customer, server-side
   saving and an admin portal. Described in the rest of this README.

## Paste-in version

- **Saving progress:** answers save in the customer's browser as they type.
  "Save to file" / "Open saved file" lets them move to another computer.
  Answers are cleared from the browser after submitting.
- **Reports:** the PDF and Word documents are generated in the browser, then
  sent to `submit.php`, which emails them through SMTP2GO.
- **Passwords:** the PDF and Word attached to the email have passwords
  removed. Full copies with passwords go in an AES-256 encrypted ZIP attached
  to the same email (open it with 7-Zip or WinRAR). If no ZIP password is
  set, passwords are never emailed.
- **Why the PHP file:** the SMTP password can't be in the page itself; anyone
  can view a page's source and would then be able to send email as you.

### Installing

1. Upload `dist/submit.php` to `public_html/handover/submit.php`.
2. Create `handover-config.php` next to it (or one folder above
   `public_html`) with your settings:

   ```php
   <?php return [
       'smtp_user'    => 'your-smtp2go-username',
       'smtp_pass'    => 'your-smtp2go-password',
       'from_email'   => 'handover@sterlingit.com.au',   // verified sender domain in SMTP2GO
       'to'           => ['support@sterlingit.com.au'],
       'zip_password' => 'a-long-random-password',
   ];
   ```
3. Paste the contents of `dist/handover-form.html` into the page.

To change the questions, edit `src/schema.js` and run
`node scripts/build-embed.js` (set `ENDPOINT` if `submit.php` lives somewhere
other than `/handover/submit.php`).

## How it works (server version)

- **Customer link.** Create a private link in `/admin` (or let customers start
  from the home page). The link carries a secret token after the `#`, so it
  never appears in server logs. The customer can close the page and come back
  with the same link.
- **Autosave.** Answers save automatically every few seconds.
- **Repeatable entries.** Devices, accounts, licences, VPN tunnels and so on
  are added as rows ("+ Add entry").
- **Conditional questions.** Answering "No" to "Do you use Microsoft 365?"
  hides the rest of that section (same for Google, AD, VPNs, cloud, cyber
  insurance).
- **Submit.** Required fields are checked, the questionnaire is locked, and
  the PDF + Word reports are emailed to `MAIL_TO`.
- **Admin portal** (`/admin`, password protected): create links, see status,
  download reports, resend email, reopen a submitted questionnaire, issue a
  new link, delete.

## Credentials

Credentials are the most sensitive thing this form collects, so:

1. Every record is encrypted on disk with AES-256-GCM (`ENCRYPTION_KEY`).
   Nothing is stored in plain text, including the customer name.
2. Password fields are **left out of the emailed PDF / Word** and replaced with
   "[stored securely; not included in this copy]". Email isn't a safe place
   for a customer's domain admin password.
3. Download the **Full PDF / Full Word** from `/admin` when you need them, and
   move them into your password manager / documentation platform.

If you really want passwords in the email, set `EMAIL_INCLUDE_SECRETS=true`
(not recommended).

## Running it

Requires Node.js 20+.

```bash
npm install
cp .env.example .env      # then edit .env
npm run gen-key           # paste the output into ENCRYPTION_KEY
npm start                 # http://localhost:3000
```

Or with Docker:

```bash
docker build -t handover .
docker run -d -p 3000:3000 --env-file .env -v handover-data:/data handover
```

Put it behind HTTPS (nginx / Caddy / Cloudflare Tunnel / Azure App Service) and
set `BASE_URL` to the public address and `TRUST_PROXY=1`.

### Email settings

| Provider | Settings |
| --- | --- |
| SMTP2GO | `SMTP_HOST=mail.smtp2go.com`, `SMTP_PORT=2525` (or 587), SMTP user + password from the SMTP2GO console |
| Microsoft 365 | `SMTP_HOST=smtp.office365.com`, `SMTP_PORT=587`; the sending mailbox needs Authenticated SMTP enabled |

Until SMTP is configured, submissions are still saved and can be downloaded
from `/admin`; the admin list shows why an email wasn't sent.

## Changing the questions

All questions live in [`src/schema.js`](src/schema.js). The form, PDF and Word
document are generated from it, so adding or changing a question there is all
that's needed.

## Development

```bash
npm run dev                          # restarts on file changes
npm test                             # end-to-end test incl. a local SMTP server
node scripts/sample-report.js out    # sample PDF / Word from made-up data
```
