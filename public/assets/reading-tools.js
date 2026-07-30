(() => {
  document.documentElement.classList.add('js');
  const controls = [...document.querySelectorAll('[data-reading-tools]')];
  if (!controls.length) return;

  const storageKey = 'tahai-press-reader-preferences-v1';
  const defaults = Object.freeze({
    text: 'default',
    spacing: 'normal',
    measure: 'standard',
    surface: 'publication',
    underline: false,
    simplify: false,
    motion: false
  });
  const allowed = {
    text: new Set(['smaller', 'default', 'larger']),
    spacing: new Set(['normal', 'relaxed', 'open']),
    measure: new Set(['narrow', 'standard', 'wide']),
    surface: new Set(['publication', 'paper', 'sepia', 'dark', 'contrast'])
  };

  const readStored = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return {
        text: allowed.text.has(parsed.text) ? parsed.text : defaults.text,
        spacing: allowed.spacing.has(parsed.spacing) ? parsed.spacing : defaults.spacing,
        measure: allowed.measure.has(parsed.measure) ? parsed.measure : defaults.measure,
        surface: allowed.surface.has(parsed.surface) ? parsed.surface : defaults.surface,
        underline: parsed.underline === true,
        simplify: parsed.simplify === true,
        motion: parsed.motion === true
      };
    } catch {
      return { ...defaults };
    }
  };

  let preferences = readStored();
  const root = document.documentElement;

  const persist = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch {}
  };

  const announce = (message) => {
    for (const control of controls) {
      const status = control.querySelector('[data-reader-status]');
      if (status) status.textContent = message;
    }
  };

  const setPressed = (selector, value) => {
    for (const button of document.querySelectorAll(selector)) {
      const candidate = button.dataset.readerText || button.dataset.readerSpacing || button.dataset.readerMeasure;
      button.setAttribute('aria-pressed', candidate === value ? 'true' : 'false');
    }
  };

  const synchronizeControls = () => {
    setPressed('[data-reader-text]', preferences.text);
    setPressed('[data-reader-spacing]', preferences.spacing);
    setPressed('[data-reader-measure]', preferences.measure);
    for (const select of document.querySelectorAll('[data-reader-surface]')) select.value = preferences.surface;
    for (const checkbox of document.querySelectorAll('[data-reader-underline]')) checkbox.checked = preferences.underline;
    for (const checkbox of document.querySelectorAll('[data-reader-simplify]')) checkbox.checked = preferences.simplify;
    for (const checkbox of document.querySelectorAll('[data-reader-motion]')) checkbox.checked = preferences.motion;
  };

  const apply = ({ message = '' } = {}) => {
    root.dataset.readerText = preferences.text;
    root.dataset.readerSpacing = preferences.spacing;
    root.dataset.readerMeasure = preferences.measure;
    root.dataset.readerSurface = preferences.surface;
    root.classList.toggle('reader-underline-links', preferences.underline);
    root.classList.toggle('reader-simplified', preferences.simplify);
    root.classList.toggle('reader-reduce-motion', preferences.motion);
    synchronizeControls();
    persist();
    if (message) announce(message);
  };

  document.addEventListener('click', (event) => {
    const text = event.target.closest('[data-reader-text]');
    if (text) {
      preferences.text = text.dataset.readerText;
      apply({ message: `Text size set to ${preferences.text}.` });
      return;
    }
    const spacing = event.target.closest('[data-reader-spacing]');
    if (spacing) {
      preferences.spacing = spacing.dataset.readerSpacing;
      apply({ message: `Line spacing set to ${preferences.spacing}.` });
      return;
    }
    const measure = event.target.closest('[data-reader-measure]');
    if (measure) {
      preferences.measure = measure.dataset.readerMeasure;
      apply({ message: `Reading width set to ${preferences.measure}.` });
      return;
    }
    const reset = event.target.closest('[data-reader-reset]');
    if (reset) {
      preferences = { ...defaults };
      apply({ message: 'Reader preferences reset.' });
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-reader-surface]')) {
      preferences.surface = event.target.value;
      apply({ message: `Reading surface set to ${preferences.surface}.` });
    } else if (event.target.matches('[data-reader-underline]')) {
      preferences.underline = event.target.checked;
      apply({ message: preferences.underline ? 'All links are underlined.' : 'Default link styling restored.' });
    } else if (event.target.matches('[data-reader-simplify]')) {
      preferences.simplify = event.target.checked;
      apply({ message: preferences.simplify ? 'Decorative page elements reduced.' : 'Publication decoration restored.' });
    } else if (event.target.matches('[data-reader-motion]')) {
      preferences.motion = event.target.checked;
      apply({ message: preferences.motion ? 'Motion reduced.' : 'Default motion preference restored.' });
    }
  });

  for (const control of controls) {
    control.addEventListener('toggle', () => {
      if (control.open) requestAnimationFrame(() => control.querySelector('button, select, input')?.focus({ preventScroll: true }));
    });
  }

  apply();
})();
