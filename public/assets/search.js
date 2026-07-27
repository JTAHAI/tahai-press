(() => {
  const root = document.querySelector('[data-publication-search]');
  if (!root) return;

  const form = root.querySelector('[data-search-form]');
  const input = root.querySelector('[data-search-input]');
  const type = root.querySelector('[data-search-type]');
  const category = root.querySelector('[data-search-category]');
  const status = root.querySelector('[data-search-status]');
  const results = root.querySelector('[data-search-results]');
  const indexUrl = root.dataset.indexUrl || '/search-index.json';
  const resultLimit = Math.max(1, Math.min(100, Number(root.dataset.resultLimit) || 50));
  let entries = [];
  let ready = false;

  function normalize(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('en-US')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function articleTypeLabel(value) {
    return ({ standard: 'Written story', pdf: 'PDF record', mixed: 'Story + PDF', external: 'External document' })[value] || 'Published entry';
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(document.documentElement.lang || 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    }).format(date);
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function clearResults() {
    results.replaceChildren();
  }

  function addText(parent, tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    parent.append(node);
    return node;
  }

  function createResult(entry) {
    const article = document.createElement('article');
    article.className = 'search-result';

    const meta = document.createElement('p');
    meta.className = 'search-result-meta';
    const parts = [articleTypeLabel(entry.article_type), formatDate(entry.published_at)];
    if (entry.author?.name) parts.push(entry.author.name);
    meta.textContent = parts.filter(Boolean).join(' · ');
    article.append(meta);

    const heading = document.createElement('h2');
    const link = document.createElement('a');
    link.href = entry.url;
    link.textContent = entry.title;
    heading.append(link);
    article.append(heading);

    addText(article, 'p', 'search-result-excerpt', entry.excerpt || 'Open this published entry.');

    const labels = document.createElement('ul');
    labels.className = 'search-result-labels';
    for (const item of [...(entry.categories || []), ...(entry.tags || []).slice(0, 4)]) {
      const listItem = document.createElement('li');
      const labelLink = document.createElement('a');
      const isCategory = (entry.categories || []).some((categoryItem) => categoryItem.slug === item.slug && categoryItem.name === item.name);
      labelLink.href = isCategory ? `/categories/${item.slug}/` : `/topics/${item.slug}/`;
      labelLink.textContent = item.name;
      listItem.append(labelLink);
      labels.append(listItem);
    }
    if (labels.children.length) article.append(labels);
    return article;
  }

  function score(entry, terms) {
    if (!terms.length) return 1;
    const title = normalize(entry.title);
    const excerpt = normalize(entry.excerpt);
    const searchable = entry.searchable || normalize([entry.title, entry.excerpt].join(' '));
    let value = 0;
    for (const term of terms) {
      if (!searchable.includes(term)) return -1;
      if (title === term) value += 20;
      else if (title.startsWith(term)) value += 12;
      else if (title.includes(term)) value += 8;
      if (excerpt.includes(term)) value += 4;
      value += Math.min(3, searchable.split(term).length - 1);
    }
    return value;
  }

  function runSearch({ updateUrl = true, focusStatus = false } = {}) {
    if (!ready) return;
    const query = input.value.trim();
    const terms = normalize(query).split(' ').filter(Boolean);
    const selectedType = type.value;
    const selectedCategory = category?.value || '';

    let matches = entries
      .filter((entry) => !selectedType || entry.article_type === selectedType)
      .filter((entry) => !selectedCategory || (entry.categories || []).some((item) => item.slug === selectedCategory))
      .map((entry) => ({ entry, score: score(entry, terms) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score || new Date(b.entry.published_at) - new Date(a.entry.published_at));

    const total = matches.length;
    matches = matches.slice(0, resultLimit);
    clearResults();
    for (const match of matches) results.append(createResult(match.entry));

    if (!query && !selectedType && !selectedCategory) {
      setStatus(`Showing ${matches.length} newest ${matches.length === 1 ? 'entry' : 'entries'}.`);
    } else if (!total) {
      setStatus('No published entries matched those search choices.');
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      addText(empty, 'h2', '', 'No results found');
      addText(empty, 'p', '', 'Try fewer words, another format, or a broader category.');
      results.append(empty);
    } else {
      const limited = total > matches.length ? ` Showing the first ${matches.length}.` : '';
      setStatus(`${total} ${total === 1 ? 'result' : 'results'} found.${limited}`);
    }

    if (updateUrl) {
      const url = new URL(window.location.href);
      query ? url.searchParams.set('q', query) : url.searchParams.delete('q');
      selectedType ? url.searchParams.set('type', selectedType) : url.searchParams.delete('type');
      selectedCategory ? url.searchParams.set('category', selectedCategory) : url.searchParams.delete('category');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    if (focusStatus) status.focus();
  }

  async function load() {
    results.setAttribute('aria-busy', 'true');
    setStatus('Loading the publication index…');
    try {
      const response = await fetch(indexUrl, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Search index returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.entries)) throw new Error('Search index is missing entries');
      entries = payload.entries;
      ready = true;

      const parameters = new URLSearchParams(window.location.search);
      input.value = parameters.get('q') || '';
      type.value = parameters.get('type') || '';
      if (category) category.value = parameters.get('category') || '';
      results.setAttribute('aria-busy', 'false');
      runSearch({ updateUrl: false });
    } catch (error) {
      results.setAttribute('aria-busy', 'false');
      clearResults();
      setStatus('Search is temporarily unavailable. Browse the archive links below instead.');
      const message = document.createElement('div');
      message.className = 'search-error';
      addText(message, 'h2', '', 'The static search index could not be loaded.');
      addText(message, 'p', '', 'The publication remains available through Stories, Categories, Topics, Contributors, and Date Archive.');
      results.append(message);
      console.error(error);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch({ focusStatus: true });
  });
  type.addEventListener('change', () => runSearch());
  category?.addEventListener('change', () => runSearch());
  input.addEventListener('input', () => {
    window.clearTimeout(input._publicationSearchTimer);
    input._publicationSearchTimer = window.setTimeout(() => runSearch(), 180);
  });

  load();
})();
