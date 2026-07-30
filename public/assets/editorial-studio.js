(() => {
  const root = document.querySelector('[data-editorial-studio]');
  if (!root) return;

  const form = root.querySelector('[data-studio-form]');
  const storageKey = 'tahai-press-editorial-studio-v3';
  const draftLibraryKey = 'tahai-press-editorial-studio-drafts-v1';
  const fields = Object.fromEntries([...form.elements]
    .filter((field) => field.name)
    .map((field) => [field.name, field]));
  const status = root.querySelector('[data-studio-status]');
  const checks = root.querySelector('[data-studio-checks]');
  const summaryCount = root.querySelector('[data-summary-count]');
  const readingTime = root.querySelector('[data-reading-time]');
  const draftLibrary = root.querySelector('[data-studio-draft-library]');
  const importFile = root.querySelector('[data-studio-import]');
  const preview = {
    kicker: root.querySelector('[data-preview-kicker]'),
    headline: root.querySelector('[data-preview-headline]'),
    summary: root.querySelector('[data-preview-summary]'),
    byline: root.querySelector('[data-preview-byline]'),
    body: root.querySelector('[data-preview-body]'),
    figure: root.querySelector('[data-preview-figure]'),
    image: root.querySelector('[data-preview-image]'),
    caption: root.querySelector('[data-preview-caption]')
  };

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const inlineMarkdown = (text = '') => escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  const renderMarkdown = (markdown = '') => {
    const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
    const output = [];
    let paragraph = [];
    let list = false;
    const flush = () => {
      if (paragraph.length) output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
      if (list) output.push('</ul>');
      list = false;
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flush(); continue; }
      if (line.startsWith('## ')) { flush(); output.push(`<h3>${inlineMarkdown(line.slice(3))}</h3>`); continue; }
      if (line.startsWith('- ')) {
        if (paragraph.length) { output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`); paragraph = []; }
        if (!list) { output.push('<ul>'); list = true; }
        output.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
        continue;
      }
      paragraph.push(line);
    }
    flush();
    return output.join('') || '<p>Start writing to preview the story.</p>';
  };

  const slugify = (value = '') => String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 120) || 'untitled-story';

  const isoDate = (value) => {
    if (!value) return new Date().toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  };

  const wordCount = (value = '') => String(value).trim().split(/\s+/).filter(Boolean).length;
  const minutes = (value = '') => Math.max(0, Math.ceil(wordCount(value) / 225));

  const values = () => Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value]));

  const articleRecord = () => {
    const data = values();
    const hasImage = Boolean(data.featured_image.trim());
    return {
      title: data.title.trim(),
      slug: slugify(data.title),
      status: 'draft',
      article_type: 'standard',
      classification: data.classification || 'news',
      kicker: data.kicker.trim(),
      excerpt: data.excerpt.trim(),
      body: data.body.trim(),
      published_at: isoDate(data.published_at),
      updated_at: '',
      author: data.author,
      categories: [data.category],
      tags: data.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20),
      hub: '',
      featured: false,
      featured_image: data.featured_image.trim(),
      featured_image_alt: data.featured_image_alt.trim(),
      featured_image_caption: data.featured_image_caption.trim(),
      featured_image_credit: data.featured_image_credit.trim(),
      featured_image_rights: '',
      featured_image_aspect: hasImage ? 'landscape' : 'original',
      featured_image_focal_point: 'center',
      story_blocks: [],
      series_slug: '',
      series_title: '',
      series_description: '',
      related_articles: [],
      methodology: '',
      disclosure: '',
      rights_and_reuse: '',
      what_changed: '',
      update_history: [],
      corrections: [],
      pdf_file: '',
      pdf_url: '',
      pdf_title: '',
      document_description: '',
      document_accessible_summary: '',
      document_accessibility_note: '',
      document_date: '',
      document_pages: 0,
      document_source: '',
      external_link_label: '',
      allow_download: false,
      pdf_viewer_default: 'fit-width',
      show_author_bio: true,
      source_links: [],
      seo_title: '',
      seo_description: '',
      canonical_url: '',
      legacy_urls: [],
      noindex: true,
      review_content: false,
      review_rights: false,
      review_accessibility: false,
      editor_notes: 'Created with the browser-only TAHAI Press Editorial Studio. Review before publishing.'
    };
  };

  const audit = () => {
    const data = values();
    const findings = [];
    const add = (level, text) => findings.push({ level, text });
    const title = data.title.trim();
    const summary = data.excerpt.trim();
    const body = data.body.trim();
    const paragraphs = body.split(/\n\s*\n/).map((item) => item.replace(/^#+\s*/, '').trim()).filter(Boolean);
    const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({ level: match[1].length, text: match[2].trim() }));
    const links = [...body.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)].map((match) => ({ label: match[1].trim(), url: match[2].trim() }));
    const markdownImages = [...body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map((match) => ({ alt: match[1].trim(), url: match[2].trim() }));

    if (title.length < 5) add('blocker', 'Add a specific headline of at least five characters.');
    else if (title.length > 110) add('attention', 'Shorten the headline for easier scanning and sharing.');
    else add('ready', 'Headline length is reader-friendly.');

    if (summary.length < 20) add('blocker', 'Add a plain-language summary of at least 20 characters.');
    else if (summary.length > 220) add('attention', 'Consider a shorter summary for cards and search results.');
    else add('ready', 'Summary is concise and useful.');

    if (wordCount(body) < 30) add('blocker', 'Add enough article text for a meaningful draft.');
    else add('ready', 'Article text is substantial enough for review.');

    if (/\b(click here|read more here|learn more here)\b/i.test(body)) add('attention', 'Replace vague link text such as “click here” with the destination or purpose.');
    else add('ready', 'Links avoid vague “click here” wording.');

    if (links.some((link) => !link.label || !link.url)) add('blocker', 'Every Markdown link needs both descriptive text and a destination.');
    else add('ready', 'Markdown links have text and destinations.');

    const labelTargets = new Map();
    let ambiguousLink = false;
    for (const link of links) {
      const key = link.label.toLowerCase();
      if (labelTargets.has(key) && labelTargets.get(key) !== link.url) ambiguousLink = true;
      labelTargets.set(key, link.url);
    }
    if (ambiguousLink) add('attention', 'Identical link labels point to different destinations; make each label more specific.');

    if (paragraphs.some((paragraph) => wordCount(paragraph) > 140)) add('attention', 'Break up paragraphs longer than about 140 words.');
    else add('ready', 'Paragraph lengths support comfortable reading.');

    const letters = title.replace(/[^A-Za-z]/g, '');
    if (letters.length > 12 && letters === letters.toUpperCase()) add('attention', 'Avoid an all-capital headline.');
    else add('ready', 'Headline capitalization is readable.');

    const imageUsed = Boolean(data.featured_image.trim());
    if (imageUsed && data.featured_image_alt.trim().length < 5) add('blocker', 'Describe the featured image before export.');
    else add('ready', 'Featured-image description requirement is satisfied.');

    if (markdownImages.some((image) => !image.alt)) add('blocker', 'Every meaningful Markdown image needs alternative text inside the square brackets.');
    else if (markdownImages.length) add('ready', 'Inline Markdown images include alternative text.');

    let previous = 1;
    let skippedHeading = false;
    for (const heading of headings) {
      if (heading.level === 1 || heading.level > previous + 1) skippedHeading = true;
      previous = heading.level;
    }
    if (skippedHeading) add('blocker', 'Use ## for article sections and do not skip heading levels. The page headline already supplies the H1.');
    else if (headings.some((heading) => heading.text.length > 100)) add('attention', 'Shorten section headings longer than 100 characters.');
    else add('ready', 'Section headings follow a clear hierarchy.');

    const tableLines = body.split('\n').filter((line) => line.includes('|'));
    if (tableLines.length && !body.split('\n').some((line) => /^\s*\|?\s*:?-{3,}/.test(line))) add('attention', 'A Markdown table may be missing its header-separator row.');

    const abbreviations = [...new Set(body.match(/\b[A-Z]{3,}\b/g) || [])].filter((item) => !['PDF', 'HTML', 'URL', 'CMS'].includes(item));
    if (abbreviations.length >= 3) add('attention', `Define uncommon abbreviations on first use: ${abbreviations.slice(0, 4).join(', ')}.`);

    return findings;
  };

  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(values())); } catch {}
  };

  const formValuesFromArticle = (data = {}) => ({
    title: String(data.title || ''),
    excerpt: String(data.excerpt || ''),
    body: String(data.body || ''),
    author: String(data.author || ''),
    category: String(Array.isArray(data.categories) ? data.categories[0] || '' : data.category || ''),
    classification: String(data.classification || 'news'),
    kicker: String(data.kicker || ''),
    published_at: data.published_at ? new Date(data.published_at).toISOString().slice(0, 16) : '',
    tags: Array.isArray(data.tags) ? data.tags.join(', ') : String(data.tags || ''),
    featured_image: String(data.featured_image || ''),
    featured_image_alt: String(data.featured_image_alt || ''),
    featured_image_caption: String(data.featured_image_caption || ''),
    featured_image_credit: String(data.featured_image_credit || '')
  });

  const load = (data) => {
    const source = (data?.article_type || Array.isArray(data?.categories)) ? formValuesFromArticle(data) : data || {};
    for (const [name, value] of Object.entries(source)) if (fields[name] && typeof value === 'string') fields[name].value = value;
  };

  const draftRecords = () => {
    try {
      const records = JSON.parse(localStorage.getItem(draftLibraryKey) || '[]');
      return Array.isArray(records) ? records : [];
    } catch { return []; }
  };

  const writeDraftRecords = (records) => {
    try { localStorage.setItem(draftLibraryKey, JSON.stringify(records.slice(0, 20))); } catch {}
  };

  const refreshDraftLibrary = (selectedId = '') => {
    if (!draftLibrary) return;
    const records = draftRecords();
    draftLibrary.replaceChildren();
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = records.length ? 'Choose a saved draft' : 'No saved drafts';
    draftLibrary.append(empty);
    records.forEach((record) => {
      const option = document.createElement('option');
      option.value = record.id;
      option.textContent = `${record.title || 'Untitled story'} · ${new Date(record.saved_at).toLocaleString()}`;
      draftLibrary.append(option);
    });
    if (selectedId && records.some((record) => record.id === selectedId)) draftLibrary.value = selectedId;
  };

  const update = () => {
    const data = values();
    summaryCount.textContent = String(data.excerpt.length);
    readingTime.textContent = `${minutes(data.body)} ${minutes(data.body) === 1 ? 'minute' : 'minutes'}`;
    preview.kicker.textContent = data.kicker.trim() || 'Quick Story';
    preview.headline.textContent = data.title.trim() || 'Untitled story';
    preview.summary.textContent = data.excerpt.trim() || 'Add a clear summary to preview the deck.';
    preview.byline.textContent = data.author ? `By ${fields.author.options[fields.author.selectedIndex]?.text || data.author}` : '';
    preview.body.innerHTML = renderMarkdown(data.body);
    if (data.featured_image.trim()) {
      preview.figure.hidden = false;
      preview.image.src = data.featured_image.trim();
      preview.image.alt = data.featured_image_alt.trim();
      preview.caption.textContent = [data.featured_image_caption.trim(), data.featured_image_credit.trim()].filter(Boolean).join(' · ');
      preview.caption.hidden = !preview.caption.textContent;
    } else {
      preview.figure.hidden = true;
      preview.image.removeAttribute('src');
    }
    checks.innerHTML = audit().map((item) => `<li class="check-${item.level}"><span class="check-symbol" aria-hidden="true">${item.level === 'ready' ? '✓' : item.level === 'blocker' ? '×' : '!'}</span><span><strong class="check-level">${item.level === 'ready' ? 'Ready' : item.level === 'blocker' ? 'Publication blocker' : 'Needs attention'}</strong>${escapeHtml(item.text)}</span></li>`).join('');
    save();
  };

  const exportJson = () => `${JSON.stringify(articleRecord(), null, 2)}\n`;
  const announce = (message) => { status.textContent = message; };

  root.querySelector('[data-studio-download]')?.addEventListener('click', () => {
    const blocking = audit().filter((item) => item.level === 'blocker');
    if (blocking.length) { announce(`Resolve ${blocking.length} item${blocking.length === 1 ? '' : 's'} in the review list before export.`); checks.querySelector('.check-blocker')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${slugify(fields.title.value)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    announce('Article JSON downloaded. It remains a draft until an editor reviews and publishes it.');
  });

  root.querySelector('[data-studio-copy]')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(exportJson()); announce('Article JSON copied to the clipboard.'); }
    catch { announce('Clipboard access was unavailable. Use Download article JSON instead.'); }
  });

  root.querySelector('[data-studio-save-draft]')?.addEventListener('click', () => {
    const record = { id: `${Date.now()}-${slugify(fields.title.value)}`, title: fields.title.value.trim() || 'Untitled story', saved_at: new Date().toISOString(), data: values() };
    const records = [record, ...draftRecords()].slice(0, 20);
    writeDraftRecords(records);
    refreshDraftLibrary(record.id);
    announce('A local draft copy was saved in this browser.');
  });

  root.querySelector('[data-studio-open-draft]')?.addEventListener('click', () => {
    const record = draftRecords().find((item) => item.id === draftLibrary?.value);
    if (!record) { announce('Choose a saved draft first.'); return; }
    load(record.data);
    update();
    fields.title.focus();
    announce(`Opened local draft: ${record.title}.`);
  });

  root.querySelector('[data-studio-delete-draft]')?.addEventListener('click', () => {
    const id = draftLibrary?.value;
    if (!id) { announce('Choose a saved draft first.'); return; }
    const record = draftRecords().find((item) => item.id === id);
    writeDraftRecords(draftRecords().filter((item) => item.id !== id));
    refreshDraftLibrary();
    announce(`Deleted local draft: ${record?.title || 'Untitled story'}.`);
  });

  importFile?.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { announce('That article file is larger than 2 MiB and was not opened.'); importFile.value = ''; return; }
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The file must contain one article object.');
      load(data);
      update();
      fields.title.focus();
      announce(`Opened ${file.name}. Review the story before exporting a new package.`);
    } catch (error) {
      announce(`Could not open ${file.name}: ${error.message}`);
    } finally { importFile.value = ''; }
  });

  root.querySelector('[data-studio-sample]')?.addEventListener('click', () => {
    load({
      title: 'A faster path from reporting to a readable public record',
      excerpt: 'The Editorial Studio helps a nontechnical contributor prepare a clear, accessible article file without opening code or creating another account.',
      body: 'The quickest publishing workflow is the one an editor can understand at a glance.\n\n## Start with the reader\n\nLead with the essential facts, use short sections, and link to sources with descriptive text.\n\n- State what happened.\n- Explain why it matters.\n- Preserve the supporting record.',
      kicker: 'Editorial workflow',
      classification: 'explainer',
      tags: 'publishing, accessibility, workflow'
    });
    update();
    fields.title.focus();
    announce('Sample story loaded.');
  });

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('reset', () => {
    setTimeout(() => {
      try { localStorage.removeItem(storageKey); } catch {}
      update();
      announce('Editorial Studio reset.');
    }, 0);
  });

  try { load(JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch {}
  refreshDraftLibrary();
  if (!fields.published_at.value) {
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    fields.published_at.value = now.toISOString().slice(0, 16);
  }
  update();
})();
