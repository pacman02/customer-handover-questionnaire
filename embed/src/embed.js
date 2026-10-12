/* global CONFIG, SECTIONS, buildReport, isFieldVisible, buildPdf, buildDocx, jspdf, docx */
// Browser side of the paste-in questionnaire. scripts/build-embed.js wraps this
// file together with CONFIG, SECTIONS and the shared builders into one snippet.

var root = document.getElementById('sit-handover');
var STORE_KEY = 'sit-handover-v1';
var state = load() || { ref: newRef(), answers: {}, current: 0, savedAt: null };
var saveTimer = null;

function newRef() {
  var a = new Uint8Array(6);
  (window.crypto || window.msCrypto).getRandomValues(a);
  return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
}
function persist() {
  state.savedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    setStatus('Saved on this computer ' + new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }));
  } catch (e) {
    setStatus('Could not save in this browser. Use "Save to file".', true);
  }
}
function markDirty() {
  setStatus('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 800);
  updateNav();
}

function h(tag, attrs) {
  var el = document.createElement(tag);
  attrs = attrs || {};
  Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v === undefined || v === null || v === false) return;
    if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  });
  for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
  return el;
}
function append(el, c) {
  if (c === null || c === undefined || c === false) return;
  if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
  el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
}
function $(sel) { return root.querySelector(sel); }
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
function label(f) { return f.label.replace('{{provider}}', CONFIG.provider); }

// ---- layout -----------------------------------------------------------------
root.className = 'sit-root';
append(root, [
  h('div', { class: 'sit-toolbar' },
    h('span', { class: 'sit-status', id: 'sit-status' }),
    h('span', { class: 'sit-spacer' }),
    h('button', { type: 'button', class: 'sit-btn sit-small sit-secondary', onclick: saveToFile }, 'Save to file'),
    h('button', { type: 'button', class: 'sit-btn sit-small sit-secondary', onclick: function () { $('#sit-file').click(); } }, 'Open saved file'),
    h('input', { type: 'file', id: 'sit-file', accept: '.json,application/json', class: 'sit-hidden', onchange: openFile }),
    h('button', { type: 'button', class: 'sit-btn sit-small sit-danger', onclick: startOver }, 'Start over')),
  h('div', { class: 'sit-layout', id: 'sit-app' },
    h('nav', { class: 'sit-nav', 'aria-label': 'Questionnaire sections' },
      h('div', { class: 'sit-progress' }, h('div', { id: 'sit-progress' })),
      h('ol', { id: 'sit-nav' })),
    h('div', { class: 'sit-card' },
      h('div', { class: 'sit-notice sit-info', id: 'sit-intro' },
        'Your answers save automatically in this browser on this computer. To finish on another computer, use "Save to file" and open it there. ',
        'Passwords are only sent to ' + CONFIG.provider + ' inside an encrypted file.'),
      h('h2', { id: 'sit-title' }),
      h('p', { class: 'sit-intro', id: 'sit-section-intro' }),
      h('div', { id: 'sit-body' }),
      h('div', { class: 'sit-notice sit-err sit-hidden', id: 'sit-error' }),
      h('div', { class: 'sit-pager' },
        h('button', { type: 'button', class: 'sit-btn sit-secondary', id: 'sit-prev', onclick: function () { go(state.current - 1); } }, 'Previous'),
        h('button', { type: 'button', class: 'sit-btn', id: 'sit-next', onclick: function () { go(state.current + 1); } }, 'Next'),
        h('button', { type: 'button', class: 'sit-btn sit-hidden', id: 'sit-submit', onclick: submit }, 'Submit questionnaire')))),
  h('div', { class: 'sit-card sit-hidden', id: 'sit-done' },
    h('h2', {}, 'Thank you'),
    h('div', { class: 'sit-notice sit-ok' }, 'Your questionnaire has been sent to ' + CONFIG.provider + '. We will be in touch if we have any questions.'),
    h('p', {}, 'Your answers have been cleared from this browser. You can keep a copy (without passwords) for your records:'),
    h('button', { type: 'button', class: 'sit-btn sit-secondary', id: 'sit-copy' }, 'Download my copy (PDF)')),
]);

