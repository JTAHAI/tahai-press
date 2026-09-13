(() => {
  'use strict';
  const form = document.querySelector('[data-edition-builder]');
  const dataNode = document.getElementById('edition-builder-data');
  if (!form || !dataNode) return;
  let source;
  try { source = JSON.parse(dataNode.textContent || '{}'); } catch { return; }
  const materials = [...(source.stories || []), ...(source.records || [])];
  const selected = [];
  const sourceRoot = form.querySelector('[data-edition-source]');
  const selectionRoot = form.querySelector('[data-edition-selection]');
  const status = form.querySelector('[data-edition-builder-status]');
  const setStatus = (message) => { if (status) status.textContent = message; };
  const escape = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
  const render = () => {
    sourceRoot.innerHTML = materials.map((item) => `<label class="edition-builder-source-item"><input type="checkbox" value="${escape(item.id)}" ${selected.includes(item.id) ? 'checked' : ''}><span><strong>${escape(item.title)}</strong><small>${escape(item.type)} · ${escape(item.excerpt)}</small></span></label>`).join('');
    selectionRoot.innerHTML = selected.map((id, index) => {
      const item = materials.find((candidate) => candidate.id === id);
      return `<li tabindex="0" data-edition-item="${escape(id)}" aria-label="${escape(item?.title || id)}, position ${index + 1} of ${selected.length}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escape(item?.title || id)}</strong><button type="button" data-edition-remove="${escape(id)}" aria-label="Remove ${escape(item?.title || id)}">Remove</button></li>`;
    }).join('');
    setStatus(selected.length ? `${selected.length} item${selected.length === 1 ? '' : 's'} selected. Focus an item and use Arrow Up or Arrow Down to reorder.` : 'Choose reporting to begin.');
  };
  sourceRoot.addEventListener('change', (event) => {
    const input = event.target.closest('input[type="checkbox"]');
    if (!input) return;
    const index = selected.indexOf(input.value);
    if (input.checked && index < 0) selected.push(input.value);
    if (!input.checked && index >= 0) selected.splice(index, 1);
    render();
  });
  selectionRoot.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edition-remove]');
    if (!button) return;
    const index = selected.indexOf(button.dataset.editionRemove);
    if (index >= 0) selected.splice(index, 1);
    render();
  });
  selectionRoot.addEventListener('keydown', (event) => {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const item = event.target.closest('[data-edition-item]');
    if (!item) return;
    const index = selected.indexOf(item.dataset.editionItem);
    const next = event.key === 'ArrowUp' ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= selected.length) return;
    event.preventDefault();
    [selected[index], selected[next]] = [selected[next], selected[index]];
    render();
    selectionRoot.querySelectorAll('[data-edition-item]')[next]?.focus();
  });
  form.querySelector('[data-edition-export]').addEventListener('click', () => {
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const stories = selected.filter((id) => materials.find((item) => item.id === id)?.type === 'story');
    const records = selected.filter((id) => materials.find((item) => item.id === id)?.type === 'record');
    if (!selected.length) { setStatus('Select at least one canonical story or record before export.'); return; }
    const id = String(values.get('title')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'new-edition';
    const edition = { id, title: values.get('title'), volume: '', issue: '', date: values.get('date'), template: values.get('template'), cover_kicker: '', editor_note: '', sections: [{ title: 'Contents', story_ids: stories, record_ids: records }], credits: '', corrections_note: '', inserts: [], status: 'draft' };
    const blob = new Blob([`${JSON.stringify(edition, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${id}.json`; link.click(); URL.revokeObjectURL(url);
    setStatus('Edition JSON downloaded. Review it, place it in content/editions/, then run validation and build.');
  });
  form.querySelector('[data-edition-print]').addEventListener('click', () => window.print());
  render();
})();
