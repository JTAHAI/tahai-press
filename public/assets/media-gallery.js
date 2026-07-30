(() => {
  const dialog = document.querySelector('[data-media-lightbox]');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const image = dialog.querySelector('[data-lightbox-image]');
  const caption = dialog.querySelector('[data-lightbox-caption]');
  const close = dialog.querySelector('[data-lightbox-close]');
  let opener = null;

  const closeDialog = () => {
    if (dialog.open) dialog.close();
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-lightbox-open]');
    if (!trigger) return;
    const src = trigger.dataset.lightboxSrc || '';
    if (!src) return;
    opener = trigger;
    image.src = src;
    image.alt = trigger.dataset.lightboxAlt || '';
    caption.textContent = trigger.dataset.lightboxCaption || '';
    caption.hidden = !caption.textContent;
    dialog.showModal();
    close.focus();
  });

  close?.addEventListener('click', closeDialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('close', () => {
    image.removeAttribute('src');
    opener?.focus();
    opener = null;
  });
})();
