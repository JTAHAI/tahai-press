(() => {
  const menus = [...document.querySelectorAll('[data-navigation-menu]')];
  if (!menus.length) return;

  const close = (menu) => {
    if (menu.open) menu.removeAttribute('open');
  };

  for (const menu of menus) {
    menu.addEventListener('toggle', () => {
      if (!menu.open) return;
      for (const other of menus) {
        if (other !== menu) close(other);
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openMenu = menus.find((menu) => menu.open);
    if (!openMenu) return;
    const summary = openMenu.querySelector('summary');
    close(openMenu);
    summary?.focus();
  });

  document.addEventListener('pointerdown', (event) => {
    for (const menu of menus) {
      if (menu.open && !menu.contains(event.target)) close(menu);
    }
  });
})();
