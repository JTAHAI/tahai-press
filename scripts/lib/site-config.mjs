import { READER_REACH_DEFAULTS } from './reader-reach.mjs';

const PRESET_DEFINITIONS = {
  'classic-broadsheet': {
    label: 'Classic Broadsheet',
    description: 'Deep blue ink, warm paper, and traditional newspaper hierarchy.',
    theme: {
      brand: '#123a5a', brand_deep: '#061b2d', brand_soft: '#d9e8f2',
      accent: '#345f7f', accent_dark: '#153f5e', highlight: '#9fbfd4',
      surface: '#f3efe5', surface_deep: '#e6ded0', paper: '#fffdf7'
    }
  },
  'community-weekly': {
    label: 'Community Weekly',
    description: 'Approachable evergreen tones for local reporting and neighborhood news.',
    theme: {
      brand: '#24513f', brand_deep: '#102b22', brand_soft: '#dbe9e1',
      accent: '#7a4a22', accent_dark: '#4b2b12', highlight: '#c7a76b',
      surface: '#f5f1e7', surface_deep: '#e5ddce', paper: '#fffdf8'
    }
  },
  'civic-record': {
    label: 'Civic Record',
    description: 'Structured navy and restrained red for public records and accountability reporting.',
    theme: {
      brand: '#183b5b', brand_deep: '#071b2d', brand_soft: '#dce8f1',
      accent: '#8c2f39', accent_dark: '#5d1720', highlight: '#c6a35c',
      surface: '#f2f0ea', surface_deep: '#dedbd2', paper: '#ffffff'
    }
  },
  'modern-daily': {
    label: 'Modern Daily',
    description: 'Crisp charcoal, bright blue, and compact contemporary spacing.',
    theme: {
      brand: '#202a33', brand_deep: '#0b1116', brand_soft: '#e0e7ec',
      accent: '#1769aa', accent_dark: '#0b4676', highlight: '#76a9cf',
      surface: '#f2f4f5', surface_deep: '#dfe4e7', paper: '#ffffff'
    }
  },
  'investigative-journal': {
    label: 'Investigative Journal',
    description: 'Authoritative charcoal and burgundy for long-form and investigative work.',
    theme: {
      brand: '#302b2d', brand_deep: '#151214', brand_soft: '#e8e1e2',
      accent: '#7a2638', accent_dark: '#4d1422', highlight: '#b89b63',
      surface: '#f3efe8', surface_deep: '#ded5ca', paper: '#fffdfa'
    }
  },
  'arts-culture': {
    label: 'Arts & Culture',
    description: 'Editorial plum and muted gold with an expressive but readable finish.',
    theme: {
      brand: '#4c3159', brand_deep: '#24142b', brand_soft: '#eadff0',
      accent: '#8a5a1f', accent_dark: '#5a370d', highlight: '#c9a968',
      surface: '#f5f0e8', surface_deep: '#e4dacd', paper: '#fffdf9'
    }
  },
  'high-contrast': {
    label: 'High Contrast',
    description: 'Maximum separation and strong focus cues for broad visual accessibility.',
    theme: {
      brand: '#111111', brand_deep: '#000000', brand_soft: '#f0f0f0',
      accent: '#004f9e', accent_dark: '#00366d', highlight: '#ffcf33',
      surface: '#f5f5f5', surface_deep: '#d9d9d9', paper: '#ffffff'
    }
  },
  'warm-reading': {
    label: 'Warm Reading Edition',
    description: 'Low-glare brown ink and cream surfaces for comfortable long-form reading.',
    theme: {
      brand: '#4a392d', brand_deep: '#241a14', brand_soft: '#e9dfd4',
      accent: '#7b4b2a', accent_dark: '#4e2d17', highlight: '#b99a67',
      surface: '#f1eadf', surface_deep: '#ded2c2', paper: '#fff9ef'
    }
  }
};

export const THEME_PRESETS = Object.freeze(PRESET_DEFINITIONS);
export const THEME_PRESET_IDS = Object.freeze([...Object.keys(PRESET_DEFINITIONS), 'custom']);

export const DEFAULT_NAVIGATION = Object.freeze([
  { href: '/stories/', label: 'Stories' },
  { href: '/search/', label: 'Search' },
  { href: '/hubs/', label: 'Coverage Hubs' },
  { href: '/studio/', label: 'Editorial Studio' },
  { href: '/puzzles/', label: 'Crossword' },
  { href: '/about/', label: 'About' },
  { href: '/submit/', label: 'Submit' }
]);

export const DEFAULT_HOMEPAGE_MODULES = Object.freeze([
  { type: 'intro', enabled: true },
  { type: 'setup', enabled: true },
  { type: 'license', enabled: true },
  { type: 'featured', enabled: true },
  { type: 'latest', enabled: true, heading: 'Stories and documents', count: 6 },
  { type: 'reach', enabled: true },
  { type: 'studio', enabled: true },
  { type: 'product', enabled: true },
  { type: 'pillars', enabled: true },
  { type: 'hubs', enabled: true, count: 4 },
  { type: 'submit', enabled: true }
]);

