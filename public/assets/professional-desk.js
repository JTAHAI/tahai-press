(() => {
  'use strict';

  function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const input = document.createElement('textarea');
      input.value = text;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.append(input);
      input.select();
      try {
        if (!document.execCommand('copy')) throw new Error('Copy command was rejected.');
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        input.remove();
      }
    });
  }

  document.querySelectorAll('[data-copy-target]').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = document.getElementById(button.dataset.copyTarget || '');
      const status = button.closest('[data-copy-region]')?.querySelector('[data-copy-status]');
      if (!target) return;
      try {
        await copyText(target.textContent.trim());
        if (status) status.textContent = 'Copied to clipboard.';
        const original = button.textContent;
        button.textContent = 'Copied';
        window.setTimeout(() => { button.textContent = original; }, 1800);
      } catch {
        if (status) status.textContent = 'Copy failed. Select the text and copy it manually.';
      }
    });
  });

  document.querySelectorAll('[data-copy-url]').forEach((button) => {
    button.addEventListener('click', async () => {
      const status = button.closest('[data-copy-region]')?.querySelector('[data-copy-status]');
      try {
        await copyText(window.location.href.split('#')[0]);
        if (status) status.textContent = 'Article link copied.';
        const original = button.textContent;
        button.textContent = 'Link copied';
        window.setTimeout(() => { button.textContent = original; }, 1800);
      } catch {
        if (status) status.textContent = 'Copy failed. Use the browser address bar instead.';
      }
    });
  });
})();
