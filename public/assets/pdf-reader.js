(() => {
  document.documentElement.classList.add('js');
  document.querySelectorAll('[data-print-page]').forEach((button) => button.addEventListener('click', () => window.print()));
  const readers = document.querySelectorAll('[data-pdf-reader]');
  if (!readers.length) return;

  const pdfjs = import('/assets/pdfjs/pdf.min.mjs').then((module) => {
    module.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.min.mjs';
    return module;
  });

  readers.forEach((reader) => {
    const source = reader.dataset.pdfSource || '';
    const stage = reader.querySelector('[data-pdf-stage]');
    const canvas = reader.querySelector('[data-pdf-canvas]');
    const status = reader.querySelector('[data-pdf-status]');
    const loading = reader.querySelector('[data-pdf-loading]');
    const pageCount = reader.querySelector('[data-pdf-page-count]');
    const previous = reader.querySelector('[data-pdf-previous]');
    const next = reader.querySelector('[data-pdf-next]');
    const zoomOut = reader.querySelector('[data-pdf-zoom-out]');
    const zoomIn = reader.querySelector('[data-pdf-zoom-in]');
    const viewButtons = [...reader.querySelectorAll('[data-pdf-view]')];
    const fullscreenButton = reader.querySelector('[data-pdf-fullscreen]');
    let documentProxy; let page = 1; let zoom = 1; let fit = reader.dataset.defaultView || 'FitH'; let renderTask; let wasFullscreen = false;
    const setStatus = (message, state = '') => { if (status) status.textContent = message; reader.dataset.pdfState = state; };
    const updateControls = () => {
      if (pageCount) pageCount.textContent = documentProxy ? `Page ${page} of ${documentProxy.numPages}` : 'Page 0 of 0';
      if (previous) previous.disabled = !documentProxy || page <= 1;
      if (next) next.disabled = !documentProxy || page >= documentProxy.numPages;
      viewButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.pdfView === fit)));
    };
    const render = async () => {
      if (!documentProxy || !canvas || !stage) return;
      renderTask?.cancel();
      const pdfPage = await documentProxy.getPage(page);
      const base = pdfPage.getViewport({ scale: 1 });
      const stageWidth = Math.max(240, stage.clientWidth - 24);
      const stageHeight = Math.max(320, stage.clientHeight - 24);
      const fitScale = fit === 'Fit' ? Math.min(stageWidth / base.width, stageHeight / base.height) : stageWidth / base.width;
      const viewport = pdfPage.getViewport({ scale: Math.max(.3, Math.min(4, fitScale * zoom)) });
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.ceil(viewport.width * ratio); canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${Math.ceil(viewport.width)}px`; canvas.style.height = `${Math.ceil(viewport.height)}px`;
      const context = canvas.getContext('2d', { alpha: false });
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      renderTask = pdfPage.render({ canvasContext: context, viewport });
      await renderTask.promise;
      canvas.hidden = false; loading?.classList.add('is-hidden'); reader.classList.add('is-loaded'); setStatus(`Page ${page} of ${documentProxy.numPages} ready`, 'ready'); updateControls();
    };
    const open = async () => {
      try {
        setStatus('Loading PDF…', 'loading');
        const module = await pdfjs;
        documentProxy = await module.getDocument({ url: source, disableAutoFetch: false }).promise;
        await render();
      } catch (error) {
        loading?.classList.add('is-hidden'); setStatus('Preview could not be rendered. Open or download the original PDF instead.', 'failed'); reader.classList.add('is-failed'); console.warn('PDF preview failed', error);
      }
    };
    previous?.addEventListener('click', async () => { if (page > 1) { page -= 1; await render(); } });
    next?.addEventListener('click', async () => { if (documentProxy && page < documentProxy.numPages) { page += 1; await render(); } });
    zoomOut?.addEventListener('click', async () => { zoom = Math.max(.5, zoom - .2); await render(); });
    zoomIn?.addEventListener('click', async () => { zoom = Math.min(2.5, zoom + .2); await render(); });
    viewButtons.forEach((button) => button.addEventListener('click', async () => { fit = button.dataset.pdfView; zoom = 1; await render(); }));
    stage?.addEventListener('keydown', async (event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); previous?.click(); } if (event.key === 'ArrowRight') { event.preventDefault(); next?.click(); } });
    if (fullscreenButton && stage) {
      if (typeof reader.requestFullscreen !== 'function') fullscreenButton.hidden = true;
      else {
        fullscreenButton.addEventListener('click', async () => { try { if (document.fullscreenElement === reader) await document.exitFullscreen(); else await reader.requestFullscreen(); } catch { setStatus('Full-screen mode is unavailable. Open the PDF in a new tab instead.', 'notice'); } });
        document.addEventListener('fullscreenchange', async () => { const active = document.fullscreenElement === reader; fullscreenButton.setAttribute('aria-pressed', String(active)); reader.classList.toggle('is-fullscreen', active); if (active) stage.focus({ preventScroll: true }); else if (wasFullscreen) fullscreenButton.focus({ preventScroll: true }); wasFullscreen = active; await render(); });
      }
    }
    open();
  });
})();
