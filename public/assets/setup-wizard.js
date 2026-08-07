(() => {
  const root = document.querySelector('[data-launch-desk]');
  if (!root) return;

  const STORAGE_KEY = 'tahai-press-launch-desk-v1';
  const PROGRESS_KEY = 'tahai-press-launch-progress-v1';
  const MAX_HISTORY = 30;
  const DEMO_ARTICLE_FILES = [
    'sample-written-story.json',
    'sample-pdf-record.json',
    'sample-pdf-story.json',
    'sample-external-document.json'
  ];

  const parseJsonScript = (id, fallback = {}) => {
    const node = document.getElementById(id);
    if (!node) return fallback;
    try { return JSON.parse(node.textContent); } catch { return fallback; }
  };

  const initial = parseJsonScript('setup-initial-config');
  const presets = parseJsonScript('setup-theme-presets');
  const sampleArticle = parseJsonScript('setup-sample-article');
  const form = root.querySelector('form');
  const steps = [...root.querySelectorAll('[data-launch-step]')];
  const output = root.querySelector('[data-config-output]');
  const status = root.querySelector('[data-launch-status]');
  const preview = root.querySelector('[data-publication-preview]');
  const checklist = root.querySelector('[data-launch-checklist]');
  const finalChecklist = root.querySelector('[data-final-launch-checklist]');
  const moduleList = root.querySelector('[data-module-list]');
  const progressBar = root.querySelector('[data-progress-bar]');
  const progressText = root.querySelector('[data-progress-text]');
  const stepList = root.querySelector('[data-step-list]');
  const stepTitle = root.querySelector('[data-current-step-title]');
  const undoButton = root.querySelector('[data-undo-change]');
  const localApplyButton = root.querySelector('[data-apply-local]');

  const defaultState = () => ({
    schema: 1,
    step: 1,
    completed: [],
    config: structuredClone(initial),
    firstArticle: {
      ...structuredClone(sampleArticle),
      title: 'Welcome to our publication',
      slug: 'welcome-to-our-publication',
      status: 'draft',
      classification: 'news',
      kicker: 'From the editor',
      excerpt: 'Replace this example summary with two or three sentences explaining the first story.',
      body: '## Start with what matters\n\nReplace this example text with the first article. Explain the most important fact early, add context, and link to source material where readers can verify the work.',
      published_at: '',
      updated_at: '',
      featured: true,
      featured_image: '',
      featured_image_alt: '',
      featured_image_caption: '',
      featured_image_credit: '',
      featured_image_rights: '',
      tags: ['welcome'],
      related_articles: [],
      series_slug: '',
      series_title: '',
      series_description: '',
      series_order: 0,
      methodology: '',
      disclosure: '',
      rights_and_reuse: '',
      what_changed: '',
      update_history: [],
      corrections: [],
      story_blocks: []
    },
    firstRecord: {
      title: '', summary: ''
    },
    editorReady: false,
    deploymentReady: false,
    launchPlan: {
      mission: '', missionReady: false, standardsReady: false, accessibilityReady: false,
      importReady: false, recordReady: false, ownershipReady: false
    },
    history: [],
    updatedAt: new Date().toISOString()
  });

  const stored = (() => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return value?.schema === 1 ? value : null;
    } catch { return null; }
  })();
  let state = stored || defaultState();
  let historyTimer = 0;

  const field = (name) => form.elements.namedItem(name);
  const value = (name) => {
    const control = field(name);
    if (!control) return '';
    if (control.type === 'checkbox') return control.checked;
    return control.value;
  };
  const setValue = (name, next) => {
    const control = field(name);
    if (!control) return;
    if (control.type === 'checkbox') control.checked = Boolean(next);
    else control.value = next ?? '';
  };

  const slugify = (input) => String(input || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'first-story';

  const deriveShortTitle = (title) => String(title || 'Your Publication').trim().slice(0, 60) || 'Your Publication';
  const deriveMark = (title) => {
    const letters = String(title || '').trim().split(/\s+/).slice(0, 2)
      .map((word) => word.match(/[A-Za-z0-9]/)?.[0] || '').join('');
    return (letters || 'P').toUpperCase();
  };

  const download = (filename, content, type = 'application/json') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const announce = (message) => {
    status.textContent = message;
  };

  function initialFormValues() {
    const config = state.config || initial;
    setValue('title', config.title);
    setValue('tagline', config.tagline);
    setValue('description', config.description);
    setValue('site_url', config.site_url);
    setValue('editor_email', config.editor_email);
    setValue('logo', config.logo);
    setValue('default_social_image', config.default_social_image);
    setValue('theme_preset', config.theme_preset || 'classic-broadsheet');
    setValue('density', config.layout?.density || 'balanced');
    setValue('reading_width', config.layout?.reading_width || 'standard');
    setValue('masthead_alignment', config.layout?.masthead_alignment || 'center');
    setValue('headline_style', config.layout?.headline_style || 'serif');
    setValue('panel_style', config.layout?.panel_style || 'square');
    setValue('reader_surface', config.layout?.reader_surface || 'paper');
    setValue('reader_reach_enabled', config.reader_reach?.enabled !== false);
    setValue('offline_enabled', config.reader_reach?.offline_enabled !== false);
    setValue('saved_articles_enabled', config.reader_reach?.saved_articles_enabled !== false);
    setValue('browser_share_enabled', config.reader_reach?.browser_share_enabled !== false);
    setValue('current_edition_enabled', config.reader_reach?.current_edition_enabled !== false);
    setValue('navigation', (config.navigation?.items || []).map((item) => `${item.label} | ${item.href}`).join('\n'));
    setValue('editor_ready', state.editorReady);
    setValue('deployment_ready', state.deploymentReady);
    setValue('article_title', state.firstArticle.title);
    setValue('article_excerpt', state.firstArticle.excerpt);
    setValue('article_body', state.firstArticle.body);
    setValue('article_author', state.firstArticle.author || 'editorial-team');
    setValue('article_category', state.firstArticle.categories?.[0] || 'community-reporting');
    setValue('article_image', state.firstArticle.featured_image || '');
    setValue('article_image_alt', state.firstArticle.featured_image_alt || '');
    setValue('record_title', state.firstRecord?.title || '');
    setValue('record_summary', state.firstRecord?.summary || '');
    setValue('mission', state.launchPlan?.mission || '');
    setValue('mission_ready', state.launchPlan?.missionReady);
    setValue('standards_ready', state.launchPlan?.standardsReady);
    setValue('accessibility_ready', state.launchPlan?.accessibilityReady);
    setValue('import_ready', state.launchPlan?.importReady);
    setValue('record_ready', state.launchPlan?.recordReady);
    setValue('ownership_ready', state.launchPlan?.ownershipReady);
  }

  function createModuleItem(module) {
    const labels = {
      intro: 'Lead introduction', setup: 'Start here panel', license: 'License explanation', featured: 'Lead story',
      latest: 'Latest stories', reach: 'Reader tools and offline reading', studio: 'Contributor Composer',
      product: 'TAHAI Press project panel', pillars: 'Publishing principles', hubs: 'Coverage hubs', submit: 'Submission callout',
      lead_story: 'Lead story', secondary_headlines: 'Secondary headlines', category_strip: 'Category strip', coverage_hub: 'Coverage hub',
      public_record_desk: 'Public-record desk', featured_investigation: 'Featured investigation', editors_note: 'Editor’s note',
      recently_updated: 'Most recently updated', document_spotlight: 'Document spotlight', crossword_promotion: 'Crossword promotion',
      submission_callout: 'Submission callout', accessibility_notice: 'Accessibility notice', custom_text_panel: 'Custom text panel'
    };
    const item = document.createElement('li');
    item.dataset.moduleType = module.type;
    item.innerHTML = `<label><input type="checkbox" ${module.enabled === false ? '' : 'checked'}> <span>${labels[module.type] || module.type}</span></label><span class="module-actions"><button type="button" data-move="up" aria-label="Move ${labels[module.type] || module.type} earlier">↑</button><button type="button" data-move="down" aria-label="Move ${labels[module.type] || module.type} later">↓</button><button type="button" data-remove-module aria-label="Remove ${labels[module.type] || module.type}">Remove</button></span>`;
    return item;
  }

  function renderModules() {
    moduleList.replaceChildren();
    for (const module of state.config.homepage?.modules || []) moduleList.append(createModuleItem(module));
  }

  function navigationItems() {
    return String(value('navigation') || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const separator = line.indexOf('|');
      if (separator < 0) return null;
      const label = line.slice(0, separator).trim();
      const href = line.slice(separator + 1).trim();
      return label && href ? { label, href } : null;
    }).filter(Boolean);
  }

  function homepageModules() {
    return [...moduleList.querySelectorAll('[data-module-type]')].map((item) => {
      const original = (state.config.homepage?.modules || []).find((module) => module.type === item.dataset.moduleType) || {};
      return { ...original, type: item.dataset.moduleType, enabled: item.querySelector('input').checked };
    });
  }

  function buildConfig({ launch = false } = {}) {
    const title = String(value('title') || '').trim() || 'Your Publication';
    const tagline = String(value('tagline') || '').trim() || 'Independent reporting, clearly presented.';
    const description = String(value('description') || '').trim() || tagline;
    const config = structuredClone(state.config || initial);
    config.setup_version = 6;
    config.title = title;
    config.short_title = deriveShortTitle(title);
    config.brand_mark = deriveMark(title);
    config.tagline = tagline;
    config.description = description;
    config.site_url = String(value('site_url') || '').trim();
    config.editor_email = String(value('editor_email') || '').trim();
    config.logo = String(value('logo') || '').trim();
    config.default_social_image = String(value('default_social_image') || '').trim();
    config.default_social_image_alt = config.default_social_image ? `${title} publication social preview.` : '';
    config.masthead_kicker = `${title} · Independent publication`;
    config.hero_kicker = 'Latest edition';
    config.hero_title = `Reporting and source documents from ${title}.`;
    config.hero_description = description;
    config.navigation_note = 'Make it easy. Make it fast.';
    config.theme_preset = String(value('theme_preset') || 'classic-broadsheet');
    config.layout = {
      density: String(value('density') || 'balanced'),
      reading_width: String(value('reading_width') || 'standard'),
      masthead_alignment: String(value('masthead_alignment') || 'center'),
      headline_style: String(value('headline_style') || 'serif'),
      panel_style: String(value('panel_style') || 'square'),
      reader_surface: String(value('reader_surface') || 'paper')
    };
    config.navigation = { note: 'Make it easy. Make it fast.', items: navigationItems() };
    config.homepage = { modules: homepageModules() };
    config.reader_reach = {
      ...(config.reader_reach || {}),
      enabled: Boolean(value('reader_reach_enabled')),
      offline_enabled: Boolean(value('offline_enabled')),
      saved_articles_enabled: Boolean(value('saved_articles_enabled')),
      browser_share_enabled: Boolean(value('browser_share_enabled')),
      current_edition_enabled: Boolean(value('current_edition_enabled')),
      current_edition_count: Number(config.reader_reach?.current_edition_count || 8),
      offline_article_count: Number(config.reader_reach?.offline_article_count || 12)
    };
    config.template_mode = launch ? false : config.template_mode !== false;
    if (config.accessibility) config.accessibility.contact_email = config.editor_email;
    if (config.seo) {
      config.seo.feed_title = title;
      config.seo.feed_description = description;
      if (launch) config.seo.social_profiles = [];
    }
    return config;
  }

  function buildFirstArticle() {
    const title = String(value('article_title') || '').trim() || 'Welcome to our publication';
    const article = structuredClone(state.firstArticle);
    article.title = title;
    article.slug = slugify(title);
    delete article.__file;
    article.status = 'draft';
    article.article_type = 'standard';
    article.classification = 'news';
    article.kicker = 'From the editor';
    article.excerpt = String(value('article_excerpt') || '').trim();
    article.body = String(value('article_body') || '').trim();
    article.author = String(value('article_author') || 'editorial-team').trim();
    article.categories = [String(value('article_category') || 'community-reporting').trim()];
    article.tags = ['welcome'];
    article.featured = true;
    article.featured_image = String(value('article_image') || '').trim();
    article.featured_image_alt = String(value('article_image_alt') || '').trim();
    article.published_at = '';
    article.updated_at = '';
    article.pdf_file = '';
    article.pdf_url = '';
    article.pdf_title = '';
    article.document_description = '';
    article.document_accessible_summary = '';
    article.document_accessibility_note = '';
    article.document_date = '';
    article.document_pages = 0;
    article.document_source = '';
    article.external_link_label = '';
    article.allow_download = false;
    article.canonical_url = '';
    article.seo_title = title;
    article.seo_description = article.excerpt;
    article.noindex = true;
    article.review_content = false;
    article.review_rights = !article.featured_image;
    article.review_accessibility = !article.featured_image || Boolean(article.featured_image_alt);
    article.editor_notes = 'Created by Launch Desk. Review, add sources, and publish through Pages CMS.';
    article.legacy_urls = [];
    article.source_links = [];
    article.story_blocks = [];
    article.related_articles = [];
    return article;
  }

  function buildFirstRecord() {
    const title = String(state.firstRecord?.title || '').trim();
    const summary = String(state.firstRecord?.summary || '').trim();
    return {
      title, slug: slugify(title || 'first-public-record'), status: 'draft', article_type: 'pdf', classification: 'public_record',
      kicker: 'Public record', excerpt: summary, body: summary, published_at: '', updated_at: '', author: 'editorial-team',
      categories: [String(value('article_category') || 'community-reporting').trim()], tags: ['public-record'], hub: '', featured: false,
      featured_image: '', featured_image_alt: '', featured_image_caption: '', featured_image_credit: '', featured_image_rights: '',
      featured_image_aspect: 'original', featured_image_focal_point: 'center', story_blocks: [], series_slug: '', series_title: '',
      series_description: '', related_articles: [], methodology: '', disclosure: '', rights_and_reuse: '', what_changed: '', update_history: [], corrections: [],
      pdf_file: '', pdf_url: '', pdf_title: '', document_description: '', document_accessible_summary: '', document_accessibility_note: '',
      document_date: '', document_pages: 0, document_source: '', external_link_label: '', allow_download: false, canonical_url: '', noindex: true,
      review_content: false, review_rights: false, review_accessibility: false, editor_notes: 'Created by Launch Desk. Add the original record and accessible HTML summary before publication.', legacy_urls: [], source_links: []
    };
  }

  function launchIssues(config, article) {
    const issues = [];
    let siteHost = '';
    try { siteHost = new URL(config.site_url || '').hostname; } catch {}
    if (!/^https:\/\/[^/]+\/?$/.test(config.site_url || '') || !siteHost || /(^|\.)example\.|^example\.pages\.dev$/i.test(siteHost)) issues.push(['blocker', 'Add the real web address Cloudflare will use.']);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.editor_email || '') || /@example\./i.test(config.editor_email || '')) issues.push(['blocker', 'Add an email address readers can use.']);
    if (/^TAHAI Press$/i.test(config.title || '') || /^Your Publication$/i.test(config.title || '')) issues.push(['blocker', 'Name the publication.']);
    if (config.logo?.includes('tahai-press')) issues.push(['attention', 'The demonstration logo is still selected. You may remove it now and upload your logo later.']);
    if (!config.navigation?.items?.length) issues.push(['blocker', 'Keep at least one navigation link.']);
    if (!state.editorReady) issues.push(['attention', 'Confirm that GitHub and Pages CMS are ready for editing.']);
    if (!state.deploymentReady) issues.push(['attention', 'Confirm that Cloudflare Pages is connected to the main branch.']);
    if (!article.title || !article.excerpt || !article.body) issues.push(['attention', 'Finish the first-story draft so it is ready to review in Pages CMS.']);
    if (article.featured_image && !article.featured_image_alt) issues.push(['blocker', 'Describe the first-story image or remove it.']);
    return issues;
  }

  function completionForStep(step, config, article) {
    if (step === 1) return true;
    if (step === 2) return !/^TAHAI Press$|^Your Publication$/i.test(config.title) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.editor_email || '');
    if (step === 3) return Boolean(config.theme_preset);
    if (step === 4) return config.navigation.items.length > 0 && config.homepage.modules.some((item) => item.enabled !== false);
    if (step === 5) return state.editorReady && state.deploymentReady;
    if (step === 6) return Boolean(article.title && article.excerpt && article.body && (!article.featured_image || article.featured_image_alt));
    if (step === 7) return launchIssues(config, article).every(([kind]) => kind !== 'blocker');
    if (step === 8) return Boolean(state.launchPlan?.missionReady && state.launchPlan?.mission?.trim());
    if (step === 9) return Boolean(state.launchPlan?.standardsReady && state.launchPlan?.accessibilityReady);
    if (step === 10) return Boolean(state.launchPlan?.importReady);
    if (step === 11) return Boolean(state.launchPlan?.recordReady && state.firstRecord?.title?.trim() && state.firstRecord?.summary?.trim());
    if (step === 12) return Boolean(state.launchPlan?.ownershipReady);
    if (step === 13) return launchIssues(config, article).every(([kind]) => kind !== 'blocker') && [8, 9, 10, 11, 12].every((index) => completionForStep(index, config, article));
    return false;
  }

  function persist() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ completed: state.completed, step: state.step, total: 13, updatedAt: state.updatedAt }));
  }

  function snapshot() {
    return {
      config: buildConfig(),
      firstArticle: buildFirstArticle(),
      firstRecord: structuredClone(state.firstRecord || {}),
      editorReady: Boolean(value('editor_ready')),
      deploymentReady: Boolean(value('deployment_ready')),
      launchPlan: structuredClone(state.launchPlan || {}),
      step: state.step,
      completed: [...state.completed]
    };
  }

  function pushHistory() {
    const snap = snapshot();
    const serialized = JSON.stringify(snap);
    const previous = state.history.at(-1);
    if (previous && JSON.stringify(previous) === serialized) return;
    state.history.push(snap);
    if (state.history.length > MAX_HISTORY) state.history.shift();
    undoButton.disabled = state.history.length < 2;
  }

  function syncState({ record = true } = {}) {
    state.config = buildConfig();
    state.firstArticle = buildFirstArticle();
    state.firstRecord = { title: String(value('record_title') || '').trim(), summary: String(value('record_summary') || '').trim() };
    state.editorReady = Boolean(value('editor_ready'));
    state.deploymentReady = Boolean(value('deployment_ready'));
    const completed = [];
    state.launchPlan = {
      mission: String(value('mission') || '').trim(),
      missionReady: Boolean(value('mission_ready')),
      standardsReady: Boolean(value('standards_ready')),
      accessibilityReady: Boolean(value('accessibility_ready')),
      importReady: Boolean(value('import_ready')),
      recordReady: Boolean(value('record_ready')),
      ownershipReady: Boolean(value('ownership_ready'))
    };
    for (let index = 1; index <= 13; index += 1) if (completionForStep(index, state.config, state.firstArticle)) completed.push(index);
    state.completed = completed;
    if (record) {
      clearTimeout(historyTimer);
      historyTimer = setTimeout(() => { pushHistory(); persist(); render(); }, 250);
    } else persist();
  }

  function restoreSnapshot(snap) {
    state.config = structuredClone(snap.config);
    state.firstArticle = structuredClone(snap.firstArticle);
    state.firstRecord = structuredClone(snap.firstRecord || defaultState().firstRecord);
    state.editorReady = snap.editorReady;
    state.deploymentReady = snap.deploymentReady;
    state.launchPlan = structuredClone(snap.launchPlan || defaultState().launchPlan);
    state.step = snap.step;
    state.completed = [...snap.completed];
    initialFormValues();
    renderModules();
    persist();
    render();
  }

  function renderPreview(config, article) {
    const theme = presets[config.theme_preset]?.theme || config.theme || {};
    const previewTitle = preview.querySelector('[data-preview-title]');
    const previewTagline = preview.querySelector('[data-preview-tagline]');
    const previewHeadline = preview.querySelector('[data-preview-headline]');
    const previewExcerpt = preview.querySelector('[data-preview-excerpt]');
    const previewNav = preview.querySelector('[data-preview-nav]');
    previewTitle.textContent = config.title;
    previewTagline.textContent = config.tagline;
    previewHeadline.textContent = article.title;
    previewExcerpt.textContent = article.excerpt;
    previewNav.textContent = config.navigation.items.slice(0, 5).map((item) => item.label).join('  ·  ') || 'Stories · Search · About';
    preview.style.setProperty('--launch-brand', theme.brand || '#123a5a');
    preview.style.setProperty('--launch-paper', theme.paper || '#fffdf7');
    preview.style.setProperty('--launch-surface', theme.surface || '#f3efe5');
    preview.style.setProperty('--launch-accent', theme.accent || '#345f7f');
    preview.dataset.density = config.layout.density;
    preview.dataset.headline = config.layout.headline_style;
  }

  function render() {
    const config = buildConfig();
    const article = buildFirstArticle();
    state.step = Math.max(1, Math.min(13, Number(state.step || 1)));
    steps.forEach((step) => {
      const active = Number(step.dataset.launchStep) === state.step;
      step.hidden = !active;
      step.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    const current = steps.find((step) => Number(step.dataset.launchStep) === state.step);
    stepTitle.textContent = current?.dataset.stepTitle || `Step ${state.step}`;
    const completedCount = state.completed.filter((step) => step <= 13).length;
    progressText.textContent = `${completedCount} of 13 launch steps complete`;
    progressBar.max = 13;
    progressBar.value = completedCount;
    stepList.querySelectorAll('[data-step-jump]').forEach((button) => {
      const step = Number(button.dataset.stepJump);
      button.classList.toggle('is-current', step === state.step);
      button.classList.toggle('is-complete', state.completed.includes(step));
      button.setAttribute('aria-current', step === state.step ? 'step' : 'false');
    });
    output.textContent = `${JSON.stringify(config, null, 2)}\n`;
    renderPreview(config, article);
    const issues = launchIssues(config, article);
    const checklistMarkup = issues.length
      ? issues.map(([kind, text]) => `<li class="${kind}"><strong>${kind === 'blocker' ? 'Before launch' : 'Review'}:</strong> ${text}</li>`).join('')
      : '<li class="ready"><strong>Ready:</strong> No launch blockers detected.</li>';
    checklist.innerHTML = checklistMarkup;
    if (finalChecklist) finalChecklist.innerHTML = checklistMarkup;
    root.querySelector('[data-first-article-slug]').textContent = `${slugify(article.title)}.json`;
    root.querySelector('[data-first-article-state]').textContent = completionForStep(6, config, article) ? 'Ready for editor review' : 'Needs a little more information';
    root.querySelectorAll('[data-next-step]').forEach((button) => {
      const from = Number(button.closest('[data-launch-step]')?.dataset.launchStep || 1);
      button.disabled = from > 1 && from < 13 && !completionForStep(from, config, article);
    });
    undoButton.disabled = state.history.length < 2;
    if (localApplyButton) localApplyButton.hidden = typeof window.showDirectoryPicker !== 'function';
  }

  function moveTo(step) {
    syncState({ record: false });
    state.step = Math.max(1, Math.min(13, step));
    persist();
    render();
    root.querySelector('[data-launch-step]:not([hidden]) h2')?.focus({ preventScroll: true });
    root.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function applyRecommended(step) {
    if (step === 2) {
      if (!String(value('title')).trim() || /^TAHAI Press$/i.test(value('title'))) setValue('title', 'Your Publication');
      if (!String(value('tagline')).trim()) setValue('tagline', 'Independent reporting, clearly presented.');
      if (!String(value('description')).trim()) setValue('description', 'Local reporting, public records, and community information presented clearly and accessibly.');
      setValue('logo', '');
      setValue('default_social_image', '');
    }
    if (step === 3) {
      setValue('theme_preset', 'classic-broadsheet');
      setValue('density', 'balanced');
      setValue('reading_width', 'standard');
      setValue('masthead_alignment', 'center');
      setValue('headline_style', 'serif');
      setValue('panel_style', 'square');
      setValue('reader_surface', 'paper');
      setValue('reader_reach_enabled', true);
      setValue('offline_enabled', true);
      setValue('saved_articles_enabled', true);
      setValue('browser_share_enabled', true);
      setValue('current_edition_enabled', true);
    }
    if (step === 4) {
      setValue('navigation', 'Stories | /stories/\nSearch | /search/\nSections | /sections/\nAbout | /about/\nContact | /contact/');
      moduleList.querySelectorAll('input').forEach((input) => { input.checked = !['setup', 'license', 'product'].includes(input.closest('[data-module-type]').dataset.moduleType); });
    }
    if (step === 6) {
      setValue('article_title', `Welcome to ${String(value('title') || 'our publication').trim()}`);
      setValue('article_excerpt', 'A brief note introducing the publication, what it will cover, and how readers can follow or contribute.');
      setValue('article_body', '## Welcome\n\nExplain why this publication exists, what readers can expect, and how accuracy, sourcing, corrections, and accessibility will guide the work.\n\n## What comes next\n\nTell readers which communities, public records, or subjects the publication plans to cover first.');
      setValue('article_image', '');
      setValue('article_image_alt', '');
    }
    syncState();
    announce('Recommended settings applied. Review the preview, then continue.');
  }

  function launchPackage() {
    return {
      schema_version: 1,
      software: 'TAHAI Press',
      release: '1.9.0',
      generated_at: new Date().toISOString(),
      instructions: 'Apply with npm run launch:apply -- --package <file> --confirm, or use Apply to local repository in a supported browser.',
      launch_plan: structuredClone(state.launchPlan || {}),
      remove_demo: true,
      demo_article_files: DEMO_ARTICLE_FILES,
      site_config: buildConfig({ launch: true }),
      first_article: buildFirstArticle(),
      first_record: buildFirstRecord(),
      author_record: {
        slug: 'editorial-team',
        name: `${buildConfig({ launch: true }).title} Editorial Team`,
        role: 'Editorial team',
        bio: `Reporting and editing for ${buildConfig({ launch: true }).title}.`,
        active: true
      }
    };
  }

  async function writeJsonFile(directory, filename, data) {
    const handle = await directory.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    await writable.write(`${JSON.stringify(data, null, 2)}\n`);
    await writable.close();
  }

  async function applyToLocalRepository() {
    try {
      const rootDirectory = await window.showDirectoryPicker({ mode: 'readwrite', id: 'tahai-press-repository' });
      const contentDirectory = await rootDirectory.getDirectoryHandle('content');
      const articlesDirectory = await contentDirectory.getDirectoryHandle('articles');
      const backupRoot = await rootDirectory.getDirectoryHandle('.launch-backups', { create: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDirectory = await backupRoot.getDirectoryHandle(stamp, { create: true });
      const currentSite = await (await contentDirectory.getFileHandle('site.json')).getFile();
      const siteText = await currentSite.text();
      const siteBackup = await backupDirectory.getFileHandle('site.json', { create: true });
      const siteBackupWriter = await siteBackup.createWritable();
      await siteBackupWriter.write(siteText);
      await siteBackupWriter.close();
      for (const filename of DEMO_ARTICLE_FILES) {
        try {
          const file = await (await articlesDirectory.getFileHandle(filename)).getFile();
          const text = await file.text();
          const backup = await backupDirectory.getFileHandle(filename, { create: true });
          const writer = await backup.createWritable();
          await writer.write(text);
          await writer.close();
          await articlesDirectory.removeEntry(filename);
        } catch {}
      }
      const authorsDirectory = await contentDirectory.getDirectoryHandle('authors', { create: true });
      try {
        const authorFile = await (await authorsDirectory.getFileHandle('editorial-team.json')).getFile();
        const authorBackup = await backupDirectory.getFileHandle('editorial-team.json', { create: true });
        const authorBackupWriter = await authorBackup.createWritable();
        await authorBackupWriter.write(await authorFile.text());
        await authorBackupWriter.close();
      } catch {}
      const pack = launchPackage();
      await writeJsonFile(contentDirectory, 'site.json', pack.site_config);
      await writeJsonFile(articlesDirectory, `${pack.first_article.slug}.json`, pack.first_article);
      await writeJsonFile(articlesDirectory, `${pack.first_record.slug}.json`, pack.first_record);
      await writeJsonFile(authorsDirectory, `${pack.author_record.slug}.json`, pack.author_record);
      announce(`Launch files applied. A backup was saved in .launch-backups/${stamp}. Commit the changes when ready.`);
      state.completed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
      persist();
      render();
    } catch (error) {
      if (error?.name === 'AbortError') announce('No folder was changed.');
      else announce(`The browser could not apply the files: ${error.message}. Download the launch package instead.`);
    }
  }

  form.addEventListener('input', () => syncState());
  form.addEventListener('change', () => syncState());

  moduleList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-move]');
    const remove = event.target.closest('[data-remove-module]');
    if (remove) {
      remove.closest('[data-module-type]')?.remove();
      syncState();
      return;
    }
    if (!button) return;
    const item = button.closest('[data-module-type]');
    if (button.dataset.move === 'up' && item.previousElementSibling) moduleList.insertBefore(item, item.previousElementSibling);
    if (button.dataset.move === 'down' && item.nextElementSibling) moduleList.insertBefore(item.nextElementSibling, item);
    syncState();
  });

  root.addEventListener('click', async (event) => {
    const next = event.target.closest('[data-next-step]');
    if (next) moveTo(Number(next.closest('[data-launch-step]').dataset.launchStep) + 1);
    const back = event.target.closest('[data-back-step]');
    if (back) moveTo(Number(back.closest('[data-launch-step]').dataset.launchStep) - 1);
    const jump = event.target.closest('[data-step-jump]');
    if (jump) moveTo(Number(jump.dataset.stepJump));
    const recommended = event.target.closest('[data-use-recommended]');
    if (recommended) applyRecommended(Number(recommended.closest('[data-launch-step]').dataset.launchStep));
    if (event.target.closest('[data-add-home-module]')) {
      const type = root.querySelector('[data-add-home-module]')?.value;
      if (!type) return;
      if (moduleList.querySelector(`[data-module-type="${CSS.escape(type)}"]`)) {
        announce('That homepage section is already present. Use its controls to reorder or enable it.');
        return;
      }
      moduleList.append(createModuleItem({ type, enabled: true }));
      syncState();
      announce('Homepage section added. You can reorder it with the arrow buttons.');
    }
    if (event.target.closest('[data-download-backup]')) {
      download(`tahai-press-before-launch-${new Date().toISOString().slice(0, 10)}.json`, `${JSON.stringify({ schema_version: 1, saved_at: new Date().toISOString(), site_config: initial, sample_article: sampleArticle }, null, 2)}\n`);
      announce('Backup downloaded. Keep it until the new publication is live.');
    }
    if (event.target.closest('[data-download-launch]')) {
      if (!completionForStep(13, buildConfig(), buildFirstArticle())) {
        announce('Complete the remaining launch commitments before preparing the launch package.');
        return;
      }
      const pack = launchPackage();
      download('tahai-press-launch-package.json', `${JSON.stringify(pack, null, 2)}\n`);
      announce('Launch package downloaded. It includes the publication settings and first-story draft.');
    }
    if (event.target.closest('[data-download-config]')) {
      download('site.json', `${JSON.stringify(buildConfig(), null, 2)}\n`);
      announce('site.json downloaded.');
    }
    if (event.target.closest('[data-copy-config]')) {
      await navigator.clipboard.writeText(`${JSON.stringify(buildConfig(), null, 2)}\n`);
      announce('Configuration copied.');
    }
    if (event.target.closest('[data-undo-change]')) {
      if (state.history.length < 2) return;
      state.history.pop();
      restoreSnapshot(state.history.at(-1));
      announce('The most recent setup change was undone.');
    }
    if (event.target.closest('[data-reset-launch]')) {
      if (!confirm('Reset Launch Desk on this browser and return to the demonstration defaults?')) return;
      state = defaultState();
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PROGRESS_KEY);
      initialFormValues();
      renderModules();
      pushHistory();
      persist();
      render();
      announce('Launch Desk reset.');
    }
    if (event.target.closest('[data-apply-local]')) {
      if (!completionForStep(13, buildConfig(), buildFirstArticle())) {
        announce('Complete the remaining launch commitments before applying files.');
        return;
      }
      await applyToLocalRepository();
    }
  });

  initialFormValues();
  renderModules();
  if (!state.history.length) pushHistory();
  syncState({ record: false });
  render();
})();
