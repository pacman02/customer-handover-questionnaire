<?php
/*
 * Mail handler for the paste-in handover questionnaire.
 *
 * Upload this file to your website (e.g. public_html/handover/submit.php).
 * It receives the PDF and Word reports from the form and emails them through
 * SMTP2GO, so the SMTP password never appears in the web page.
 *
 * Settings can be edited below, or put in a file called handover-config.php
 * in the same folder (or the folder above public_html) that returns an array
 * with the same keys. That keeps the password out of this file.
 */

$CONFIG = [
    // SMTP2GO: mail.smtp2go.com, port 2525 (or 587), 'starttls'.
    // Microsoft 365: smtp.office365.com, port 587, 'starttls'.
    'smtp_host'   => 'mail.smtp2go.com',
    'smtp_port'   => 2525,
    'smtp_secure' => 'starttls',       // 'starttls', 'ssl' (port 465) or 'none'
    'smtp_user'   => '',
    'smtp_pass'   => '',

    // Sender must be on a domain verified in SMTP2GO.
    'from_email'  => 'handover@sterlingit.com.au',
    'from_name'   => 'Sterling iT Handover Form',
    'to'          => ['support@sterlingit.com.au'],

    // Password for the encrypted ZIP holding the copies that include passwords.
    // Open it with 7-Zip or WinRAR (AES-256). Leave blank to never email passwords.
    'zip_password' => '',

    // Only pages on these sites may submit.
    'allowed_origins' => ['https://sterlingit.com.au', 'https://www.sterlingit.com.au'],

    'max_upload_mb'        => 20,
    'max_per_hour_per_ip'  => 10,
];

foreach ([__DIR__ . '/handover-config.php', dirname(__DIR__) . '/handover-config.php', dirname(__DIR__, 2) . '/handover-config.php'] as $f) {
    if (is_file($f)) { $CONFIG = array_merge($CONFIG, (array) require $f); break; }
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond($code, $data) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

// ---- request checks ---------------------------------------------------------
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    if (!in_array(rtrim($origin, '/'), $CONFIG['allowed_origins'], true)) respond(403, ['ok' => false, 'error' => 'This form can only be used on our website.']);
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST');
    respond(204, []);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(405, ['ok' => false, 'error' => 'POST only.']);

// Honeypot: real people never fill this in. Pretend success to bots.
if (!empty($_POST['website'])) respond(200, ['ok' => true]);

// Simple per-IP rate limit using a temp file.
$ipKey = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . __FILE__);
$rlFile = sys_get_temp_dir() . '/sit-handover-' . $ipKey;
$now = time();
$hits = array_filter(is_file($rlFile) ? (array) json_decode((string) file_get_contents($rlFile), true) : [], function ($t) use ($now) { return $t > $now - 3600; });
if (count($hits) >= $CONFIG['max_per_hour_per_ip']) respond(429, ['ok' => false, 'error' => 'Too many submissions. Please try again later.']);
$hits[] = $now;
@file_put_contents($rlFile, json_encode(array_values($hits)), LOCK_EX);

if (empty($CONFIG['smtp_user']) || empty($CONFIG['smtp_pass'])) {
    error_log('[handover] SMTP is not configured in submit.php');
    respond(500, ['ok' => false, 'error' => 'Email is not set up yet.']);
}

$meta = json_decode($_POST['meta'] ?? '{}', true) ?: [];
$clean = function ($s, $len = 200) { return mb_substr(trim(preg_replace('/[\r\n\t]+/', ' ', (string) $s)), 0, $len); };
$customer = $clean($meta['customer'] ?? 'Unknown customer') ?: 'Unknown customer';
$ref = preg_replace('/[^a-f0-9]/', '', (string) ($meta['ref'] ?? '')) ?: 'none';
$by = $clean($meta['completed_by'] ?? '');
$byEmail = filter_var($meta['completed_email'] ?? '', FILTER_VALIDATE_EMAIL) ?: '';

// ---- uploaded files ----------------------------------------------------------
$expect = [
    'report_pdf'  => ['pdf', '%PDF'],
    'report_docx' => ['docx', "PK\x03\x04"],
    'full_pdf'    => ['pdf', '%PDF'],
    'full_docx'   => ['docx', "PK\x03\x04"],
];
$files = [];
$total = 0;
foreach ($expect as $key => [$ext, $magic]) {
    $f = $_FILES[$key] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) respond(400, ['ok' => false, 'error' => 'A report file was missing from the upload.']);
    $data = file_get_contents($f['tmp_name']);
    if (strncmp($data, $magic, strlen($magic)) !== 0) respond(400, ['ok' => false, 'error' => 'A report file was not valid.']);
    $total += strlen($data);
    $name = preg_replace('/[^A-Za-z0-9._-]+/', '-', basename($f['name']));
    if (!preg_match('/\.' . $ext . '$/', $name)) $name .= '.' . $ext;
    $files[$key] = ['name' => $name, 'data' => $data];
}
if ($total > $CONFIG['max_upload_mb'] * 1024 * 1024) respond(413, ['ok' => false, 'error' => 'The reports are too large.']);

$mime = [
    'pdf'  => 'application/pdf',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'zip'  => 'application/zip',
];
$attachments = [];
foreach (['report_pdf', 'report_docx'] as $k) {
    $attachments[] = ['name' => $files[$k]['name'], 'type' => $mime[pathinfo($files[$k]['name'], PATHINFO_EXTENSION)], 'data' => $files[$k]['data']];
}

