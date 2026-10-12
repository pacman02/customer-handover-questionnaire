(function () {
  const $ = (s) => document.querySelector(s);
  const fmt = (d) => (d ? new Date(d).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '');

  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v);
    }
    el.append(...children.flat().filter((c) => c !== null && c !== undefined));
    return el;
  }

  async function post(path, body, method = 'POST') {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.reason || `Failed (${res.status})`);
    return data;
  }

  function showLink(url) {
    $('#invite-link').value = url;
    $('#invite-result').classList.remove('hidden');
    $('#invite-result').scrollIntoView({ behavior: 'smooth' });
  }

  async function load() {
    const list = await (await fetch('/admin/api/list')).json();
    $('#rows').replaceChildren(...(list.length ? list.map((r) => {
      const dl = (fmtName, full, label) => h('a', { class: 'btn small secondary', href: `/admin/download/${r.id}.${fmtName}${full ? '?full=1' : ''}` }, label);
      const email = r.email ? (r.email.sent ? `Sent ${fmt(r.email.at)}` : `Not sent: ${r.email.reason}`) : '';
      return h('tr', {},
        h('td', {}, r.customer, h('div', { class: 'ref' }, `ref ${r.id}`)),
        h('td', {}, h('span', { class: `pill ${r.status}` }, r.status)),
        h('td', {}, fmt(r.updatedAt)),
        h('td', { class: 'email-cell' }, email),
        h('td', {}, h('div', { class: 'actions' },
          dl('pdf', false, 'PDF'), dl('docx', false, 'Word'),
          dl('pdf', true, 'Full PDF'), dl('docx', true, 'Full Word'),
          r.status === 'submitted' ? h('button', { class: 'btn small secondary', onclick: async () => {
            try { const x = await post(`/admin/api/${r.id}/resend`); alert(x.sent ? 'Email sent.' : `Not sent: ${x.reason}`); } catch (e) { alert(e.message); }
            load();
          } }, 'Resend email') : null,
          r.status === 'submitted' ? h('button', { class: 'btn small secondary', onclick: async () => { await post(`/admin/api/${r.id}/reopen`); load(); } }, 'Reopen') : null,
          h('button', { class: 'btn small secondary', onclick: async () => { const x = await post(`/admin/api/${r.id}/relink`); showLink(x.url); } }, 'New link'),
          h('button', { class: 'btn small danger', onclick: async () => {
            if (!confirm(`Permanently delete ${r.customer}? This cannot be undone.`)) return;
            await post(`/admin/api/${r.id}`, null, 'DELETE'); load();
          } }, 'Delete'))));
    }) : [h('tr', {}, h('td', { colspan: '5' }, 'No questionnaires yet.'))]));
  }

  $('#invite').addEventListener('click', async () => {
    const x = await post('/admin/api/invite', { customer: $('#customer').value.trim() });
    $('#customer').value = '';
    showLink(x.url);
    load();
  });
  $('#copy-invite').addEventListener('click', () => navigator.clipboard.writeText($('#invite-link').value).catch(() => $('#invite-link').select()));
  load();
})();
