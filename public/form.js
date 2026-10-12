(async function () {
  const id = location.pathname.split('/').pop();
  const token = location.hash.slice(1);
  const $ = (sel) => document.querySelector(sel);

  let schema, answers, current = 0, dirty = false, saveTimer = null, saving = false;

  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c !== null && c !== undefined) el.append(c);
    return el;
  }

  function fatal(msg) {
    $('#app').classList.add('hidden');
    $('#fatal').classList.remove('hidden');
    $('#fatal-msg').textContent = msg;
  }

  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Access-Token': token },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { data, status: res.status });
    return data;
  }

  // ---- saving ---------------------------------------------------------------
  function setState(text, error) {
    const el = $('#save-state');
    el.textContent = text;
    el.classList.toggle('error', Boolean(error));
  }

  function markDirty() {
    dirty = true;
    setState('Unsaved changes…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 1500);
    updateNav();
  }

  async function save() {
    if (!dirty || saving) return;
    saving = true;
    dirty = false;
    setState('Saving…');
    try {
      const r = await api('PUT', `/api/questionnaires/${id}`, { answers });
      setState(`Saved ${new Date(r.updatedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`);
    } catch (e) {
      dirty = true;
      setState('Not saved; retrying', true);
      saveTimer = setTimeout(save, 5000);
    } finally {
      saving = false;
    }
  }

  window.addEventListener('beforeunload', (e) => {
    if (dirty) { save(); e.preventDefault(); e.returnValue = ''; }
  });

  // ---- inputs -----------------------------------------------------------------
  function input(field, value, onChange, idAttr) {
    const common = { id: idAttr, placeholder: field.placeholder };
    switch (field.type) {
      case 'textarea':
        return h('textarea', { ...common, oninput: (e) => onChange(e.target.value) }, value || '');
      case 'select':
        return h('select', { ...common, onchange: (e) => onChange(e.target.value) },
          h('option', { value: '' }, '- Select -'),
          field.options.map((o) => h('option', { value: o, selected: o === value }, o)));
      case 'yesno':
      case 'radio': {
        const opts = field.type === 'yesno' ? ['Yes', 'No', 'Unsure'] : field.options;
        const name = `${idAttr}-${Math.random().toString(36).slice(2, 7)}`;
        return h('div', { class: 'choices', role: 'radiogroup', id: idAttr },
          opts.map((o) => h('label', {},
            h('input', { type: 'radio', name, value: o, checked: o === value, onchange: () => onChange(o) }), o)));
      }
      case 'checkboxes': {
        const set = new Set(Array.isArray(value) ? value : []);
        return h('div', { class: 'choices', id: idAttr },
          field.options.map((o) => h('label', {},
            h('input', {
              type: 'checkbox', value: o, checked: set.has(o),
              onchange: (e) => { e.target.checked ? set.add(o) : set.delete(o); onChange(field.options.filter((x) => set.has(x))); },
            }), o)));
      }
      case 'secret': {
        const inp = h('input', { ...common, type: 'password', autocomplete: 'new-password', value: value || '', oninput: (e) => onChange(e.target.value) });
        const btn = h('button', {
          type: 'button', 'aria-label': 'Show password',
          onclick: () => { inp.type = inp.type === 'password' ? 'text' : 'password'; btn.textContent = inp.type === 'password' ? 'Show' : 'Hide'; },
        }, 'Show');
        return h('div', {}, h('div', { class: 'secret' }, inp, btn), h('span', { class: 'lock' }, 'Encrypted, not emailed'));
      }
      default: {
        const type = ['email', 'tel', 'url', 'number', 'date'].includes(field.type) ? field.type : 'text';
        return h('input', { ...common, type, value: value || '', oninput: (e) => onChange(e.target.value) });
      }
    }
  }

  function tableField(field, rows, onChange) {
    rows = Array.isArray(rows) ? rows : [];
    const wrap = h('div', { class: 'table-field' });
    const draw = () => {
      wrap.replaceChildren();
      rows.forEach((row, i) => {
        wrap.append(h('div', { class: 'row-card' },
          h('div', { class: 'row-head' },
            h('strong', {}, `${field.label.replace(/s$/, '')} #${i + 1}`),
            h('button', {
              type: 'button', class: 'btn small danger',
              onclick: () => { if (confirm('Remove this entry?')) { rows.splice(i, 1); onChange(rows); draw(); } },
            }, 'Remove')),
          h('div', { class: 'row-grid' },
            field.columns.map((c) => {
              const cid = `f-${field.id}-${i}-${c.id}`;
              return h('div', {}, h('label', { for: cid }, c.label),
                input(c, row[c.id], (v) => { row[c.id] = v; onChange(rows); }, cid));
            }))));
      });
      wrap.append(h('button', {
        type: 'button', class: 'btn small secondary',
        onclick: () => { rows.push({}); onChange(rows); draw(); },
      }, rows.length ? '+ Add another' : '+ Add entry'));
    };
    draw();
    return wrap;
  }

  // ---- sections ---------------------------------------------------------------
  const visible = (field, values) => !field.showIf || field.showIf.in.includes(values[field.showIf.field]);

  function answeredCount(section) {
    const v = answers[section.id] || {};
    return section.fields.filter((f) => {
      const x = v[f.id];
      if (!visible(f, v)) return false;
      if (Array.isArray(x)) return x.length > 0;
      return x !== undefined && String(x).trim() !== '';
    }).length;
  }

  function updateNav() {
    let started = 0;
    $('#nav').querySelectorAll('li').forEach((li, i) => {
      const n = answeredCount(schema[i]);
      if (n) started += 1;
      li.querySelector('.count').textContent = n ? `${n} ✓` : '';
    });
    $('#progress-bar').style.width = `${Math.round((started / schema.length) * 100)}%`;
  }

  function renderNav() {
    $('#nav').replaceChildren(...schema.map((s, i) => h('li', {},
      h('button', { type: 'button', 'aria-current': i === current ? 'step' : null, onclick: () => go(i) },
        h('span', {}, s.title), h('span', { class: 'count' })))));
    updateNav();
  }

  function renderSection() {
    const section = schema[current];
    const values = (answers[section.id] = answers[section.id] || {});
    $('#section-title').textContent = section.title;
    $('#section-intro').textContent = section.intro || '';
    $('#section-intro').classList.toggle('hidden', !section.intro);

    const body = $('#section-body');
    body.replaceChildren();
    for (const f of section.fields) {
      const fid = `f-${section.id}-${f.id}`;
      const box = h('div', { class: 'field', 'data-field': f.id });
      if (!visible(f, values)) box.classList.add('hidden');
      const labelTag = ['yesno', 'radio', 'checkboxes', 'table'].includes(f.type) ? 'div' : 'label';
      box.append(h(labelTag, { for: labelTag === 'label' ? fid : null, class: 'label' }, f.label, f.required ? h('span', { class: 'req' }, '*') : null));
      if (f.help) box.append(h('p', { class: 'help' }, f.help));
      const onChange = (v) => {
        values[f.id] = v;
        box.classList.remove('invalid');
        markDirty();
        if (section.fields.some((o) => o.showIf && o.showIf.field === f.id)) applyVisibility(section, values);
      };
      box.append(f.type === 'table' ? tableField(f, (values[f.id] = values[f.id] || []), onChange) : input(f, values[f.id], onChange, fid));
      body.append(box);
    }

    $('#prev').disabled = current === 0;
    const last = current === schema.length - 1;
    $('#next').classList.toggle('hidden', last);
    $('#submit').classList.toggle('hidden', !last);
    $('#nav').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-current', i === current ? 'step' : 'false'));
  }

  function applyVisibility(section, values) {
    for (const f of section.fields) {
      const el = $(`#section-body [data-field="${f.id}"]`);
      if (el) el.classList.toggle('hidden', !visible(f, values));
    }
  }

  function go(i) {
    current = Math.max(0, Math.min(schema.length - 1, i));
    $('#submit-error').classList.add('hidden');
    renderSection();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    save();
  }

  // ---- boot -------------------------------------------------------------------
  const cfg = await (await fetch('/api/config')).json();
  document.querySelectorAll('[data-provider]').forEach((el) => { el.textContent = cfg.provider; });

  if (!token) return fatal('This link is incomplete. Please use the full link you were given.');
  let record;
  try {
    [schema, record] = await Promise.all([
      fetch('/api/schema').then((r) => r.json()),
      api('GET', `/api/questionnaires/${id}`),
    ]);
  } catch (e) {
    return fatal(e.message);
  }
  if (record.status === 'submitted') {
    $('#done').classList.remove('hidden');
    return;
  }
  answers = record.answers || {};
  $('#link').value = location.href;
  $('#copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); $('#copy-link').textContent = 'Copied'; }
    catch { $('#link').select(); }
  });
  $('#prev').addEventListener('click', () => go(current - 1));
  $('#next').addEventListener('click', () => go(current + 1));
  $('#submit').addEventListener('click', async () => {
    const err = $('#submit-error');
    err.classList.add('hidden');
    if (!confirm('Submit the questionnaire now? You will not be able to edit it afterwards.')) return;
    clearTimeout(saveTimer);
    $('#submit').disabled = true;
    try {
      await api('POST', `/api/questionnaires/${id}/submit`, { answers });
      dirty = false;
      $('#app').classList.add('hidden');
      $('#done').classList.remove('hidden');
      window.scrollTo(0, 0);
    } catch (e) {
      $('#submit').disabled = false;
      const missing = (e.data && e.data.missing) || [];
      if (missing.length) {
        const first = missing[0];
        go(schema.findIndex((s) => s.id === first.section));
        err.replaceChildren('Please answer: ', missing.map((m) => m.label).join('; '));
        err.classList.remove('hidden');
        missing.filter((m) => m.section === first.section).forEach((m) => {
          const el = $(`#section-body [data-field="${m.field}"]`);
          if (el) el.classList.add('invalid');
        });
      } else {
        err.textContent = e.message;
        err.classList.remove('hidden');
      }
    }
  });

  $('#app').classList.remove('hidden');
  renderNav();
  renderSection();
  setState(record.updatedAt !== record.createdAt ? 'All changes saved' : '');
})();