function setStatus(text, err) {
  var el = $('#sit-status');
  el.textContent = text;
  el.className = 'sit-status' + (err ? ' sit-status-err' : '');
}

// ---- inputs -------------------------------------------------------------------
var uid = 0;
function input(field, value, onChange, idAttr) {
  var common = { id: idAttr, placeholder: field.placeholder };
  switch (field.type) {
    case 'textarea':
      var ta = h('textarea', Object.assign({ oninput: function (e) { onChange(e.target.value); } }, common));
      ta.value = value || '';
      return ta;
    case 'select':
      return h('select', Object.assign({ onchange: function (e) { onChange(e.target.value); } }, common),
        h('option', { value: '' }, '- Select -'),
        field.options.map(function (o) { return h('option', { value: o, selected: o === value }, o); }));
    case 'yesno':
    case 'radio':
      var opts = field.type === 'yesno' ? ['Yes', 'No', 'Unsure'] : field.options;
      var name = 'sit-r' + (uid++);
      return h('div', { class: 'sit-choices', role: 'radiogroup', id: idAttr },
        opts.map(function (o) {
          return h('label', {}, h('input', { type: 'radio', name: name, value: o, checked: o === value, onchange: function () { onChange(o); } }), ' ' + o);
        }));
    case 'checkboxes':
      var set = Array.isArray(value) ? value.slice() : [];
      return h('div', { class: 'sit-choices', id: idAttr },
        field.options.map(function (o) {
          return h('label', {}, h('input', {
            type: 'checkbox', value: o, checked: set.indexOf(o) !== -1,
            onchange: function (e) {
              if (e.target.checked) set.push(o); else set.splice(set.indexOf(o), 1);
              onChange(field.options.filter(function (x) { return set.indexOf(x) !== -1; }));
            },
          }), ' ' + o);
        }));
    case 'secret':
      var inp = h('input', Object.assign({ type: 'password', autocomplete: 'new-password', oninput: function (e) { onChange(e.target.value); } }, common));
      inp.value = value || '';
      var btn = h('button', {
        type: 'button', class: 'sit-show',
        onclick: function () { inp.type = inp.type === 'password' ? 'text' : 'password'; btn.textContent = inp.type === 'password' ? 'Show' : 'Hide'; },
      }, 'Show');
      return h('div', {}, h('div', { class: 'sit-secret' }, inp, btn), h('span', { class: 'sit-lock' }, 'Sent encrypted'));
    default:
      var type = ['email', 'tel', 'url', 'number', 'date'].indexOf(field.type) !== -1 ? field.type : 'text';
      var el = h('input', Object.assign({ type: type, oninput: function (e) { onChange(e.target.value); } }, common));
      el.value = value || '';
      return el;
  }
}

function tableField(field, rows, onChange) {
  var wrap = h('div', { class: 'sit-table' });
  function draw() {
    clear(wrap);
    rows.forEach(function (row, i) {
      append(wrap, h('div', { class: 'sit-row' },
        h('div', { class: 'sit-row-head' },
          h('strong', {}, label(field).replace(/s$/, '') + ' #' + (i + 1)),
          h('button', {
            type: 'button', class: 'sit-btn sit-small sit-danger',
            onclick: function () { if (window.confirm('Remove this entry?')) { rows.splice(i, 1); onChange(rows); draw(); } },
          }, 'Remove')),
        h('div', { class: 'sit-grid' }, field.columns.map(function (c) {
          var cid = 'sit-' + field.id + '-' + i + '-' + c.id;
          return h('div', {}, h('label', { for: cid }, c.label), input(c, row[c.id], function (v) { row[c.id] = v; onChange(rows); }, cid));
        }))));
    });
    append(wrap, h('button', {
      type: 'button', class: 'sit-btn sit-small sit-secondary',
      onclick: function () { rows.push({}); onChange(rows); draw(); },
    }, rows.length ? '+ Add another' : '+ Add entry'));
  }
  draw();
  return wrap;
}