// ---- encrypted ZIP with the full copies ---------------------------------------
$zipNote = 'Passwords were NOT emailed (no ZIP password is set in submit.php).';
if ($CONFIG['zip_password'] !== '') {
    if (class_exists('ZipArchive') && method_exists('ZipArchive', 'setEncryptionName') && defined('ZipArchive::EM_AES_256')) {
        $tmp = tempnam(sys_get_temp_dir(), 'sitzip');
        $zip = new ZipArchive();
        if ($zip->open($tmp, ZipArchive::OVERWRITE) === true) {
            foreach (['full_pdf', 'full_docx'] as $k) {
                $zip->addFromString($files[$k]['name'], $files[$k]['data']);
                $zip->setEncryptionName($files[$k]['name'], ZipArchive::EM_AES_256, $CONFIG['zip_password']);
            }
            $zip->close();
            $attachments[] = ['name' => preg_replace('/\.pdf$/', '', $files['full_pdf']['name']) . '-with-passwords.zip', 'type' => $mime['zip'], 'data' => file_get_contents($tmp)];
            $zipNote = 'The attached ZIP contains the full copies including passwords. It is AES-256 encrypted; open it with 7-Zip or WinRAR.';
        }
        @unlink($tmp);
    } else {
        $zipNote = 'Passwords were NOT emailed: this server\'s PHP cannot create encrypted ZIPs (needs PHP 7.2+ with libzip 1.2+).';
        error_log('[handover] AES ZIP not supported on this server');
    }
}

// ---- email ------------------------------------------------------------------------
$body = "A new customer handover questionnaire has been submitted.\r\n\r\n"
    . "Customer: $customer\r\n"
    . 'Completed by: ' . ($by ?: '-') . ($byEmail ? " <$byEmail>" : '') . "\r\n"
    . "Reference: $ref\r\n"
    . 'Submitted from: ' . ($_SERVER['REMOTE_ADDR'] ?? '-') . ' at ' . date('j M Y g:i a T') . "\r\n\r\n"
    . "The attached PDF and Word documents do not include passwords.\r\n"
    . $zipNote . "\r\n";

try {
    smtp_send($CONFIG, 'Customer handover: ' . $customer, $body, $attachments, $byEmail);
} catch (Exception $e) {
    error_log('[handover] email failed: ' . $e->getMessage());
    respond(502, ['ok' => false, 'error' => 'The email could not be sent.']);
}
respond(200, ['ok' => true]);

// ---- minimal SMTP client (no extra libraries needed) ------------------------------
function smtp_send($c, $subject, $text, $attachments, $replyTo = '') {
    $host = $c['smtp_secure'] === 'ssl' ? 'ssl://' . $c['smtp_host'] : 'tcp://' . $c['smtp_host'];
    $fp = @stream_socket_client($host . ':' . $c['smtp_port'], $errno, $errstr, 20);
    if (!$fp) throw new Exception("connect failed: $errstr ($errno)");
    stream_set_timeout($fp, 30);

    $read = function () use ($fp) {
        $out = '';
        while (($line = fgets($fp, 1024)) !== false) {
            $out .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return $out;
    };
    $cmd = function ($line, $expect) use ($fp, $read) {
        if ($line !== null) fwrite($fp, $line . "\r\n");
        $resp = $read();
        if ((int) substr($resp, 0, 3) !== $expect) throw new Exception('SMTP error after ' . explode(' ', (string) $line)[0] . ': ' . trim($resp));
        return $resp;
    };

    $ehloName = preg_replace('/[^A-Za-z0-9.-]/', '', $_SERVER['SERVER_NAME'] ?? 'localhost') ?: 'localhost';
    $cmd(null, 220);
    $cmd("EHLO $ehloName", 250);
    if ($c['smtp_secure'] === 'starttls') {
        $cmd('STARTTLS', 220);
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT') ? STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT : 0))) {
            throw new Exception('TLS negotiation failed');
        }
        $cmd("EHLO $ehloName", 250);
    }
    $cmd('AUTH LOGIN', 334);
    $cmd(base64_encode($c['smtp_user']), 334);
    $cmd(base64_encode($c['smtp_pass']), 235);
    $cmd('MAIL FROM:<' . $c['from_email'] . '>', 250);
    foreach ((array) $c['to'] as $rcpt) $cmd('RCPT TO:<' . $rcpt . '>', 250);
    $cmd('DATA', 354);

    $boundary = 'sit-' . bin2hex(random_bytes(12));
    $enc = function ($s) { return '=?UTF-8?B?' . base64_encode($s) . '?='; };
    $headers = [
        'Date: ' . date('r'),
        'From: ' . $enc($c['from_name']) . ' <' . $c['from_email'] . '>',
        'To: ' . implode(', ', (array) $c['to']),
        'Subject: ' . $enc($subject),
        'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . substr(strrchr($c['from_email'], '@'), 1) . '>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
    ];
    if ($replyTo) $headers[] = 'Reply-To: ' . $replyTo;

    $msg = implode("\r\n", $headers) . "\r\n\r\n"
        . "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($text)) ;
    foreach ($attachments as $a) {
        $msg .= "--$boundary\r\n"
            . 'Content-Type: ' . $a['type'] . '; name="' . $a['name'] . "\"\r\n"
            . "Content-Transfer-Encoding: base64\r\n"
            . 'Content-Disposition: attachment; filename="' . $a['name'] . "\"\r\n\r\n"
            . chunk_split(base64_encode($a['data']));
    }
    $msg .= "--$boundary--\r\n";

    // Everything is base64 so no line starts with ".", but stuff dots anyway.
    $msg = preg_replace('/^\./m', '..', $msg);
    fwrite($fp, $msg . "\r\n.\r\n");
    $cmd(null, 250);
    $cmd('QUIT', 221);
    fclose($fp);
}
