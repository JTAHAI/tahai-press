const WORKFLOW_STATES = Object.freeze(['draft', 'review', 'scheduled', 'published', 'corrected', 'archived']);

const WORKFLOW_TRANSITIONS = Object.freeze({
  draft: ['review', 'scheduled', 'published', 'archived'],
  review: ['draft', 'scheduled', 'published', 'archived'],
  scheduled: ['review', 'published', 'archived'],
  published: ['corrected', 'archived'],
  corrected: ['published', 'archived'],
  archived: ['draft']
});

const DEFAULT_FOOTER_COLUMNS = Object.freeze([
  {
    heading: 'Publishing',
    links: [
      { label: 'Publishing Console', href: '/publisher/' },
      { label: 'Contributor Composer', href: '/studio/' },
      { label: 'Media Desk', href: '/media-desk/' }
    ]
  },
  {
    heading: 'Explore',
    links: [
      { label: 'Stories', href: '/stories/' },
      { label: 'Search', href: '/search/' },
      { label: 'Coverage Hubs', href: '/hubs/' },
      { label: 'Authors', href: '/authors/' }
    ]
  },
  {
    heading: 'Policy',
    links: [
      { label: 'About', href: '/about/' },
      { label: 'Accessibility', href: '/accessibility/' },
      { label: 'Submit', href: '/submit/' },
      { label: 'Contact', href: '/contact/' }
    ]
  }
]);

const DEFAULT_PUBLICATION_SETTINGS = Object.freeze({
  workflow: 'editorial_review',
  scheduled_publishing: true,
  corrections_enabled: true,
  archive_withdrawn_publications: true,
  conflict_detection: true,
  preview_before_commit: true
});

function clean(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeLink(link = {}) {
  return {
    label: clean(link.label).slice(0, 120),
    href: clean(link.href).slice(0, 2048)
  };
}

export function normalizeFooter(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const columns = Array.isArray(source.columns) ? source.columns : DEFAULT_FOOTER_COLUMNS;
  const normalized = columns
    .filter((column) => column && typeof column === 'object' && !Array.isArray(column))
    .map((column) => {
      const links = Array.isArray(column.links) ? column.links : [];
      return {
        heading: clean(column.heading).slice(0, 80),
        links: links.map(normalizeLink).filter((item) => item.label && item.href).slice(0, 8)
      };
    })
    .filter((column) => column.heading && column.links.length);
  return {
    note: clean(source.note),
    columns: normalized.length ? normalized : clone(DEFAULT_FOOTER_COLUMNS)
  };
}

export function normalizePublicationSettings(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    schema_version: Number.isInteger(Number(source.schema_version)) ? Number(source.schema_version) : 1,
    workflow: clean(source.workflow, DEFAULT_PUBLICATION_SETTINGS.workflow),
    scheduled_publishing: source.scheduled_publishing !== false,
    corrections_enabled: source.corrections_enabled !== false,
    archive_withdrawn_publications: source.archive_withdrawn_publications !== false,
    conflict_detection: source.conflict_detection !== false,
    preview_before_commit: source.preview_before_commit !== false
  };
}

export function workflowTransitions(state = 'draft') {
  return [...(WORKFLOW_TRANSITIONS[state] || [])];
}

export function workflowCanTransition(from = 'draft', to = 'draft') {
  return workflowTransitions(from).includes(to);
}

export function stableStringify(value) {
  const seen = new WeakSet();
  const format = (input) => {
    if (input === null || typeof input !== 'object') return input;
    if (seen.has(input)) throw new TypeError('Cannot stringify circular structures.');
    seen.add(input);
    if (Array.isArray(input)) return input.map(format);
    return Object.keys(input).sort().reduce((accumulator, key) => {
      accumulator[key] = format(input[key]);
      return accumulator;
    }, {});
  };
  return JSON.stringify(format(value), null, 2);
}

export function normalizePublishingConsoleState(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    schema_version: Number.isInteger(Number(source.schema_version)) ? Number(source.schema_version) : 1,
    source_hash: clean(source.source_hash),
    site: source.site && typeof source.site === 'object' ? source.site : {},
    article: source.article && typeof source.article === 'object' ? source.article : {},
    authors: Array.isArray(source.authors) ? source.authors : [],
    categories: Array.isArray(source.categories) ? source.categories : [],
    hubs: Array.isArray(source.hubs) ? source.hubs : [],
    navigation: source.navigation && typeof source.navigation === 'object' ? source.navigation : {},
    homepage: source.homepage && typeof source.homepage === 'object' ? source.homepage : {},
    footer: normalizeFooter(source.footer),
    publication_settings: normalizePublicationSettings(source.publication_settings),
    workflow: WORKFLOW_STATES.includes(source.workflow) ? source.workflow : 'draft'
  };
}

export { DEFAULT_FOOTER_COLUMNS, DEFAULT_PUBLICATION_SETTINGS, WORKFLOW_STATES, WORKFLOW_TRANSITIONS };
