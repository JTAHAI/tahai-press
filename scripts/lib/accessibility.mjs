const FIXED_COLORS = Object.freeze({
  ink: '#17201f',
  inkSoft: '#394441',
  muted: '#5b6663',
  white: '#ffffff',
  lineDark: '#6e7a76'
});

function normalizeHex(value) {
  const input = String(value || '').trim();
  if (!/^#[0-9a-f]{6}$/i.test(input)) throw new Error(`Invalid six-digit hex color: ${input || '(empty)'}`);
  return input.toLowerCase();
}

export function hexToRgb(value) {
  const hex = normalizeHex(value).slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

function linearChannel(channel) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(value) {
  const { r, g, b } = hexToRgb(value);
  return (0.2126 * linearChannel(r)) + (0.7152 * linearChannel(g)) + (0.0722 * linearChannel(b));
}

export function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function themeContrastChecks(theme = {}) {
  const pairs = [
    { name: 'Primary button text', foreground: FIXED_COLORS.white, background: theme.accent, minimum: 4.5 },
    { name: 'Brand hover text', foreground: FIXED_COLORS.white, background: theme.brand, minimum: 4.5 },
    { name: 'Dark brand bar text', foreground: FIXED_COLORS.white, background: theme.brand_deep, minimum: 4.5 },
    { name: 'Accent links on paper', foreground: theme.accent_dark, background: theme.paper, minimum: 4.5 },
    { name: 'Accent links on surface', foreground: theme.accent_dark, background: theme.surface, minimum: 4.5 },
    { name: 'Brand text on paper', foreground: theme.brand_deep, background: theme.paper, minimum: 4.5 },
    { name: 'Brand text on surface', foreground: theme.brand_deep, background: theme.surface, minimum: 4.5 },
    { name: 'Body text on paper', foreground: FIXED_COLORS.ink, background: theme.paper, minimum: 7 },
    { name: 'Body text on surface', foreground: FIXED_COLORS.ink, background: theme.surface, minimum: 7 },
    { name: 'Secondary text on paper', foreground: FIXED_COLORS.inkSoft, background: theme.paper, minimum: 4.5 },
    { name: 'Muted text on paper', foreground: FIXED_COLORS.muted, background: theme.paper, minimum: 4.5 },
    { name: 'Control border on paper', foreground: FIXED_COLORS.lineDark, background: theme.paper, minimum: 3, nonText: true }
  ];

  return pairs.map((pair) => {
    let ratio = 0;
    let error = '';
    try {
      ratio = contrastRatio(pair.foreground, pair.background);
    } catch (caught) {
      error = caught.message;
    }
    return {
      ...pair,
      ratio: Number(ratio.toFixed(2)),
      pass: !error && ratio >= pair.minimum,
      error
    };
  });
}

export function themeContrastErrors(theme = {}) {
  return themeContrastChecks(theme)
    .filter((check) => !check.pass)
    .map((check) => `${check.name} must reach ${check.minimum}:1 contrast; received ${check.ratio}:1 (${check.foreground} on ${check.background})${check.error ? ` — ${check.error}` : ''}`);
}

export function accessibilityStatement(site) {
  const settings = site.accessibility || {};
  return {
    enabled: settings.statement_enabled !== false,
    contactEmail: settings.contact_email || site.editor_email,
    intro: settings.statement_intro || 'This publication aims to provide a readable, keyboard-accessible experience and practical alternatives when embedded documents are not supported by a reader’s browser or assistive technology.',
    feedbackNote: settings.feedback_note || 'When reporting a barrier, include the page address, the task you were trying to complete, and the browser or assistive technology involved when possible.'
  };
}

export const ACCESSIBILITY_FIXED_COLORS = FIXED_COLORS;
