(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const configurationScript = document.querySelector('script[data-reader-reach]');
  const offlineEnabled = configurationScript?.dataset.offlineEnabled === 'true';
  const STORAGE_KEY = 'tahai-press-saved-articles-v1';
  const MAX_SAVED = 100;
  const safePath = (value) => {
    try {
      const url = new URL(String(value || ''), window.location.origin);
      return url.origin === window.location.origin && url.pathname.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : '';
    } catch { return ''; }
  };
  const readSaved = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(value)) return [];
      return value.filter((item) => item && safePath(item.url) && typeof item.title === 'string').slice(0, MAX_SAVED);
    } catch { return []; }
  };
  const writeSaved = (items) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_SAVED))); return true; }
    catch { return false; }
  };
  const announce = (region, message) => {
    const status = region?.querySelector?.('[data-reach-status]') || document.querySelector('[data-reach-global-status]');
    if (status) status.textContent = message;
  };
  const recordFromButton = (button) => ({
    url: safePath(button.dataset.articleUrl),
    title: String(button.dataset.articleTitle || '').trim(),
    excerpt: String(button.dataset.articleExcerpt || '').trim().slice(0, 360),
    published_at: String(button.dataset.articleDate || '').trim(),
    saved_at: new Date().toISOString()
  });
  const isSaved = (url, records = readSaved()) => records.some((item) => item.url === url);
  const refreshSaveButtons = () => {
    const records = readSaved();
    document.querySelectorAll('[data-save-article]').forEach((button) => {
      const saved = isSaved(safePath(button.dataset.articleUrl), records);
      button.setAttribute('aria-pressed', saved ? 'true' : 'false');
      const label = button.querySelector('[data-save-label]');
      if (label) label.textContent = saved ? 'Saved' : 'Save story';
    });
    document.querySelectorAll('[data-saved-count]').forEach((node) => { node.textContent = String(records.length); });
  };

  document.querySelectorAll('[data-save-article]').forEach((button) => {
    button.addEventListener('click', () => {
      const record = recordFromButton(button);
      if (!record.url || !record.title) return;
      const records = readSaved();
      const existing = records.findIndex((item) => item.url === record.url);
      let next;
      let message;
      if (existing >= 0) {
        next = records.filter((item) => item.url !== record.url);
        message = 'Removed from saved stories.';
      } else {
        next = [record, ...records].slice(0, MAX_SAVED);
        message = 'Saved in this browser.';
      }
      if (!writeSaved(next)) message = 'This browser could not save the story.';
      refreshSaveButtons();
      announce(button.closest('[data-reach-actions]'), message);
    });
  });

  const copyText = async (text) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('Copy command failed.');
  };

  document.querySelectorAll('[data-share-article]').forEach((button) => {
    button.addEventListener('click', async () => {
      const url = new URL(safePath(button.dataset.articleUrl) || window.location.pathname, window.location.origin).href;
      const title = String(button.dataset.articleTitle || document.title);
      const text = String(button.dataset.articleExcerpt || '').slice(0, 240);
      try {
        if (navigator.share) {
          await navigator.share({ title, text, url });
          announce(button.closest('[data-reach-actions]'), 'Share sheet opened.');
        } else {
          await copyText(url);
          announce(button.closest('[data-reach-actions]'), 'Story link copied.');
        }
      } catch (error) {
        if (error?.name !== 'AbortError') announce(button.closest('[data-reach-actions]'), 'Sharing was unavailable. Copy the address from the browser.');
      }
    });
  });

  const savedRoot = document.querySelector('[data-saved-library]');
  const renderSavedLibrary = () => {
    if (!savedRoot) return;
    const list = savedRoot.querySelector('[data-saved-list]');
    const empty = savedRoot.querySelector('[data-saved-empty]');
    const records = readSaved();
    if (!list || !empty) return;
    list.replaceChildren();
    empty.hidden = records.length > 0;
    records.forEach((record) => {
      const article = document.createElement('article');
      article.className = 'saved-story-card';
      const heading = document.createElement('h2');
      const link = document.createElement('a');
      link.href = record.url;
      link.textContent = record.title;
      heading.append(link);
      article.append(heading);
      if (record.excerpt) {
        const excerpt = document.createElement('p');
        excerpt.textContent = record.excerpt;
        article.append(excerpt);
      }
      const actions = document.createElement('div');
      actions.className = 'button-row';
      const open = document.createElement('a');
      open.className = 'button button-secondary';
      open.href = record.url;
      open.textContent = 'Read story';
      const remove = document.createElement('button');
      remove.className = 'button button-quiet';
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        writeSaved(readSaved().filter((item) => item.url !== record.url));
        renderSavedLibrary();
        refreshSaveButtons();
        announce(savedRoot, 'Story removed.');
      });
      actions.append(open, remove);
      article.append(actions);
      list.append(article);
    });
    const count = savedRoot.querySelector('[data-saved-library-count]');
    if (count) count.textContent = `${records.length} saved ${records.length === 1 ? 'story' : 'stories'}`;
  };

  savedRoot?.querySelector('[data-clear-saved]')?.addEventListener('click', () => {
    if (!readSaved().length) return;
    writeSaved([]);
    renderSavedLibrary();
    refreshSaveButtons();
    announce(savedRoot, 'Saved stories cleared.');
  });

  document.querySelectorAll('[data-print-edition]').forEach((button) => button.addEventListener('click', () => window.print()));

  let installPrompt = null;
  const installButtons = [...document.querySelectorAll('[data-install-publication]')];
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    installButtons.forEach((button) => { button.hidden = false; });
  });
  installButtons.forEach((button) => button.addEventListener('click', async () => {
    if (!installPrompt) {
      announce(button.closest('[data-reach-actions]'), 'Use your browser menu to install or add this publication to your home screen.');
      return;
    }
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    announce(button.closest('[data-reach-actions]'), choice.outcome === 'accepted' ? 'Installation accepted.' : 'Installation dismissed.');
    installPrompt = null;
    button.hidden = true;
  }));
  window.addEventListener('appinstalled', () => installButtons.forEach((button) => { button.hidden = true; }));

  const setConnectionState = () => {
    const online = navigator.onLine;
    document.documentElement.dataset.connection = online ? 'online' : 'offline';
    document.querySelectorAll('[data-connection-status]').forEach((node) => { node.textContent = online ? 'Online' : 'Offline — cached pages remain available'; });
  };
  window.addEventListener('online', setConnectionState);
  window.addEventListener('offline', setConnectionState);
  setConnectionState();

  if (offlineEnabled && 'serviceWorker' in navigator && (window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname))) {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).then((registration) => {
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }).catch(() => {
      document.querySelectorAll('[data-offline-status]').forEach((node) => { node.textContent = 'Offline setup is unavailable in this browser.'; });
    });
  }

  renderSavedLibrary();
  refreshSaveButtons();
})();