// ---- sections -----------------------------------------------------------------
function answered(section) {
  var v = state.answers[section.id] || {};
  return section.fields.filter(function (f) {
    if (!isFieldVisible(f, v)) return false;
    var x = v[f.id];
    return Array.isArray(x) ? x.length > 0 : x !== undefined && String(x).trim() !== '';
  }).length;
}

function renderNav() {
  var nav = $('#sit-nav');
  clear(nav);
  SECTIONS.forEach(function (s, i) {
    append(nav, h('li', {}, h('button', { type: 'button', onclick: function () { go(i); } }, h('span', {}, s.title), h('span', { class: 'sit-count' }))));
  });
  updateNav();
}

function updateNav() {
  var started = 0;
  Array.prototype.forEach.call(root.querySelectorAll('#sit-nav li'), function (li, i) {
    var n = answered(SECTIONS[i]);
    if (n) started++;
    li.querySelector('.sit-count').textContent = n ? n + ' ✓' : '';
    li.firstChild.setAttribute('aria-current', i === state.current ? 'step' : 'false');
  });
  $('#sit-progress').style.width = Math.round((started / SECTIONS.length) * 100) + '%';
}

function renderSection() {
  var section = SECTIONS[state.current];
  var values = state.answers[section.id] = state.answers[section.id] || {};
  $('#sit-title').textContent = section.title;
  $('#sit-section-intro').textContent = section.intro || '';
  $('#sit-section-intro').className = 'sit-intro' + (section.intro ? '' : ' sit-hidden');

  var body = $('#sit-body');
  clear(body);
  section.fields.forEach(function (f) {
    var fid = 'sit-' + section.id + '-' + f.id;
    var box = h('div', { class: 'sit-field' + (isFieldVisible(f, values) ? '' : ' sit-hidden'), 'data-field': f.id });
    var grouped = ['yesno', 'radio', 'checkboxes', 'table'].indexOf(f.type) !== -1;
    append(box, h(grouped ? 'div' : 'label', { for: grouped ? null : fid, class: 'sit-label' }, label(f), f.required ? h('span', { class: 'sit-req' }, '*') : null));
    if (f.help) append(box, h('p', { class: 'sit-help' }, f.help));
    var onChange = function (v) {
      values[f.id] = v;
      box.classList.remove('sit-invalid');
      markDirty();
      section.fields.forEach(function (o) {
        var el = body.querySelector('[data-field="' + o.id + '"]');
        if (el && o.showIf) el.classList.toggle('sit-hidden', !isFieldVisible(o, values));
      });
    };
    if (f.type === 'table') append(box, tableField(f, values[f.id] = values[f.id] || [], onChange));
    else append(box, input(f, values[f.id], onChange, fid));
    append(body, box);
  });

  var last = state.current === SECTIONS.length - 1;
  $('#sit-prev').disabled = state.current === 0;
  $('#sit-next').classList.toggle('sit-hidden', last);
  $('#sit-submit').classList.toggle('sit-hidden', !last);
  updateNav();
}

