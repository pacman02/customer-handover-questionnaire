(async function () {
  const cfg = await (await fetch('/api/config')).json();
  document.querySelectorAll('[data-provider]').forEach((el) => { el.textContent = cfg.provider; });
  if (!cfg.publicStart) {
    document.getElementById('start-form').classList.add('hidden');
    document.getElementById('no-public').classList.remove('hidden');
    return;
  }
  if (cfg.startCodeRequired) document.getElementById('code-field').classList.remove('hidden');

  document.getElementById('start').addEventListener('click', async () => {
    const err = document.getElementById('start-error');
    err.classList.add('hidden');
    const res = await fetch('/api/questionnaires', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startCode: document.getElementById('code').value.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      err.textContent = data.error || 'Could not start the questionnaire.';
      err.classList.remove('hidden');
      return;
    }
    location.href = `/q/${data.id}#${data.token}`;
  });
})();
