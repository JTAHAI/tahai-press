(() => {
  const root = document.querySelector('[data-publishing-console]');
  const dataScript = document.getElementById('publishing-console-data');
  if (!root || !dataScript) return;

  const storageKey = 'tahai-press-publishing-console-v1';
  const STATUSES = ['draft', 'review', 'scheduled', 'published', 'corrected', 'archived'];
  const THEME_PRESETS = ['classic-broadsheet', 'community-weekly', 'civic-record', 'modern-daily', 'investigative-journal', 'arts-culture', 'high-contrast', 'warm-reading'];
  const ROUTES = new Set([
    '/', '/stories/', '/search/', '/topics/', '/authors/', '/categories/', '/sections/', '/series/',
    '/archive/', '/hubs/', '/about/', '/accessibility/', '/submit/', '/contact/', '/edition/',
    '/saved/', '/puzzles/', '/studio/', '/publisher/', '/media-desk/', '/setup/', '/admin/', '/offline/'
  ]);
  const RESERVED_ROUTE_PATTERNS = [
    /^\/(?:assets|uploads|\.well-known)(?:\/|$)/,
    /^\/(?:_redirects|404\.html|service-worker\.js|site\.webmanifest)$/i,
    /^\/admin\/config\.yml$/i
  ];
  const JSON_TEXTAREAS = new Set(['navigation', 'homepage', 'footer', 'authors', 'categories', 'hubs', 'article.source_links', 'article.legacy_urls', 'article.update_history', 'article.corrections']);

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const original = JSON.parse(dataScript.textContent || '{}');
  const editorPane = root.querySelector('[data-console-editor]');
  const previewBody = root.querySelector('[data-console-preview-body]');
  const validationBody = root.querySelector('[data-console-validation-body]');
  const diffBody = root.querySelector('[data-console-diff-body]');
  const importInput = root.querySelector('[data-console-import]');

  const state = {
    activeTab: 'site',
    sourceHash: original.source_hash || '',
    conflict: false,
    site: clone(original.site || {}),
    article: clone(original.article || {}),
    articles: clone(original.articles || []),
    authors: clone(original.authors || []),
    categories: clone(original.categories || []),
    hubs: clone(original.hubs || []),
    navigation: clone(original.navigation || {}),
    homepage: clone(original.homepage || {}),
    footer: clone(original.footer || {}),
    publication_settings: clone(original.publication_settings || {}),
    selection: { article: String(original.article?.slug || original.articles?.[0]?.slug || '') },
    text: {},
    jsonErrors: {}
  };

  for (const key of ['navigation', 'homepage', 'footer', 'authors', 'categories', 'hubs']) {
    state.text[key] = stableStringify(state[key]);
  }
  for (const key of ['source_links', 'legacy_urls', 'update_history', 'corrections']) {
    state.text[`article.${key}`] = stableStringify(state.article[key] || []);
  }

  const selected = state.articles.find((item) => item.slug === state.selection.article);
  if (selected) state.article = clone(selected);

  function stableStringify(value) {
    const seen = new WeakSet();
    const format = (input) => {
      if (input === null || typeof input !== 'object') return input;
      if (seen.has(input)) throw new TypeError('Cannot stringify circular data.');
      seen.add(input);
      if (Array.isArray(input)) return input.map(format);
      return Object.keys(input).sort().reduce((accumulator, key) => {
        accumulator[key] = format(input[key]);
        return accumulator;
      }, {});
    };
    return JSON.stringify(format(value), null, 2);
  }

  function normalizeRoute(value = '') {
    return String(value).trim().split('?')[0].split('#')[0];
  }

  function isReservedRoute(value = '') {
    const route = normalizeRoute(value);
    return RESERVED_ROUTE_PATTERNS.some((pattern) => pattern.test(route));
  }

  function validPublicationRoute(value = '') {
    const route = normalizeRoute(value);
    if (!route.startsWith('/')) return false;
    if (isReservedRoute(route)) return false;
    if (ROUTES.has(route)) return true;
    return [
      /^\/stories\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
      /^\/authors\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
      /^\/categories\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
      /^\/sections\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
      /^\/series\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
      /^\/topics\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
      /^\/hubs\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
      /^\/archive\/\d{4}\/?$/i,
      /^\/archive\/\d{4}\/\d{2}\/?$/i,
      /^\/archive\/\d{4}\/\d{2}\/page\/\d+\/?$/i
    ].some((pattern) => pattern.test(route));
  }

  function articleList() {
    return state.articles.map((item) => ({ value: item.slug, label: `${item.slug} · ${item.status || 'draft'}` }));
  }

  function currentArticle() {
    const article = state.articles.find((item) => item.slug === state.selection.article);
    return article || state.article || {};
  }

  function syncSelectedArticle() {
    const index = state.articles.findIndex((item) => item.slug === state.selection.article);
    if (index >= 0) state.articles[index] = clone(state.article);
    else if (state.article?.slug) {
      state.selection.article = state.article.slug;
      state.articles.unshift(clone(state.article));
    }
    for (const key of ['source_links', 'legacy_urls', 'update_history', 'corrections']) {
      state.text[`article.${key}`] = stableStringify(currentArticle()[key] || []);
    }
  }

  function setByPath(target, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    let cursor = target;
    for (const part of parts) {
      if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
      cursor = cursor[part];
    }
    cursor[last] = value;
  }

  function applyPath(path, value) {
    if (path === 'selection.article') {
      const article = state.articles.find((item) => item.slug === value);
      if (article) {
        state.selection.article = value;
        state.article = clone(article);
        syncSelectedArticle();
      }
      return;
    }
    if (path === 'article.categories_text') {
      state.article.categories = String(value).split(',').map((item) => item.trim()).filter(Boolean);
      syncSelectedArticle();
      return;
    }
    if (path === 'article.tags_text') {
      state.article.tags = String(value).split(',').map((item) => item.trim()).filter(Boolean);
      syncSelectedArticle();
      return;
    }
    if (path === 'article.document_pages') {
      state.article.document_pages = value === '' ? 0 : Number(value);
      syncSelectedArticle();
      return;
    }
    if (path.startsWith('site.layout.')) {
      setByPath(state.site, path.slice('site.'.length), value);
      return;
    }
    if (path.startsWith('site.publication_settings.')) {
      setByPath(state.publication_settings, path.slice('site.publication_settings.'.length), value);
      return;
    }
    if (path.startsWith('site.')) {
      setByPath(state.site, path.slice('site.'.length), value);
      return;
    }
    if (path.startsWith('article.')) {
      setByPath(state.article, path.slice('article.'.length), value);
      if (path === 'article.slug') state.selection.article = String(value || '');
      syncSelectedArticle();
      return;
    }
    setByPath(state, path, value);
  }

  function parseJsonField(key, text) {
    state.text[key] = text;
    try {
      const value = JSON.parse(text);
      state.jsonErrors[key] = '';
      if (key === 'navigation') state.navigation = value;
      else if (key === 'homepage') state.homepage = value;
      else if (key === 'footer') state.footer = value;
      else if (key === 'authors') state.authors = value;
      else if (key === 'categories') state.categories = value;
      else if (key === 'hubs') state.hubs = value;
      else if (key.startsWith('article.')) setByPath(state.article, key.slice('article.'.length), value);
      syncSelectedArticle();
    } catch (error) {
      state.jsonErrors[key] = error.message;
    }
  }

  function articleWorkflowTransitions(status = 'draft') {
    return {
      draft: ['review', 'scheduled', 'published', 'archived'],
      review: ['draft', 'scheduled', 'published', 'archived'],
      scheduled: ['review', 'published', 'archived'],
      published: ['corrected', 'archived'],
      corrected: ['published', 'archived'],
      archived: ['draft']
    }[status] || ['draft'];
  }

  function bundleSnapshot() {
    syncSelectedArticle();
    return {
      schema_version: original.schema_version || 1,
      source_hash: state.sourceHash,
      site: clone(state.site),
      article: clone(currentArticle()),
      articles: clone(state.articles),
      authors: clone(state.authors),
      categories: clone(state.categories),
      hubs: clone(state.hubs),
      navigation: clone(state.navigation),
      homepage: clone(state.homepage),
      footer: clone(state.footer),
      publication_settings: clone(state.publication_settings),
      workflow: currentArticle().status || 'draft'
    };
  }

  function compareDocuments(next, previous) {
    const sections = ['site', 'article', 'articles', 'authors', 'categories', 'hubs', 'navigation', 'homepage', 'footer', 'publication_settings'];
    return sections.filter((section) => stableStringify(next?.[section] ?? null) !== stableStringify(previous?.[section] ?? null));
  }

  function validateCollections(name, items) {
    const issues = [];
    if (!Array.isArray(items)) {
      issues.push(`${name} must be an array`);
      return issues;
    }
    const seen = new Set();
    for (const [index, item] of items.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        issues.push(`${name}[${index}] must be an object`);
        continue;
      }
      const slug = String(item.slug || '').trim();
      const nameValue = String(item.name || item.title || '').trim();
      if (!slug) issues.push(`${name}[${index}].slug is required`);
      if (!nameValue) issues.push(`${name}[${index}].name is required`);
      if (seen.has(slug)) issues.push(`duplicate ${name} slug: ${slug}`);
      seen.add(slug);
    }
    return issues;
  }

  function validateState() {
    const issues = [];
    const site = state.site || {};
    const article = currentArticle() || {};
    if (!String(site.title || '').trim()) issues.push(['error', 'site.title is required']);
    if (!String(site.site_url || '').startsWith('https://')) issues.push(['error', 'site.site_url must use HTTPS']);
    if (!String(site.editor_email || '').includes('@')) issues.push(['error', 'site.editor_email must be an email address']);
    if (!THEME_PRESETS.includes(site.theme_preset || 'classic-broadsheet')) issues.push(['error', 'site.theme_preset must be a known preset']);

    const navItems = Array.isArray(state.navigation?.items) ? state.navigation.items : [];
    const seenDestinations = new Set();
    for (const [index, item] of navItems.entries()) {
      const href = String(item?.href || '').trim();
      if (!String(item?.label || '').trim()) issues.push(['error', `navigation.items[${index}].label is required`]);
      if (!(href.startsWith('/') || /^https:\/\//i.test(href))) issues.push(['error', `navigation.items[${index}].href must begin with / or https://`]);
      if (href.startsWith('/') && !validPublicationRoute(href)) issues.push(['error', `navigation.items[${index}].href points to a reserved or unknown route: ${href}`]);
      if (seenDestinations.has(href)) issues.push(['error', `navigation contains duplicate destination: ${href}`]);
      seenDestinations.add(href);
    }

    const footerColumns = Array.isArray(state.footer?.columns) ? state.footer.columns : [];
    for (const [columnIndex, column] of footerColumns.entries()) {
      for (const [linkIndex, link] of (column.links || []).entries()) {
        const href = String(link?.href || '').trim();
        if (!String(link?.label || '').trim()) issues.push(['error', `footer.columns[${columnIndex}].links[${linkIndex}].label is required`]);
        if (href.startsWith('/') && !validPublicationRoute(href)) issues.push(['error', `footer.columns[${columnIndex}].links[${linkIndex}].href points to a reserved or unknown route: ${href}`]);
      }
    }

    if (!String(article.title || '').trim()) issues.push(['error', 'article.title is required']);
    if (!STATUSES.includes(article.status || 'draft')) issues.push(['error', 'article.status must be a supported workflow state']);
    if (['scheduled', 'published', 'corrected'].includes(article.status) && !String(article.published_at || '').trim()) issues.push(['error', `${article.status} articles require published_at`]);
    if (article.status === 'corrected' && !String(article.what_changed || '').trim() && !(Array.isArray(article.corrections) && article.corrections.length)) issues.push(['error', 'corrected articles require what_changed or a correction entry']);
    if (article.featured_image && !article.featured_image_alt) issues.push(['error', 'featured_image_alt is required when featured_image is set']);
    if (Array.isArray(article.categories) && new Set(article.categories).size !== article.categories.length) issues.push(['error', 'article categories must not contain duplicates']);
    issues.push(...validateCollections('authors', state.authors));
    issues.push(...validateCollections('categories', state.categories));
    issues.push(...validateCollections('hubs', state.hubs));
    for (const key of ['navigation', 'homepage', 'footer', 'authors', 'categories', 'hubs', 'article.source_links', 'article.legacy_urls', 'article.update_history', 'article.corrections']) {
      if (state.jsonErrors[key]) issues.push(['error', `${key}: ${state.jsonErrors[key]}`]);
    }
    return issues;
  }

  function field(path, label, value, { type = 'text', className = '', list = '', placeholder = '' } = {}) {
    return `<label class="${escapeHtml(className)}">${escapeHtml(label)}<input data-path="${escapeHtml(path)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}"${list ? ` list="${escapeHtml(list)}"` : ''}${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ''}></label>`;
  }

  function textarea(path, label, value, rows = 4, className = '', hint = '') {
    const attr = JSON_TEXTAREAS.has(path) ? `data-json-field="${escapeHtml(path)}"` : `data-path="${escapeHtml(path)}"`;
    return `<label class="${escapeHtml(className)}">${escapeHtml(label)}<textarea ${attr} rows="${rows}">${escapeHtml(value)}</textarea>${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</label>`;
  }

  function select(path, label, options, value) {
    return `<label>${escapeHtml(label)}<select data-path="${escapeHtml(path)}">${options.map((option) => `<option value="${escapeHtml(option.value)}"${String(option.value) === String(value) ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
  }

  function checkbox(path, label, checked) {
    return `<label class="publisher-console-checkbox"><input data-path="${escapeHtml(path)}" type="checkbox"${checked ? ' checked' : ''}> ${escapeHtml(label)}</label>`;
  }

  function renderSiteTab() {
    const site = state.site || {};
    const layout = site.layout || {};
    return `
      <form class="publisher-console-form">
        <section>
          <p class="eyebrow">Identity</p>
          <div class="form-grid">
            ${field('site.title', 'Publication name', site.title || '', { className: 'field-wide' })}
            ${field('site.short_title', 'Short title', site.short_title || '')}
            ${field('site.tagline', 'Tagline', site.tagline || '')}
            ${field('site.editor_email', 'Editor email', site.editor_email || '', { type: 'email' })}
            ${field('site.site_url', 'Site URL', site.site_url || '', { type: 'url', className: 'field-wide' })}
            ${field('site.navigation_note', 'Navigation note', site.navigation_note || '')}
            ${field('site.footer_note', 'Footer note', site.footer_note || '')}
            ${select('site.theme_preset', 'Theme preset', THEME_PRESETS.map((value) => ({ value, label: value })), site.theme_preset || 'classic-broadsheet')}
          </div>
          ${textarea('site.description', 'Description', site.description || '', 4, 'field-wide')}
        </section>
        <section>
          <p class="eyebrow">Layout</p>
          <div class="form-grid">
            ${select('site.layout.density', 'Density', ['compact', 'balanced', 'spacious'].map((value) => ({ value, label: value })), layout.density || 'balanced')}
            ${select('site.layout.reading_width', 'Reading width', ['narrow', 'standard', 'wide'].map((value) => ({ value, label: value })), layout.reading_width || 'standard')}
            ${select('site.layout.masthead_alignment', 'Masthead alignment', ['center', 'left'].map((value) => ({ value, label: value })), layout.masthead_alignment || 'center')}
            ${select('site.layout.headline_style', 'Headline style', ['serif', 'sans'].map((value) => ({ value, label: value })), layout.headline_style || 'serif')}
            ${select('site.layout.panel_style', 'Panel style', ['square', 'soft'].map((value) => ({ value, label: value })), layout.panel_style || 'square')}
            ${select('site.layout.reader_surface', 'Reader surface', ['paper', 'light', 'sepia'].map((value) => ({ value, label: value })), layout.reader_surface || 'paper')}
          </div>
        </section>
        <section><p class="eyebrow">Structured navigation</p>${textarea('navigation', 'Navigation JSON', state.text.navigation, 10, 'field-wide', 'Edit the full nav object.')}</section>
        <section><p class="eyebrow">Homepage</p>${textarea('homepage', 'Homepage JSON', state.text.homepage, 12, 'field-wide', 'Edit homepage module order, filters, and headings.')}</section>
        <section><p class="eyebrow">Footer</p>${textarea('footer', 'Footer JSON', state.text.footer, 12, 'field-wide', 'Edit footer columns and links.')}</section>
        <section>
          <p class="eyebrow">Publication settings</p>
          <div class="form-grid">
            ${select('publication_settings.workflow', 'Workflow mode', ['editorial_review', 'strict_review'].map((value) => ({ value, label: value })), state.publication_settings.workflow || 'editorial_review')}
            ${checkbox('publication_settings.scheduled_publishing', 'Scheduled publishing', state.publication_settings.scheduled_publishing !== false)}
            ${checkbox('publication_settings.corrections_enabled', 'Corrections enabled', state.publication_settings.corrections_enabled !== false)}
            ${checkbox('publication_settings.archive_withdrawn_publications', 'Archive withdrawn publications', state.publication_settings.archive_withdrawn_publications !== false)}
            ${checkbox('publication_settings.conflict_detection', 'Conflict detection', state.publication_settings.conflict_detection !== false)}
            ${checkbox('publication_settings.preview_before_commit', 'Preview before commit', state.publication_settings.preview_before_commit !== false)}
          </div>
        </section>
      </form>`;
  }

  function renderArticleTab() {
    const article = currentArticle();
    const categoriesText = Array.isArray(article.categories) ? article.categories.join(', ') : '';
    const tagsText = Array.isArray(article.tags) ? article.tags.join(', ') : '';
    const statusOptions = STATUSES.map((value) => ({ value, label: value }));
    const typeOptions = ['standard', 'pdf', 'mixed', 'external'].map((value) => ({ value, label: value }));
    const classificationOptions = ['news', 'analysis', 'opinion', 'investigation', 'public-record', 'explainer', 'interview', 'announcement', 'developing'].map((value) => ({ value, label: value }));
    const authorOptions = [{ value: '', label: 'Choose an author' }, ...(state.authors || []).map((item) => ({ value: item.slug, label: `${item.name || item.slug}${item.active === false ? ' (inactive)' : ''}` }))];
    const hubOptions = [{ value: '', label: 'None' }, ...(state.hubs || []).map((item) => ({ value: item.slug, label: `${item.name || item.slug}${item.active === false ? ' (inactive)' : ''}` }))];
    return `
      <form class="publisher-console-form">
        <section>
          <p class="eyebrow">Select a story</p>
          <div class="form-grid">
            ${select('selection.article', 'Article record', articleList(), state.selection.article || article.slug || '')}
            ${select('article.status', 'Workflow state', statusOptions, article.status || 'draft')}
            ${select('article.article_type', 'Article type', typeOptions, article.article_type || 'standard')}
            ${select('article.classification', 'Classification', classificationOptions, article.classification || 'news')}
            ${field('article.slug', 'Slug', article.slug || '')}
            ${field('article.title', 'Headline', article.title || '', { className: 'field-wide' })}
            ${field('article.kicker', 'Eyebrow', article.kicker || '')}
            ${select('article.author', 'Author slug', authorOptions, article.author || '')}
            ${select('article.hub', 'Coverage hub', hubOptions, article.hub || '')}
            ${field('article.published_at', 'Published at', article.published_at || '', { type: 'datetime-local' })}
            ${field('article.updated_at', 'Updated at', article.updated_at || '', { type: 'datetime-local' })}
            ${field('article.document_pages', 'Document pages', String(article.document_pages ?? ''), { type: 'number' })}
          </div>
        </section>
        <section>
          <p class="eyebrow">Copy and metadata</p>
          <div class="form-grid">
            ${textarea('article.excerpt', 'Excerpt', article.excerpt || '', 3, 'field-wide')}
            ${textarea('article.body', 'Body', article.body || '', 10, 'field-wide')}
            ${field('article.featured_image', 'Featured image', article.featured_image || '', { className: 'field-wide' })}
            ${field('article.featured_image_alt', 'Featured image alt text', article.featured_image_alt || '', { className: 'field-wide' })}
            ${field('article.featured_image_caption', 'Caption', article.featured_image_caption || '')}
            ${field('article.featured_image_credit', 'Credit', article.featured_image_credit || '')}
            ${field('article.featured_image_rights', 'Rights note', article.featured_image_rights || '', { className: 'field-wide' })}
          </div>
        </section>
        <section>
          <p class="eyebrow">Publishing controls</p>
          <div class="form-grid">
            ${field('article.categories_text', 'Category slugs', categoriesText, { className: 'field-wide', placeholder: 'community-reporting, local-government' })}
            ${field('article.tags_text', 'Tags', tagsText, { className: 'field-wide', placeholder: 'publishing, workflow, records' })}
            ${checkbox('article.featured', 'Feature on homepage', article.featured === true)}
            ${checkbox('article.allow_download', 'Allow download', article.allow_download === true)}
            ${checkbox('article.show_author_bio', 'Show author bio', article.show_author_bio !== false)}
            ${checkbox('article.noindex', 'Noindex', article.noindex === true)}
            ${checkbox('article.review_content', 'Content reviewed', article.review_content === true)}
            ${checkbox('article.review_rights', 'Rights reviewed', article.review_rights === true)}
            ${checkbox('article.review_accessibility', 'Accessibility reviewed', article.review_accessibility === true)}
            ${select('article.pdf_viewer_default', 'PDF view default', [{ value: 'fit-width', label: 'fit-width' }, { value: 'fit-page', label: 'fit-page' }], article.pdf_viewer_default || 'fit-width')}
            ${field('article.pdf_file', 'PDF file', article.pdf_file || '', { className: 'field-wide' })}
            ${field('article.pdf_url', 'PDF URL', article.pdf_url || '', { className: 'field-wide' })}
            ${field('article.pdf_title', 'PDF title', article.pdf_title || '', { className: 'field-wide' })}
            ${field('article.document_description', 'Document description', article.document_description || '', { className: 'field-wide' })}
            ${field('article.document_accessible_summary', 'Accessible summary', article.document_accessible_summary || '', { className: 'field-wide' })}
            ${field('article.document_accessibility_note', 'Accessibility note', article.document_accessibility_note || '', { className: 'field-wide' })}
            ${field('article.document_date', 'Document date', article.document_date || '')}
            ${field('article.document_source', 'Document source', article.document_source || '')}
            ${field('article.external_link_label', 'External link label', article.external_link_label || '')}
            ${field('article.seo_title', 'SEO title', article.seo_title || '')}
            ${field('article.seo_description', 'SEO description', article.seo_description || '', { className: 'field-wide' })}
            ${field('article.canonical_url', 'Canonical URL', article.canonical_url || '', { className: 'field-wide' })}
            ${field('article.what_changed', 'What changed', article.what_changed || '', { className: 'field-wide' })}
            ${textarea('article.editor_notes', 'Editor notes', article.editor_notes || '', 4, 'field-wide')}
          </div>
        </section>
        <section>
          <p class="eyebrow">Structured arrays</p>
          ${textarea('article.source_links', 'Source links JSON', state.text['article.source_links'], 8, 'field-wide')}
          ${textarea('article.legacy_urls', 'Legacy URLs JSON', state.text['article.legacy_urls'], 6, 'field-wide')}
          ${textarea('article.update_history', 'Update history JSON', state.text['article.update_history'], 8, 'field-wide')}
          ${textarea('article.corrections', 'Corrections JSON', state.text['article.corrections'], 8, 'field-wide')}
        </section>
      </form>`;
  }

  function renderCollectionsTab() {
    return `
      <form class="publisher-console-form">
        <section><p class="eyebrow">Authors</p>${textarea('authors', 'Authors JSON', state.text.authors, 14, 'field-wide')}</section>
        <section><p class="eyebrow">Categories</p>${textarea('categories', 'Categories JSON', state.text.categories, 12, 'field-wide')}</section>
        <section><p class="eyebrow">Coverage hubs</p>${textarea('hubs', 'Hubs JSON', state.text.hubs, 12, 'field-wide')}</section>
      </form>`;
  }

  function renderWorkflowTab() {
    const article = currentArticle();
    const transitions = articleWorkflowTransitions(article.status || 'draft');
    return `
      <section class="publisher-console-form">
        <section>
          <p class="eyebrow">Current story</p>
          <div class="console-list">
            <div class="console-list-item">
              <header><strong>${escapeHtml(article.title || 'Untitled story')}</strong><span class="status-label status-${escapeHtml(article.status || 'draft')}">${escapeHtml(article.status || 'draft')}</span></header>
              <p>Slug: <code>${escapeHtml(article.slug || 'untitled')}</code></p>
              <p>Selected article: ${escapeHtml(state.selection.article || 'none')}</p>
              <p>Source hash: <code>${escapeHtml(state.sourceHash || 'local')}</code></p>
            </div>
          </div>
        </section>
        <section>
          <p class="eyebrow">Allowed transitions</p>
          <div class="button-row">${transitions.map((next) => `<button class="button button-secondary" type="button" data-transition="${escapeHtml(next)}">${escapeHtml(next)}</button>`).join('')}</div>
        </section>
        <section>
          <p class="eyebrow">Story operations</p>
          <div class="button-row">
            <button class="button button-secondary" type="button" data-duplicate-story>Duplicate story</button>
            <button class="button button-secondary" type="button" data-restore-archived>Restore archived as draft</button>
            <button class="button button-secondary" type="button" data-archive-story>Archive story</button>
            <button class="button button-secondary" type="button" data-correct-story>Mark corrected</button>
          </div>
        </section>
      </section>`;
  }

  function renderPreviewTab() {
    return `
      <section class="publisher-console-form">
        <section>
          <p class="eyebrow">Release bundle</p>
          <pre class="console-preview-json" tabindex="0">${escapeHtml(stableStringify(bundleSnapshot()))}</pre>
        </section>
      </section>`;
  }

  function renderEditor() {
    if (state.activeTab === 'article') return renderArticleTab();
    if (state.activeTab === 'collections') return renderCollectionsTab();
    if (state.activeTab === 'workflow') return renderWorkflowTab();
    if (state.activeTab === 'preview') return renderPreviewTab();
    return renderSiteTab();
  }

  function renderValidation() {
    const issues = validateState();
    const errors = issues.filter(([level]) => level === 'error');
    const warnings = issues.filter(([level]) => level === 'warning');
    if (validationBody) {
      validationBody.innerHTML = issues.length
        ? `<ul class="console-issues">${issues.map(([level, message]) => `<li class="console-issue console-issue-${level}">${escapeHtml(message)}</li>`).join('')}</ul>`
        : '<p>No blocking issues. The bundle is ready for export.</p>';
    }
    return { errors, warnings };
  }

  function renderPreview() {
    const article = currentArticle();
    const changes = compareDocuments(bundleSnapshot(), original);
    if (previewBody) {
      previewBody.innerHTML = `
        <dl class="console-summary">
          <div><dt>Selected article</dt><dd>${escapeHtml(article.slug || 'none')}</dd></div>
          <div><dt>Status</dt><dd><span class="status-label status-${escapeHtml(article.status || 'draft')}">${escapeHtml(article.status || 'draft')}</span></dd></div>
          <div><dt>Articles</dt><dd>${state.articles.length}</dd></div>
          <div><dt>Routes</dt><dd>${isReservedRoute('/publisher/') ? 'Reserved route' : 'Valid route'}</dd></div>
        </dl>
        <p>${state.conflict ? 'A stale bundle was imported. Resolve the conflict before exporting.' : 'The console is synced to the current repository snapshot.'}</p>
        ${state.activeTab === 'site' ? `<pre class="console-preview-json" tabindex="0">${escapeHtml(stableStringify(state.site))}</pre>` : ''}
        ${state.activeTab === 'article' ? `<pre class="console-preview-json" tabindex="0">${escapeHtml(stableStringify(article))}</pre>` : ''}
        ${state.activeTab === 'collections' ? `<pre class="console-preview-json" tabindex="0">${escapeHtml(stableStringify({ authors: state.authors, categories: state.categories, hubs: state.hubs }))}</pre>` : ''}
        ${state.activeTab === 'workflow' ? `<pre class="console-preview-json" tabindex="0">${escapeHtml(stableStringify({ workflow: article.status, transitions: articleWorkflowTransitions(article.status || 'draft') }))}</pre>` : ''}
        ${state.activeTab === 'preview' ? `<pre class="console-preview-json" tabindex="0">${escapeHtml(stableStringify(bundleSnapshot()))}</pre>` : ''}
      `;
    }
    if (diffBody) {
      diffBody.innerHTML = changes.length
        ? `<ul class="console-diff-list">${changes.map((section) => `<li>${escapeHtml(section)}</li>`).join('')}</ul>`
        : '<p>No changes from the original release bundle.</p>';
    }
  }

  function renderAll() {
    if (editorPane) editorPane.innerHTML = renderEditor();
    renderValidation();
    renderPreview();
    const issues = validateState();
    const errors = issues.filter(([level]) => level === 'error');
    const warnings = issues.filter(([level]) => level === 'warning');
    const message = state.conflict
      ? 'Stale bundle detected. Export is disabled until the conflict is resolved.'
      : errors.length
        ? `Resolve ${errors.length} blocking issue${errors.length === 1 ? '' : 's'} before export.`
        : warnings.length
          ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'} to review before export.`
          : 'Publishing Console is ready for export.';
    const live = previewBody?.querySelector('.publisher-console-live-status');
    if (live) live.remove();
    if (previewBody) {
      const status = document.createElement('p');
      status.className = 'publisher-console-live-status';
      status.textContent = message;
      previewBody.prepend(status);
    }
    const exportButton = root.querySelector('[data-console-export]');
    const copyButton = root.querySelector('[data-console-copy]');
    if (exportButton) exportButton.disabled = Boolean(state.conflict || errors.length);
    if (copyButton) copyButton.disabled = Boolean(state.conflict || errors.length);
    try { localStorage.setItem(storageKey, JSON.stringify(bundleSnapshot())); } catch {}
  }

  function importBundle(bundle) {
    if (!bundle || typeof bundle !== 'object') throw new Error('The bundle must be a JSON object.');
    if (bundle.source_hash && original.source_hash && bundle.source_hash !== original.source_hash) state.conflict = true;
    if (bundle.site) state.site = clone(bundle.site);
    if (bundle.article) state.article = clone(bundle.article);
    if (Array.isArray(bundle.articles)) state.articles = clone(bundle.articles);
    if (Array.isArray(bundle.authors)) state.authors = clone(bundle.authors);
    if (Array.isArray(bundle.categories)) state.categories = clone(bundle.categories);
    if (Array.isArray(bundle.hubs)) state.hubs = clone(bundle.hubs);
    if (bundle.navigation) state.navigation = clone(bundle.navigation);
    if (bundle.homepage) state.homepage = clone(bundle.homepage);
    if (bundle.footer) state.footer = clone(bundle.footer);
    if (bundle.publication_settings) state.publication_settings = clone(bundle.publication_settings);
    state.sourceHash = String(bundle.source_hash || state.sourceHash || '');
    state.selection.article = String(bundle.article?.slug || state.selection.article || '');
    for (const key of ['navigation', 'homepage', 'footer', 'authors', 'categories', 'hubs']) state.text[key] = stableStringify(state[key]);
    for (const key of ['source_links', 'legacy_urls', 'update_history', 'corrections']) state.text[`article.${key}`] = stableStringify(state.article[key] || []);
    syncSelectedArticle();
    renderAll();
  }

  function exportBundle() {
    return `${stableStringify(bundleSnapshot())}\n`;
  }

  function transitionArticle(status) {
    if (!STATUSES.includes(status)) return;
    applyPath('article.status', status);
    if (['scheduled', 'published', 'corrected'].includes(status) && !String(currentArticle().published_at || '').trim()) {
      applyPath('article.published_at', new Date().toISOString().slice(0, 16));
    }
    renderAll();
  }

  function duplicateStory() {
    const article = clone(currentArticle());
    article.slug = `${article.slug || 'story'}-copy`;
    article.title = `${article.title || 'Untitled story'} copy`;
    article.status = 'draft';
    article.published_at = '';
    article.updated_at = '';
    state.articles.unshift(article);
    state.selection.article = article.slug;
    state.article = clone(article);
    syncSelectedArticle();
    renderAll();
  }

  function archiveStory() {
    applyPath('article.status', 'archived');
    renderAll();
  }

  function restoreStory() {
    applyPath('article.status', 'draft');
    applyPath('article.published_at', '');
    renderAll();
  }

  function correctStory() {
    applyPath('article.status', 'corrected');
    if (!String(currentArticle().what_changed || '').trim()) applyPath('article.what_changed', 'Correction note added from the Publishing Console.');
    renderAll();
  }

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches('[data-path]')) {
      const path = target.dataset.path || '';
      const value = target.type === 'checkbox' ? target.checked : target.value;
      applyPath(path, value);
      renderAll();
      return;
    }
    if (target.matches('textarea[data-json-field]')) {
      parseJsonField(target.dataset.jsonField || '', target.value);
      renderAll();
    }
  });

  root.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const tabButton = target.closest('[data-console-tab]');
    if (tabButton) {
      state.activeTab = tabButton.dataset.consoleTab || 'site';
      renderAll();
      return;
    }
    const transitionButton = target.closest('[data-transition]');
    if (transitionButton) {
      transitionArticle(transitionButton.dataset.transition || 'draft');
      return;
    }
    if (target.closest('[data-duplicate-story]')) {
      duplicateStory();
      return;
    }
    if (target.closest('[data-archive-story]')) {
      archiveStory();
      return;
    }
    if (target.closest('[data-restore-archived]')) {
      restoreStory();
      return;
    }
    if (target.closest('[data-correct-story]')) {
      correctStory();
      return;
    }
    if (target.closest('[data-console-reset]')) {
      state.conflict = false;
      importBundle(clone(original));
      try { localStorage.removeItem(storageKey); } catch {}
      return;
    }
    if (target.closest('[data-console-export]')) {
      const blob = new Blob([exportBundle()], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'tahai-press-publishing-console-bundle.json';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      return;
    }
    if (target.closest('[data-console-copy]')) {
      try {
        await navigator.clipboard.writeText(exportBundle());
        renderAll();
      } catch {
        // Clipboard is optional.
      }
    }
  });

  if (importInput) {
    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        importBundle(JSON.parse(await file.text()));
      } catch (error) {
        if (previewBody) {
          const status = document.createElement('p');
          status.className = 'publisher-console-live-status';
          status.textContent = `Could not import bundle: ${error.message}`;
          previewBody.prepend(status);
        }
      } finally {
        importInput.value = '';
      }
    });
  }

  const authorList = document.createElement('datalist');
  authorList.id = 'publisher-console-authors';
  authorList.innerHTML = (state.authors || []).map((author) => `<option value="${escapeHtml(author.slug || '')}">${escapeHtml(author.name || author.slug || '')}</option>`).join('');
  root.append(authorList);

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; }
  })();
  if (saved && saved.source_hash === original.source_hash) {
    importBundle(saved);
  } else {
    renderAll();
  }
})();
