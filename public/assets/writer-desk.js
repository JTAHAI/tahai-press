(() => {
  const root = document.querySelector('[data-editorial-studio]');
  if (!root) return;

  const form = root.querySelector('[data-studio-form]');
  const bodyField = root.querySelector('[data-writer-body]');
  const storageKey = 'tahai-press-writer-desk-v4';
  const draftLibraryKey = 'tahai-press-writer-desk-drafts-v2';
  const revisionLibraryKey = 'tahai-press-writer-desk-revisions-v1';
  const fields = Object.fromEntries([...form.elements]
    .filter((field) => field.name)
    .map((field) => [field.name, field]));
  const status = root.querySelector('[data-studio-status]');
  const checks = root.querySelector('[data-studio-checks]');
  const summaryCount = root.querySelector('[data-summary-count]');
  const readingTime = root.querySelector('[data-reading-time]');
  const structureCount = root.querySelector('[data-structure-count]');
  const draftLibrary = root.querySelector('[data-studio-draft-library]');
  const revisionLibrary = root.querySelector('[data-writer-revision-library]');
  const importFile = root.querySelector('[data-studio-import]');
  const palette = root.querySelector('[data-writer-palette]');
  const paletteSearch = root.querySelector('[data-writer-command-search]');
  const paletteResults = root.querySelector('[data-writer-command-results]');
  const slashMenu = root.querySelector('[data-writer-slash-menu]');
  const slashResults = root.querySelector('[data-writer-slash-results]');
  const focusButton = root.querySelector('[data-writer-focus-mode]');
  const preview = {
    kicker: root.querySelector('[data-preview-kicker]'),
    headline: root.querySelector('[data-preview-headline]'),
    summary: root.querySelector('[data-preview-summary]'),
    byline: root.querySelector('[data-preview-byline]'),
    body: root.querySelector('[data-preview-body]'),
    blocks: root.querySelector('[data-preview-blocks]'),
    figure: root.querySelector('[data-preview-figure]'),
    image: root.querySelector('[data-preview-image]'),
    caption: root.querySelector('[data-preview-caption]')
  };

  let revisionTimer = 0;
  let lastRevisionFingerprint = '';
  let slashMatches = [];
  let slashActiveIndex = 0;
  let slashTrigger = null;

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const safeHref = (value = '') => {
    const text = String(value).trim();
    return /^(https?:\/\/|\/)/i.test(text) ? text : '';
  };

  const inlineMarkdown = (text = '') => escapeHtml(text)
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+|\/[^)]+)\)/g, '<span class="writer-preview-inline-image">Image: $1</span>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  const renderMarkdown = (markdown = '') => {
    const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
    const output = [];
    let paragraph = [];
    let listType = '';
    const flushParagraph = () => {
      if (paragraph.length) output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    };
    const closeList = () => {
      if (listType) output.push(`</${listType}>`);
      listType = '';
    };
    const flush = () => { flushParagraph(); closeList(); };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flush(); continue; }
      if (/^#{2,6}\s+/.test(line)) {
        flush();
        const match = line.match(/^(#{2,6})\s+(.+)$/);
        const level = Math.min(6, match[1].length + 1);
        output.push(`<h${level}>${inlineMarkdown(match[2])}</h${level}>`);
        continue;
      }
      if (line.startsWith('> ')) { flush(); output.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`); continue; }
      const unordered = line.match(/^[-*]\s+(.+)$/);
      const ordered = line.match(/^\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph();
        const wanted = ordered ? 'ol' : 'ul';
        if (listType !== wanted) { closeList(); output.push(`<${wanted}>`); listType = wanted; }
        output.push(`<li>${inlineMarkdown((ordered || unordered)[1])}</li>`);
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

  const parseFields = (text = '') => {
    const map = new Map();
    const list = [];
    String(text).split('\n').forEach((raw) => {
      const line = raw.trim();
      const item = line.match(/^[-*]\s+(.+)$/);
      if (item) { list.push(item[1].trim()); return; }
      const field = line.match(/^([A-Za-z][A-Za-z -]{1,32}):\s*(.*)$/);
      if (field) map.set(field[1].trim().toLowerCase().replace(/\s+/g, '_'), field[2].trim());
    });
    return { map, list };
  };

  const parseDirectives = (markdown = '') => {
    const blocks = [];
    const sources = [];
    const warnings = [];
    const normalized = String(markdown).replace(/\r\n/g, '\n');
    const pattern = /(?:^|\n):::(key-points|pull-quote|fact-box|timeline|callout|document|image|sources)\s*\n([\s\S]*?)\n:::(?=\n|$)/g;
    const cleanBody = normalized.replace(pattern, (whole, type, content) => {
      const { map, list } = parseFields(content);
      const heading = map.get('heading') || '';
      if (type === 'key-points') {
        const items = list.filter(Boolean).slice(0, 12);
        if (!items.length) warnings.push('A key-points block needs at least one bullet item.');
        else blocks.push({ type: 'key_points', heading: heading || 'Key takeaways', items });
      }
      if (type === 'pull-quote') {
        const quote = map.get('quote') || list[0] || '';
        if (!quote) warnings.push('A pull-quote block needs a Quote field.');
        else blocks.push({ type: 'pull_quote', quote, attribution: map.get('attribution') || '' });
      }
      if (type === 'fact-box') {
        const body = map.get('body') || list.join('\n');
        if (!body) warnings.push('A fact-box block needs a Body field.');
        else blocks.push({ type: 'fact_box', heading: heading || 'Context', body });
      }
      if (type === 'timeline') {
        const items = list.map((item) => {
          const [date = '', title = '', ...rest] = item.split('|').map((part) => part.trim());
          return { date, title, body: rest.join(' | ') };
        }).filter((item) => item.date || item.title || item.body).slice(0, 20);
        if (!items.length) warnings.push('A timeline block needs bullet rows in “Date | Title | Description” format.');
        else blocks.push({ type: 'timeline', heading: heading || 'Timeline', items });
      }
      if (type === 'callout') {
        const body = map.get('body') || list.join('\n');
        const tone = ['neutral', 'note', 'important', 'context'].includes(map.get('tone')) ? map.get('tone') : 'neutral';
        if (!body) warnings.push('A callout block needs a Body field.');
        else blocks.push({ type: 'callout', tone, heading: heading || 'Note', body });
      }
      if (type === 'document') {
        const url = safeHref(map.get('url') || '');
        if (!url) warnings.push('A document block needs a local or HTTPS URL.');
        else blocks.push({ type: 'document', heading: heading || 'Supporting record', url, label: map.get('label') || 'Open document', description: map.get('description') || '' });
      }
      if (type === 'image') {
        const src = safeHref(map.get('source') || map.get('src') || '');
        const alt = map.get('alt') || '';
        if (!src) warnings.push('An image block needs a local or HTTPS Source field.');
        else if (!alt) warnings.push('An image block needs an Alt field before export.');
        else blocks.push({ type: 'image', src, alt, caption: map.get('caption') || '', credit: map.get('credit') || '', rights: map.get('rights') || '', aspect: map.get('aspect') || 'original', focal_point: map.get('focal_point') || 'center', layout: map.get('layout') || 'standard', lightbox: true });
      }
      if (type === 'sources') {
        const items = list.map((item) => {
          const [label = '', url = '', ...rest] = item.split('|').map((part) => part.trim());
          return { label, url: safeHref(url), note: rest.join(' | ') };
        }).filter((item) => item.label && item.url).slice(0, 30);
        if (!items.length) warnings.push('A sources block needs bullet rows in “Label | URL | Optional note” format.');
        else sources.push(...items);
      }
      return '\n';
    }).replace(/\n{3,}/g, '\n\n').trim();
    const fenceCount = (normalized.match(/^:::/gm) || []).length;
    if (fenceCount % 2 !== 0) warnings.push('A structured block has an opening ::: without a matching closing :::.');
    return { cleanBody, blocks, sources, warnings };
  };

  const articleRecord = () => {
    const data = values();
    const structured = parseDirectives(data.body);
    const hasImage = Boolean(data.featured_image.trim());
    return {
      title: data.title.trim(),
      slug: slugify(data.title),
      status: 'draft',
      article_type: 'standard',
      classification: data.classification || 'news',
      kicker: data.kicker.trim(),
      excerpt: data.excerpt.trim(),
      body: structured.cleanBody,
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
      story_blocks: structured.blocks,
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
      source_links: structured.sources,
      seo_title: '',
      seo_description: '',
      canonical_url: '',
      legacy_urls: [],
      noindex: true,
      review_content: false,
      review_rights: false,
      review_accessibility: false,
      editor_notes: 'Created with the browser-only TAHAI Press Writer Desk. Review before publishing.'
    };
  };

  const audit = () => {
    const data = values();
    const structured = parseDirectives(data.body);
    const findings = [];
    const add = (level, text) => findings.push({ level, text });
    const title = data.title.trim();
    const summary = data.excerpt.trim();
    const body = structured.cleanBody;
    const paragraphs = body.split(/\n\s*\n/).map((item) => item.replace(/^#+\s*/, '').trim()).filter(Boolean);
    const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({ level: match[1].length, text: match[2].trim() }));
    const links = [...body.matchAll(/(?<!!)\[([^\]]*)\]\(([^)]+)\)/g)].map((match) => ({ label: match[1].trim(), url: match[2].trim() }));
    const markdownImages = [...body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map((match) => ({ alt: match[1].trim(), url: match[2].trim() }));

    if (title.length < 5) add('blocker', 'Add a specific headline of at least five characters.');
    else if (title.length > 110) add('attention', 'Shorten the headline for easier scanning and sharing.');
    else add('ready', 'Headline length is reader-friendly.');

    if (summary.length < 20) add('blocker', 'Add a plain-language summary of at least 20 characters.');
    else if (summary.length > 220) add('attention', 'Consider a shorter summary for cards and search results.');
    else add('ready', 'Summary is concise and useful.');

    if (wordCount(body) < 30) add('blocker', 'Add enough article text outside structured blocks for a meaningful draft.');
    else add('ready', 'Article text is substantial enough for review.');

    structured.warnings.forEach((warning) => add('blocker', warning));
    if (!structured.warnings.length && structured.blocks.length) add('ready', `${structured.blocks.length} structured story block${structured.blocks.length === 1 ? '' : 's'} parsed cleanly.`);
    if (structured.sources.length) add('ready', `${structured.sources.length} source link${structured.sources.length === 1 ? '' : 's'} will be exported in the source desk.`);

    if (/\b(click here|read more here|learn more here)\b/i.test(body)) add('attention', 'Replace vague link text such as “click here” with the destination or purpose.');
    else add('ready', 'Links avoid vague “click here” wording.');

    if (links.some((link) => !link.label || !safeHref(link.url))) add('blocker', 'Every Markdown link needs descriptive text and a local or HTTPS destination.');
    else add('ready', 'Markdown links have text and supported destinations.');

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

  const readRecords = (key) => {
    try {
      const records = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(records) ? records : [];
    } catch { return []; }
  };
  const writeRecords = (key, records, max) => {
    try { localStorage.setItem(key, JSON.stringify(records.slice(0, max))); } catch {}
  };
  const draftRecords = () => readRecords(draftLibraryKey);
  const revisionRecords = () => readRecords(revisionLibraryKey);

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

  const refreshRevisionLibrary = (selectedId = '') => {
    if (!revisionLibrary) return;
    const records = revisionRecords();
    revisionLibrary.replaceChildren();
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = records.length ? 'Choose a revision' : 'No revisions yet';
    revisionLibrary.append(empty);
    records.forEach((record) => {
      const option = document.createElement('option');
      option.value = record.id;
      option.textContent = `${record.title || 'Untitled story'} · ${new Date(record.saved_at).toLocaleString()}`;
      revisionLibrary.append(option);
    });
    if (selectedId && records.some((record) => record.id === selectedId)) revisionLibrary.value = selectedId;
  };

  const saveRevision = ({ force = false } = {}) => {
    const data = values();
    if (!force && wordCount(data.body) < 10) return;
    const fingerprint = JSON.stringify(data);
    if (fingerprint === lastRevisionFingerprint) return;
    const record = { id: `${Date.now()}-${slugify(data.title)}`, title: data.title.trim() || 'Untitled story', saved_at: new Date().toISOString(), data };
    writeRecords(revisionLibraryKey, [record, ...revisionRecords()], 30);
    lastRevisionFingerprint = fingerprint;
    refreshRevisionLibrary(record.id);
  };

  const scheduleRevision = () => {
    clearTimeout(revisionTimer);
    revisionTimer = window.setTimeout(() => saveRevision(), 8000);
  };

  const renderPreviewBlocks = (blocks = [], sources = []) => {
    const output = blocks.map((block) => {
      if (block.type === 'key_points') return `<section class="writer-preview-block"><p class="eyebrow">At a glance</p><h3>${escapeHtml(block.heading)}</h3><ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`;
      if (block.type === 'pull_quote') return `<figure class="writer-preview-block writer-preview-quote"><blockquote>${escapeHtml(block.quote)}</blockquote>${block.attribution ? `<figcaption>${escapeHtml(block.attribution)}</figcaption>` : ''}</figure>`;
      if (block.type === 'fact_box' || block.type === 'callout') return `<aside class="writer-preview-block"><p class="eyebrow">${block.type === 'callout' ? escapeHtml(block.tone) : 'Context'}</p><h3>${escapeHtml(block.heading)}</h3><div>${renderMarkdown(block.body)}</div></aside>`;
      if (block.type === 'timeline') return `<section class="writer-preview-block"><p class="eyebrow">Chronology</p><h3>${escapeHtml(block.heading)}</h3><ol>${block.items.map((item) => `<li><strong>${escapeHtml(item.date)}</strong> ${escapeHtml(item.title)}${item.body ? `<br><span>${escapeHtml(item.body)}</span>` : ''}</li>`).join('')}</ol></section>`;
      if (block.type === 'document') return `<aside class="writer-preview-block"><p class="eyebrow">Supporting record</p><h3>${escapeHtml(block.heading)}</h3><p>${escapeHtml(block.description)}</p><p><a href="${escapeHtml(block.url)}">${escapeHtml(block.label)}</a></p></aside>`;
      if (block.type === 'image') return `<figure class="writer-preview-block"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}"><figcaption>${[block.caption, block.credit].filter(Boolean).map(escapeHtml).join(' · ')}</figcaption></figure>`;
      return '';
    });
    if (sources.length) output.push(`<section class="writer-preview-block"><p class="eyebrow">Sources</p><h3>Supporting links</h3><ul>${sources.map((source) => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.label)}</a>${source.note ? ` — ${escapeHtml(source.note)}` : ''}</li>`).join('')}</ul></section>`);
    return output.join('');
  };

  const update = () => {
    const data = values();
    const structured = parseDirectives(data.body);
    summaryCount.textContent = String(data.excerpt.length);
    readingTime.textContent = `${minutes(structured.cleanBody)} ${minutes(structured.cleanBody) === 1 ? 'minute' : 'minutes'}`;
    structureCount.textContent = `${structured.blocks.length} structured block${structured.blocks.length === 1 ? '' : 's'}`;
    preview.kicker.textContent = data.kicker.trim() || 'Quick Story';
    preview.headline.textContent = data.title.trim() || 'Untitled story';
    preview.summary.textContent = data.excerpt.trim() || 'Add a clear summary to preview the deck.';
    preview.byline.textContent = data.author ? `By ${fields.author.options[fields.author.selectedIndex]?.text || data.author}` : '';
    preview.body.innerHTML = renderMarkdown(structured.cleanBody);
    preview.blocks.innerHTML = renderPreviewBlocks(structured.blocks, structured.sources);
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
    scheduleRevision();
  };

  const exportJson = () => `${JSON.stringify(articleRecord(), null, 2)}\n`;
  const announce = (message) => { status.textContent = message; };

  const replaceSelection = (text, { select = null, replaceRange = null } = {}) => {
    const start = replaceRange?.start ?? bodyField.selectionStart;
    const end = replaceRange?.end ?? bodyField.selectionEnd;
    bodyField.setRangeText(text, start, end, 'end');
    if (select) bodyField.setSelectionRange(start + select[0], start + select[1]);
    bodyField.focus();
    hideSlashMenu();
    update();
  };

  const surroundSelection = (before, after, placeholder) => {
    const start = bodyField.selectionStart;
    const end = bodyField.selectionEnd;
    const selected = bodyField.value.slice(start, end) || placeholder;
    replaceSelection(`${before}${selected}${after}`, { select: [before.length, before.length + selected.length] });
  };

  const commandDefinitions = [
    { id: 'h2', label: 'Section heading', description: 'Insert a level-two article section heading.', slash: 'heading', run: () => replaceSelection('## Section heading\n\n', { select: [3, 18] }) },
    { id: 'bold', label: 'Bold emphasis', description: 'Wrap selected text in clean Markdown bold.', slash: 'bold', run: () => surroundSelection('**', '**', 'important text') },
    { id: 'italic', label: 'Italic emphasis', description: 'Wrap selected text in clean Markdown italics.', slash: 'italic', run: () => surroundSelection('*', '*', 'emphasized text') },
    { id: 'link', label: 'Descriptive link', description: 'Insert a Markdown link with useful link text.', slash: 'link', run: () => replaceSelection('[Descriptive link text](https://example.org)', { select: [1, 22] }) },
    { id: 'quote', label: 'Block quote', description: 'Insert an ordinary Markdown quotation.', slash: 'quote', run: () => replaceSelection('> Quoted text\n\n', { select: [2, 13] }) },
    { id: 'bullets', label: 'Bulleted list', description: 'Insert a short scannable list.', slash: 'list', run: () => replaceSelection('- First item\n- Second item\n- Third item\n\n', { select: [2, 12] }) },
    { id: 'source', label: 'Source link', description: 'Insert a descriptive source citation in the article body.', slash: 'source', run: () => replaceSelection('[Source name](https://example.org/source)', { select: [1, 12] }) },
    { id: 'sources', label: 'Source desk', description: 'Export structured supporting links beside the article.', slash: 'sources', run: () => replaceSelection(':::sources\n- Source name | https://example.org/source | Why this source matters\n:::\n\n', { select: [12, 23] }) },
    { id: 'key-points', label: 'Key takeaways', description: 'Insert an accessible key-points story block.', slash: 'key-points', run: () => replaceSelection(':::key-points\nHeading: Key takeaways\n- First finding\n- Second finding\n- Third finding\n:::\n\n', { select: [23, 36] }) },
    { id: 'pull-quote', label: 'Pull quote', description: 'Insert a quotation with attribution as a structured block.', slash: 'pull-quote', run: () => replaceSelection(':::pull-quote\nQuote: Memorable quotation\nAttribution: Name or source\n:::\n\n', { select: [21, 41] }) },
    { id: 'fact-box', label: 'Fact box', description: 'Insert compact context or background.', slash: 'fact-box', run: () => replaceSelection(':::fact-box\nHeading: Context\nBody: Add the essential background here.\n:::\n\n', { select: [20, 27] }) },
    { id: 'timeline', label: 'Timeline', description: 'Insert chronological entries in a structured block.', slash: 'timeline', run: () => replaceSelection(':::timeline\nHeading: Timeline\n- Date | Event title | What happened\n- Date | Event title | What happened next\n:::\n\n', { select: [32, 36] }) },
    { id: 'callout', label: 'Important callout', description: 'Insert a note, context, or important warning.', slash: 'callout', run: () => replaceSelection(':::callout\nTone: important\nHeading: Important\nBody: Add the reader guidance here.\n:::\n\n', { select: [39, 48] }) },
    { id: 'document', label: 'Supporting document', description: 'Insert a first-class public record or source document.', slash: 'document', run: () => replaceSelection(':::document\nHeading: Supporting record\nURL: /uploads/documents/example.pdf\nLabel: Open document\nDescription: Explain what the document is and why it matters.\n:::\n\n', { select: [48, 78] }) },
    { id: 'image', label: 'Inline image', description: 'Insert an image with accessibility and rights metadata.', slash: 'image', run: () => replaceSelection(':::image\nSource: /uploads/images/example.jpg\nAlt: Describe the meaningful content of the image.\nCaption: Reader-facing caption\nCredit: Photographer or source\nRights: Usage note\nLayout: standard\nAspect: original\n:::\n\n', { select: [17, 44] }) }
  ];
  const commandsById = new Map(commandDefinitions.map((command) => [command.id, command]));

  const runCommand = (id, { replaceRange = null } = {}) => {
    const command = commandsById.get(id);
    if (!command) return;
    if (replaceRange) {
      bodyField.setSelectionRange(replaceRange.start, replaceRange.end);
      bodyField.setRangeText('', replaceRange.start, replaceRange.end, 'start');
    }
    command.run();
    closePalette();
    announce(`${command.label} inserted.`);
  };

  const renderCommandButtons = (target, commands) => {
    target.replaceChildren();
    commands.forEach((command, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.commandId = command.id;
      button.setAttribute('role', 'option');
      button.innerHTML = `<strong>${escapeHtml(command.label)}</strong><span>/${escapeHtml(command.slash)} · ${escapeHtml(command.description)}</span>`;
      if (target === slashResults && index === slashActiveIndex) button.setAttribute('aria-selected', 'true');
      button.addEventListener('click', () => runCommand(command.id, { replaceRange: target === slashResults ? slashTrigger : null }));
      target.append(button);
    });
  };

  const openPalette = () => {
    renderCommandButtons(paletteResults, commandDefinitions);
    paletteSearch.value = '';
    if (typeof palette.showModal === 'function') palette.showModal();
    else palette.setAttribute('open', '');
    window.setTimeout(() => paletteSearch.focus(), 0);
  };
  const closePalette = () => {
    if (palette.open && typeof palette.close === 'function') palette.close();
    else palette.removeAttribute('open');
  };

  const hideSlashMenu = () => {
    slashMenu.hidden = true;
    slashResults.replaceChildren();
    slashMatches = [];
    slashTrigger = null;
    slashActiveIndex = 0;
  };

  const updateSlashMenu = () => {
    const cursor = bodyField.selectionStart;
    const before = bodyField.value.slice(0, cursor);
    const lineStart = before.lastIndexOf('\n') + 1;
    const line = before.slice(lineStart);
    const match = line.match(/^\/([a-z-]*)$/i);
    if (!match) { hideSlashMenu(); return; }
    const query = match[1].toLowerCase();
    slashMatches = commandDefinitions.filter((command) => command.slash.includes(query) || command.label.toLowerCase().includes(query)).slice(0, 8);
    if (!slashMatches.length) { hideSlashMenu(); return; }
    slashTrigger = { start: lineStart, end: cursor };
    slashActiveIndex = Math.min(slashActiveIndex, slashMatches.length - 1);
    slashMenu.hidden = false;
    renderCommandButtons(slashResults, slashMatches);
  };

  const htmlToMarkdown = (html = '') => {
    const documentNode = new DOMParser().parseFromString(html, 'text/html');
    const walk = (node, depth = 0) => {
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.replace(/\s+/g, ' ');
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const tag = node.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'template', 'svg'].includes(tag)) return '';
      const children = [...node.childNodes].map((child) => walk(child, depth + 1)).join('');
      if (tag === 'br') return '\n';
      if (/^h[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Math.max(2, Number(tag[1])))} ${children.trim()}\n\n`;
      if (['p', 'div', 'section', 'article'].includes(tag)) return `\n\n${children.trim()}\n\n`;
      if (tag === 'strong' || tag === 'b') return `**${children.trim()}**`;
      if (tag === 'em' || tag === 'i') return `*${children.trim()}*`;
      if (tag === 'code') return `\`${children.trim()}\``;
      if (tag === 'blockquote') return children.trim().split('\n').map((line) => `> ${line}`).join('\n') + '\n\n';
      if (tag === 'a') {
        const href = safeHref(node.getAttribute('href') || '');
        return href && children.trim() ? `[${children.trim()}](${href})` : children;
      }
      if (tag === 'img') {
        const src = safeHref(node.getAttribute('src') || '');
        const alt = node.getAttribute('alt') || '';
        return src ? `![${alt}](${src})` : '';
      }
      if (tag === 'li') {
        const ordered = node.parentElement?.tagName.toLowerCase() === 'ol';
        const index = ordered ? [...node.parentElement.children].indexOf(node) + 1 : 0;
        return `${ordered ? `${index}.` : '-'} ${children.trim()}\n`;
      }
      if (tag === 'ul' || tag === 'ol') return `\n${children}\n`;
      if (tag === 'hr') return '\n\n---\n\n';
      return children;
    };
    return walk(documentNode.body).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  root.querySelector('[data-studio-download]')?.addEventListener('click', () => {
    const blocking = audit().filter((item) => item.level === 'blocker');
    if (blocking.length) { announce(`Resolve ${blocking.length} item${blocking.length === 1 ? '' : 's'} in the review list before export.`); checks.querySelector('.check-blocker')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    saveRevision({ force: true });
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${slugify(fields.title.value)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    announce('Contributor package downloaded. It remains a draft until an editor reviews and promotes it.');
  });

  root.querySelector('[data-studio-copy]')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(exportJson()); announce('Article JSON copied to the clipboard.'); }
    catch { announce('Clipboard access was unavailable. Use Download contributor package instead.'); }
  });

  root.querySelector('[data-studio-save-draft]')?.addEventListener('click', () => {
    const record = { id: `${Date.now()}-${slugify(fields.title.value)}`, title: fields.title.value.trim() || 'Untitled story', saved_at: new Date().toISOString(), data: values() };
    writeRecords(draftLibraryKey, [record, ...draftRecords()], 20);
    refreshDraftLibrary(record.id);
    saveRevision({ force: true });
    announce('A named local draft was saved in this browser.');
  });

  root.querySelector('[data-studio-open-draft]')?.addEventListener('click', () => {
    const record = draftRecords().find((item) => item.id === draftLibrary?.value);
    if (!record) { announce('Choose a saved draft first.'); return; }
    saveRevision({ force: true });
    load(record.data);
    update();
    fields.title.focus();
    announce(`Opened local draft: ${record.title}.`);
  });

  root.querySelector('[data-studio-delete-draft]')?.addEventListener('click', () => {
    const id = draftLibrary?.value;
    if (!id) { announce('Choose a saved draft first.'); return; }
    const record = draftRecords().find((item) => item.id === id);
    writeRecords(draftLibraryKey, draftRecords().filter((item) => item.id !== id), 20);
    refreshDraftLibrary();
    announce(`Deleted local draft: ${record?.title || 'Untitled story'}.`);
  });

  root.querySelector('[data-writer-restore-revision]')?.addEventListener('click', () => {
    const record = revisionRecords().find((item) => item.id === revisionLibrary?.value);
    if (!record) { announce('Choose a revision first.'); return; }
    saveRevision({ force: true });
    load(record.data);
    update();
    bodyField.focus();
    announce(`Restored revision from ${new Date(record.saved_at).toLocaleString()}.`);
  });

  root.querySelector('[data-writer-delete-revision]')?.addEventListener('click', () => {
    const id = revisionLibrary?.value;
    if (!id) { announce('Choose a revision first.'); return; }
    writeRecords(revisionLibraryKey, revisionRecords().filter((item) => item.id !== id), 30);
    refreshRevisionLibrary();
    announce('Revision deleted from this browser.');
  });

  importFile?.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { announce('That article file is larger than 2 MiB and was not opened.'); importFile.value = ''; return; }
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The file must contain one article object.');
      saveRevision({ force: true });
      load(data);
      update();
      fields.title.focus();
      announce(`Opened ${file.name}. Review the story before exporting a new package.`);
    } catch (error) {
      announce(`Could not open ${file.name}: ${error.message}`);
    } finally { importFile.value = ''; }
  });

  root.querySelector('[data-studio-sample]')?.addEventListener('click', () => {
    saveRevision({ force: true });
    load({
      title: 'A faster path from reporting to a readable public record',
      excerpt: 'Writer Desk helps a nontechnical contributor prepare a clear, accessible article package without opening code or creating another account.',
      body: 'The quickest publishing workflow is the one an editor can understand at a glance.\n\n## Start with the reader\n\nLead with the essential facts, use short sections, and link to sources with descriptive text.\n\n:::key-points\nHeading: What matters\n- State what happened.\n- Explain why it matters.\n- Preserve the supporting record.\n:::\n\n:::sources\n- Example public record | https://example.org/source | Replace with the original source before publishing\n:::',
      kicker: 'Editorial workflow',
      classification: 'explainer',
      tags: 'publishing, accessibility, workflow'
    });
    update();
    fields.title.focus();
    announce('Sample story loaded.');
  });

  root.querySelectorAll('[data-writer-command]').forEach((button) => button.addEventListener('click', () => runCommand(button.dataset.writerCommand)));
  root.querySelector('[data-writer-open-palette]')?.addEventListener('click', openPalette);
  root.querySelector('[data-writer-close-palette]')?.addEventListener('click', closePalette);
  palette?.addEventListener('click', (event) => { if (event.target === palette) closePalette(); });
  paletteSearch?.addEventListener('input', () => {
    const query = paletteSearch.value.trim().toLowerCase();
    const filtered = commandDefinitions.filter((command) => `${command.label} ${command.description} ${command.slash}`.toLowerCase().includes(query));
    renderCommandButtons(paletteResults, filtered);
  });

  focusButton?.addEventListener('click', () => {
    const active = !root.classList.contains('is-focus-mode');
    root.classList.toggle('is-focus-mode', active);
    document.body.classList.toggle('writer-focus-mode', active);
    focusButton.setAttribute('aria-pressed', String(active));
    focusButton.textContent = active ? 'Exit focus' : 'Focus';
    bodyField.focus();
    announce(active ? 'Focus mode enabled. Preview and surrounding navigation are hidden.' : 'Focus mode disabled.');
  });

  bodyField.addEventListener('paste', (event) => {
    const html = event.clipboardData?.getData('text/html') || '';
    if (!html) return;
    const markdown = htmlToMarkdown(html);
    if (!markdown) return;
    event.preventDefault();
    replaceSelection(markdown);
    announce('Pasted formatting was cleaned into portable Markdown. Review links, headings, and image descriptions.');
  });

  bodyField.addEventListener('input', updateSlashMenu);
  bodyField.addEventListener('click', updateSlashMenu);
  bodyField.addEventListener('keyup', (event) => { if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) updateSlashMenu(); });
  bodyField.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette(); return; }
    if (slashMenu.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); hideSlashMenu(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      slashActiveIndex = (slashActiveIndex + (event.key === 'ArrowDown' ? 1 : -1) + slashMatches.length) % slashMatches.length;
      renderCommandButtons(slashResults, slashMatches);
      return;
    }
    if (event.key === 'Enter' && slashMatches[slashActiveIndex]) {
      event.preventDefault();
      runCommand(slashMatches[slashActiveIndex].id, { replaceRange: slashTrigger });
    }
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !palette.open) { event.preventDefault(); openPalette(); }
    if (event.key === 'Escape' && document.body.classList.contains('writer-focus-mode')) focusButton?.click();
  });

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('reset', () => {
    saveRevision({ force: true });
    setTimeout(() => {
      try { localStorage.removeItem(storageKey); } catch {}
      update();
      announce('Writer Desk reset. Previous automatic revisions remain available.');
    }, 0);
  });

  try { load(JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch {}
  refreshDraftLibrary();
  refreshRevisionLibrary();
  lastRevisionFingerprint = JSON.stringify(values());
  if (!fields.published_at.value) {
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    fields.published_at.value = now.toISOString().slice(0, 16);
  }
  update();
})();