function go(i) {
  state.current = Math.max(0, Math.min(SECTIONS.length - 1, i));
  $('#sit-error').classList.add('sit-hidden');
  renderSection();
  persist();
  root.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- save / load files --------------------------------------------------------
function download(blob, filename) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function customer() {
  return (state.answers.business && state.answers.business.company_name) || 'Customer';
}
function safeName(s) {
  return String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'customer';
}
function saveToFile() {
  persist();
  download(new Blob([JSON.stringify({ format: 'sit-handover', version: 1, state: state })], { type: 'application/json' }),
    'Handover-progress-' + safeName(customer()) + '.json');
  window.alert('Saved. This file contains your answers, including any passwords, so keep it somewhere safe.');
}
function openFile(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var data = JSON.parse(reader.result);
      if (data.format !== 'sit-handover') throw new Error('bad format');
      state = data.state;
      persist();
      renderNav();
      renderSection();
    } catch (err) {
      window.alert('That file could not be opened. Please choose a file saved from this questionnaire.');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}
function startOver() {
  if (!window.confirm('Clear all answers from this browser and start again?')) return;
  try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
  state = { ref: newRef(), answers: {}, current: 0, savedAt: null };
  renderNav();
  renderSection();
  setStatus('');
}

// ---- submit -------------------------------------------------------------------
function missingRequired() {
  var out = [];
  SECTIONS.forEach(function (s) {
    var v = state.answers[s.id] || {};
    s.fields.forEach(function (f) {
      if (!f.required || !isFieldVisible(f, v)) return;
      var x = v[f.id];
      if (Array.isArray(x) ? !x.length : !String(x || '').trim()) out.push({ section: s.id, field: f.id, label: label(f) });
    });
  });
  return out;
}

function makeFiles(redact, notice) {
  var name = customer();
  var meta = {
    provider: CONFIG.provider,
    title: 'New Customer Handover: ' + name,
    subtitle: 'Submitted ' + new Date().toLocaleString('en-AU') + ' (ref ' + state.ref + ')',
    notice: notice,
  };
  var report = buildReport(SECTIONS, state.answers, { redactSecrets: redact, redactedText: '[in the encrypted attachment]', provider: CONFIG.provider });
  var pdf = buildPdf(jspdf.jsPDF, report, meta).output('blob');
  return docx.Packer.toBlob(buildDocx(docx, report, meta)).then(function (word) {
    return { pdf: pdf, docx: word, base: 'Handover-' + safeName(name) };
  });
}

function showError(msg) {
  var err = $('#sit-error');
  clear(err);
  append(err, msg);
  err.classList.remove('sit-hidden');
}

function submit() {
  $('#sit-error').classList.add('sit-hidden');
  var missing = missingRequired();
  if (missing.length) {
    var first = missing[0];
    go(SECTIONS.findIndex(function (s) { return s.id === first.section; }));
    showError('Please answer: ' + missing.map(function (m) { return m.label; }).join('; '));
    missing.forEach(function (m) {
      var el = $('#sit-body [data-field="' + m.field + '"]');
      if (el) el.classList.add('sit-invalid');
    });
    return;
  }
  if (!window.confirm('Send the questionnaire to ' + CONFIG.provider + ' now?')) return;
  var btn = $('#sit-submit');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  Promise.all([
    makeFiles(true, 'Passwords are not included in this copy. They are in the password-protected ZIP attached to the same email.'),
    makeFiles(false, 'CONFIDENTIAL: this copy includes passwords.'),
  ]).then(function (files) {
    var fd = new FormData();
    var red = files[0];
    var full = files[1];
    var fin = state.answers.final || {};
    fd.append('meta', JSON.stringify({ ref: state.ref, customer: customer(), completed_by: fin.completed_by || '', completed_email: fin.completed_email || '' }));
    fd.append('website', $('#sit-hp').value);
    fd.append('report_pdf', red.pdf, red.base + '.pdf');
    fd.append('report_docx', red.docx, red.base + '.docx');
    fd.append('full_pdf', full.pdf, full.base + '-FULL.pdf');
    fd.append('full_docx', full.docx, full.base + '-FULL.docx');
    return fetch(CONFIG.endpoint, { method: 'POST', body: fd }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || !data.ok) throw new Error(data.error || 'The server returned an error (' + res.status + ').');
        return red;
      });
    });
  }).then(function (red) {
    try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
    $('#sit-copy').onclick = function () { download(red.pdf, red.base + '.pdf'); };
    $('#sit-app').classList.add('sit-hidden');
    root.querySelector('.sit-toolbar').classList.add('sit-hidden');
    $('#sit-done').classList.remove('sit-hidden');
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }).catch(function (err) {
    btn.disabled = false;
    btn.textContent = 'Submit questionnaire';
    showError('Sorry, the questionnaire could not be sent: ' + err.message + ' Your answers are still saved. Please try again, or use "Save to file" and email the file to ' + CONFIG.provider + '.');
  });
}

// Honeypot field for spam bots (hidden from people).
append(root, h('input', { type: 'text', id: 'sit-hp', name: 'website', tabindex: '-1', autocomplete: 'off', class: 'sit-hp', 'aria-hidden': 'true' }));

if (!window.jspdf || !window.docx) {
  showError('Part of this page failed to load. Please refresh, or try a different browser.');
}
renderNav();
renderSection();
if (state.savedAt) setStatus('Welcome back. Your answers were restored from this computer.');