export const LAYOUT_OPTIONS = Object.freeze({
  density: ['compact', 'balanced', 'spacious'],
  reading_width: ['narrow', 'standard', 'wide'],
  masthead_alignment: ['center', 'left'],
  headline_style: ['serif', 'sans'],
  panel_style: ['square', 'soft'],
  reader_surface: ['paper', 'light', 'sepia']
});

function cleanString(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

export function titleInitials(title = '') {
  const words = String(title).trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word.match(/[A-Za-z0-9]/)?.[0] || '').join('');
  return (initials || 'P').toUpperCase();
}

function normalizeNavigation(value) {
  const items = Array.isArray(value?.items) ? value.items : DEFAULT_NAVIGATION;
  const normalized = items
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      label: cleanString(item.label).slice(0, 80),
      href: cleanString(item.href).slice(0, 2048)
    }))
    .filter((item) => item.label && item.href);
  return {
    items: normalized.length ? normalized : DEFAULT_NAVIGATION.map((item) => ({ ...item })),
    note: cleanString(value?.note)
  };
}

function normalizeHomepage(value) {
  const modules = Array.isArray(value?.modules) ? value.modules : DEFAULT_HOMEPAGE_MODULES;
  const normalized = modules
    .filter((item) => item && typeof item === 'object' && typeof item.type === 'string')
    .map((item) => ({
      type: item.type,
      enabled: item.enabled !== false,
      heading: cleanString(item.heading),
      count: Number.isInteger(Number(item.count)) ? Number(item.count) : undefined,
      category: cleanString(item.category),
      hub: cleanString(item.hub)
    }));
  return { modules: normalized.length ? normalized : DEFAULT_HOMEPAGE_MODULES.map((item) => ({ ...item })) };
}

function normalizeLayout(value = {}) {
  const result = {};
  for (const [key, allowed] of Object.entries(LAYOUT_OPTIONS)) {
    result[key] = allowed.includes(value?.[key]) ? value[key] : allowed.includes('balanced') ? 'balanced' : allowed[0];
  }
  return result;
}

export function resolveTheme(site = {}) {
  const preset = THEME_PRESETS[site.theme_preset];
  if (preset) return { ...preset.theme };
  if (site.theme_preset === 'custom' && site.theme && typeof site.theme === 'object') return { ...site.theme };
  return { ...THEME_PRESETS['classic-broadsheet'].theme };
}

function normalizeReaderReach(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const integer = (candidate, fallback, max) => {
    const number = Number(candidate);
    return Number.isInteger(number) && number > 0 && number <= max ? number : fallback;
  };
  return {
    enabled: source.enabled !== false,
    offline_enabled: source.offline_enabled !== false,
    saved_articles_enabled: source.saved_articles_enabled !== false,
    browser_share_enabled: source.browser_share_enabled !== false,
    current_edition_enabled: source.current_edition_enabled !== false,
    current_edition_count: integer(source.current_edition_count, READER_REACH_DEFAULTS.current_edition_count, 50),
    offline_article_count: integer(source.offline_article_count, READER_REACH_DEFAULTS.offline_article_count, 50)
  };
}

export function normalizeSiteConfig(input = {}) {
  const title = cleanString(input.title, 'Your Publication');
  const shortTitle = cleanString(input.short_title, title).slice(0, 60);
  const tagline = cleanString(input.tagline, 'Independent reporting, clearly presented.');
  const description = cleanString(input.description, tagline);
  const preset = THEME_PRESET_IDS.includes(input.theme_preset) ? input.theme_preset : 'classic-broadsheet';
  const normalized = {
    ...input,
    title,
    short_title: shortTitle,
    brand_mark: cleanString(input.brand_mark, titleInitials(title)).slice(0, 2).toUpperCase(),
    tagline,
    description,
    masthead_kicker: cleanString(input.masthead_kicker, `${title} · Independent publication`),
    standards_label: cleanString(input.standards_label, 'Editorial standards'),
    hero_kicker: cleanString(input.hero_kicker, 'Latest edition'),
    hero_title: cleanString(input.hero_title, `Reporting and source documents from ${title}.`),
    hero_description: cleanString(input.hero_description, description),
    editorial_promise: cleanString(input.editorial_promise, 'Accurate reporting. Clear sourcing. Accessible publishing.'),
    navigation_note: cleanString(input.navigation_note, 'Make it easy. Make it fast.'),
    theme_preset: preset,
    navigation: normalizeNavigation(input.navigation),
    homepage: normalizeHomepage(input.homepage),
    layout: normalizeLayout(input.layout),
    reader_reach: normalizeReaderReach(input.reader_reach),
    setup_version: Number.isInteger(Number(input.setup_version)) ? Number(input.setup_version) : 2
  };
  normalized.theme = resolveTheme(normalized);
  return normalized;
}

export function themePresetList() {
  return Object.entries(THEME_PRESETS).map(([id, preset]) => ({ id, label: preset.label, description: preset.description, theme: { ...preset.theme } }));
}
