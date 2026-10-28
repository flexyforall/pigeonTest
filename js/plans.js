// "Coverage starts with your space": the space-type tabs. Each tab shows its own panel. On a
// switch a thin line sweeps up across the whole panel: below it the new tab (copy and plan),
// above it the old one, fading a little as it is cut away.
(() => {
  const section = document.querySelector('.plans');
  if (!section) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SCAN = 1100; // ms
  const SCAN_EASE = 'cubic-bezier(0.6, 0, 0.3, 1)'; // the hero's wipe easing
  const content = section.querySelector('.plans__content');
  const tabs = [...section.querySelectorAll('.plan-tab')];
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));

  // a copy of the outgoing panel on top of the incoming one, cut away from the bottom
  let scanning = null;
  function scan(fromPanel, toPanel) {
    if (scanning) scanning.forEach((el) => el.remove());
    const ghost = fromPanel.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.hidden = false;
    ghost.classList.add('plans__ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.top = `${toPanel.offsetTop}px`;
    ghost.style.height = `${toPanel.offsetHeight}px`;
    const line = document.createElement('span');
    line.className = 'plans__scan';
    line.append(document.createElement('i'));
    line.style.top = `${toPanel.offsetTop}px`;
    line.style.height = `${toPanel.offsetHeight}px`;
    content.append(ghost, line);
    scanning = [ghost, line];

    const opts = { duration: SCAN, easing: SCAN_EASE, fill: 'forwards' };
    ghost.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], opts);
    // the old copy and plan pale as they go; the ghost's own backdrop stays opaque
    [...ghost.children].forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0.45 }], opts));
    const run = line.firstChild.animate(
      [{ top: '100%', opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.92 }, { top: '0%', opacity: 0 }],
      opts
    );
    run.finished.then(() => {
      ghost.remove();
      line.remove();
      if (scanning && scanning[0] === ghost) scanning = null;
    }, () => {});
  }

  function select(tab) {
    if (tab.classList.contains('is-active')) return;
    const fromPanel = section.querySelector('.plans__panel:not([hidden]):not(.plans__ghost)');
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panelOf(t).hidden = !on;
    });
    if (!reduceMotion && fromPanel) scan(fromPanel, panelOf(tab));
  }

  tabs.forEach((tab, i) => {
    tab.tabIndex = i === 0 ? 0 : -1;
    tab.addEventListener('click', () => select(tab));
  });

  // arrows move between tabs
  section.querySelector('.plans__tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    select(next);
  });
})();
