(() => {
  const root = document.querySelector('[data-publication-search]');
  if (!root) return;

  const form = root.querySelector('[data-search-form]');
  const input = root.querySelector('[data-search-input]');
  const type = root.querySelector('[data-search-type]');
  const category = root.querySelector('[data-search-category]');
  const status = root.querySelector('[data-search-status]');
  const results = root.querySelector('[data-search-results]');
  const summary = root.querySelector('[data-search-summary]');
  const reset = root.querySelector('[data-search-reset]');
  const indexUrl = root.dataset.indexUrl || '/search-index.json';
  const synonymsUrl = root.dataset.synonymsUrl || '/search-synonyms.json';
  const resultLimit = Math.max(1, Math.min(100, Number(root.dataset.resultLimit) || 50));
  let entries = [];
  let synonyms = [];
  let pagefind = null;
  let ready = false;
  let searchVersion = 0;
  root.dataset.searchEngine = 'static-loading';

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

  function setSummary(message) {
    if (summary) summary.textContent = message;
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

  function expandTerms(terms) {
    const expanded = new Set(terms);
    const haystack = terms.join(' ');
    for (const group of synonyms) {
      const groupTerms = Array.isArray(group?.terms) ? group.terms.map(normalize).filter(Boolean) : [];
      if (!groupTerms.length) continue;
      if (groupTerms.some((term) => haystack.includes(term))) {
        for (const term of groupTerms) expanded.add(term);
      }
    }
    return [...expanded];
  }

  async function pagefindRanking(query) {
    if (!pagefind || !normalize(query)) return null;
    try {
      const response = await pagefind.search(query);
      const records = await Promise.all(response.results.map((result) => result.data()));
      root.dataset.searchEngine = 'pagefind';
      return new Map(records.map((record, index) => [new URL(record.url, window.location.origin).pathname.replace(/\/$/, '') || '/', index]));
    } catch (error) {
      root.dataset.searchEngine = 'static-fallback';
      console.warn('Pagefind was unavailable; using the static search fallback.', error);
      return null;
    }
  }

  async function runSearch({ updateUrl = true, focusStatus = false } = {}) {
    if (!ready) return;
    const version = ++searchVersion;
    const query = input.value.trim();
    const terms = normalize(query).split(' ').filter(Boolean);
    const expandedTerms = expandTerms(terms);
    const selectedType = type.value;
    const selectedCategory = category?.value || '';

    const ranking = await pagefindRanking(query);
    if (version !== searchVersion) return;
    let matches = entries
      .filter((entry) => !selectedType || entry.article_type === selectedType)
      .filter((entry) => !selectedCategory || (entry.categories || []).some((item) => item.slug === selectedCategory))
      .map((entry) => ({ entry, score: ranking ? ranking.has(String(entry.url || '').replace(/\/$/, '') || '/') ? 10000 - ranking.get(String(entry.url || '').replace(/\/$/, '') || '/') : -1 : score(entry, expandedTerms) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score || new Date(b.entry.published_at) - new Date(a.entry.published_at));

    const total = matches.length;
    matches = matches.slice(0, resultLimit);
    clearResults();
    for (const match of matches) results.append(createResult(match.entry));

    if (!query && !selectedType && !selectedCategory) {
      setStatus(`Showing ${matches.length} newest ${matches.length === 1 ? 'entry' : 'entries'}.`);
      setSummary('Search is ready. Try a topic, person, document term, or coverage structure label.');
    } else if (!total) {
      setStatus('No published entries matched those search choices.');
      setSummary('Try fewer words, another format, a broader category, or the Knowledge Desk labels.');
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      addText(empty, 'h2', '', 'No results found');
      addText(empty, 'p', '', 'Try fewer words, another format, or a broader category.');
      results.append(empty);
    } else {
      const limited = total > matches.length ? ` Showing the first ${matches.length}.` : '';
      setStatus(`${total} ${total === 1 ? 'result' : 'results'} found.${limited}`);
      setSummary(ranking ? 'Search results are ranked by the local Pagefind index.' : expandedTerms.length !== terms.length
        ? `Search expanded with Knowledge Desk language: ${expandedTerms.length - terms.length} related term${expandedTerms.length - terms.length === 1 ? '' : 's'}.`
        : 'Search results are ranked by title and body relevance.');
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
      const [indexResponse, synonymsResponse] = await Promise.all([
        fetch(indexUrl, { headers: { Accept: 'application/json' } }),
        fetch(synonymsUrl, { headers: { Accept: 'application/json' } }).catch(() => null)
      ]);
      if (!indexResponse.ok) throw new Error(`Search index returned ${indexResponse.status}`);
      const payload = await indexResponse.json();
      if (!Array.isArray(payload.entries)) throw new Error('Search index is missing entries');
      entries = payload.entries;
      if (synonymsResponse?.ok) {
        const synonymPayload = await synonymsResponse.json();
        synonyms = Array.isArray(synonymPayload.groups) ? synonymPayload.groups : [];
      }
      ready = true;

      try { pagefind = await import('/pagefind/pagefind.js'); root.dataset.searchEngine = 'pagefind-ready'; } catch (error) { root.dataset.searchEngine = 'static-fallback'; console.info('Pagefind enhancement is unavailable; static search remains active.', error); }

      const parameters = new URLSearchParams(window.location.search);
      input.value = parameters.get('q') || '';
      type.value = parameters.get('type') || '';
      if (category) category.value = parameters.get('category') || '';
      results.setAttribute('aria-busy', 'false');
      setSummary('Search has loaded.');
      await runSearch({ updateUrl: false });
    } catch (error) {
      results.setAttribute('aria-busy', 'false');
      clearResults();
      setStatus('Search is temporarily unavailable. Browse the archive links below instead.');
      const message = document.createElement('div');
      message.className = 'search-error';
      addText(message, 'h2', '', 'The static search index could not be loaded.');
      addText(message, 'p', '', 'The publication remains available through Stories, Categories, Topics, Contributors, and Date Archive.');
      results.append(message);
      setSummary('Search could not load the static index.');
      console.error(error);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void runSearch({ focusStatus: true });
  });
  type.addEventListener('change', () => void runSearch());
  category?.addEventListener('change', () => void runSearch());
  reset?.addEventListener('click', () => {
    input.value = '';
    type.value = '';
    if (category) category.value = '';
    void runSearch({ focusStatus: true });
  });
  input.addEventListener('input', () => {
    window.clearTimeout(input._publicationSearchTimer);
    input._publicationSearchTimer = window.setTimeout(() => void runSearch(), 180);
  });

  load();
})();
