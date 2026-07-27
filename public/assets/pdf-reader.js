(() => {
  document.documentElement.classList.add('js');

  document.querySelectorAll('[data-print-page]').forEach((button) => {
    button.addEventListener('click', () => window.print());
  });

  const readers = document.querySelectorAll('[data-pdf-reader]');
  if (!readers.length) return;

  const buildPreviewUrl = (source, view) => {
    try {
      const url = new URL(source, window.location.href);
      url.hash = `view=${view}&toolbar=1&navpanes=0`;
      return url.href;
    } catch {
      return `${source.split('#')[0]}#view=${view}&toolbar=1&navpanes=0`;
    }
  };

  readers.forEach((reader) => {
    const source = reader.dataset.pdfSource || '';
    const frame = reader.querySelector('[data-pdf-frame]');
    const stage = reader.querySelector('[data-pdf-stage]');
    const status = reader.querySelector('[data-pdf-status]');
    const loading = reader.querySelector('[data-pdf-loading]');
    const viewButtons = [...reader.querySelectorAll('[data-pdf-view]')];
    const fullscreenButton = reader.querySelector('[data-pdf-fullscreen]');
    const loadingMessage = loading?.querySelector('p');
    const initialLoadingMessage = loadingMessage?.textContent || 'Preparing the browser PDF preview…';
    let loadTimer;
    let wasFullscreen = false;

    const setStatus = (message, state = '') => {
      if (status) status.textContent = message;
      reader.dataset.pdfState = state;
    };

    const beginLoading = (message = 'Loading preview…') => {
      reader.classList.remove('is-loaded');
      if (loadingMessage) loadingMessage.textContent = message === 'Loading preview…' ? initialLoadingMessage : message;
      setStatus(message, 'loading');
      window.clearTimeout(loadTimer);
      loadTimer = window.setTimeout(() => {
        reader.classList.add('is-loaded');
        setStatus('Preview may still be loading. Direct links remain available.', 'delayed');
        if (loadingMessage) loadingMessage.textContent = 'The preview may still be loading. Use Open or Download if needed.';
      }, 12000);
    };

    const finishLoading = () => {
      window.clearTimeout(loadTimer);
      reader.classList.add('is-loaded');
      setStatus('Preview ready', 'ready');
    };

    if (frame) {
      frame.addEventListener('load', finishLoading);
      beginLoading();
    }

    viewButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.pdfView;
        if (!frame || !source || !view) return;
        viewButtons.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
        beginLoading(view === 'Fit' ? 'Switching to fit page…' : 'Switching to fit width…');
        frame.src = buildPreviewUrl(source, view);
      });
    });

    const updateFullscreenLabel = () => {
      if (!fullscreenButton || !stage) return;
      const active = document.fullscreenElement === reader;
      fullscreenButton.setAttribute('aria-pressed', String(active));
      const label = fullscreenButton.querySelector('span');
      if (label) label.textContent = active ? 'Exit full screen' : 'Full screen';
      reader.classList.toggle('is-fullscreen', active);
      if (active) stage.focus({ preventScroll: true });
      else if (wasFullscreen) fullscreenButton.focus({ preventScroll: true });
      wasFullscreen = active;
    };

    if (fullscreenButton && stage) {
      if (typeof reader.requestFullscreen !== 'function') {
        fullscreenButton.hidden = true;
      } else {
        fullscreenButton.addEventListener('click', async () => {
          try {
            if (document.fullscreenElement === reader) await document.exitFullscreen();
            else await reader.requestFullscreen();
          } catch {
            setStatus('Full-screen mode is unavailable. Open the PDF in a new tab instead.', 'notice');
          }
        });
        document.addEventListener('fullscreenchange', updateFullscreenLabel);
        updateFullscreenLabel();
      }
    }
  });
})();
