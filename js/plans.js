// "Coverage starts with your space": the space-type tabs, switched the way the hero switches
// audiences. A thin line sweeps up across the whole panel, cutting the old content away above
// it, while the black block behind the active tab slides quickly to the new tab. The old copy is
// pulled up and out of the panel and the new copy rises into place from below.
(() => {
  const section = document.querySelector('.plans');
  if (!section) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SWITCH = 1000; // ms: the scan line
  const SLIDE = 500; // ms: the tab block
  const SWITCH_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
  const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
  const EASE_IN = 'cubic-bezier(0.55, 0, 0.75, 0.3)';
  const RISE = 220; // px the new copy rises from

  const tabRow = section.querySelector('.plans__tabs');
  const indicator = section.querySelector('.plans__indicator');
  const tabs = [...section.querySelectorAll('.plan-tab')];
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));
  section.style.setProperty('--switch-duration', `${SLIDE}ms`);
  section.style.setProperty('--switch-ease', SWITCH_EASE);

  /* ---------- tab block ---------- */
  function moveIndicator(tab, animated) {
    indicator.classList.toggle('is-animated', animated);
    indicator.style.width = `${tab.offsetWidth}px`;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
  }

  /* ---------- copy ---------- */
  // the old copy is pulled up and out; the new one rises from low in the panel, piece by piece
  const pieces = (panel) =>
    ['.plans__icon', '.plans__title', '.plans__tags', '.plans__desc', '.btn'].map((sel) => panel.querySelector(sel));

  // the old copy goes as one block, its layout untouched, up and out of the panel
  function leaveCopy(ghost) {
    const top = ghost.getBoundingClientRect().top;
    const info = ghost.querySelector('.plans__info');
    const bottom = Math.max(...pieces(ghost).map((el) => el.getBoundingClientRect().bottom));
    info.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${top - bottom}px)`, opacity: 0.4 }], {
      duration: 800,
      easing: EASE_IN,
      fill: 'forwards',
    });
  }

  function enterCopy(panel) {
    pieces(panel).forEach((el, i) =>
      el.animate([{ transform: `translateY(${RISE}px)`, opacity: 0 }, { opacity: 1, offset: 0.4 }, { transform: 'none', opacity: 1 }], {
        duration: 1100,
        delay: 250 + i * 50,
        easing: EASE_OUT,
        fill: 'backwards',
      })
    );
  }

  /* ---------- scan over the panel ---------- */
  // a copy of the outgoing panel on top of the incoming one, cut away from the bottom
  let scanning = null;
  function scan(fromPanel, toPanel) {
    if (scanning) scanning.forEach((el) => el.remove());
    const ghost = fromPanel.cloneNode(true);
    ghost.classList.add('plans__ghost');
    ['id', 'role', 'aria-labelledby', 'hidden'].forEach((a) => ghost.removeAttribute(a));
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    const line = document.createElement('span');
    line.className = 'plans__scan';
    line.append(document.createElement('i'));
    toPanel.append(ghost, line);
    scanning = [ghost, line];

    const opts = { duration: SWITCH, easing: SWITCH_EASE, fill: 'forwards' };
    ghost.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], opts);
    // the old plan pales as it goes, the old copy leaves upwards; the ghost's backdrop stays opaque
    ghost.querySelector('.plans__illus').animate([{ opacity: 1 }, { opacity: 0.45 }], opts);
    leaveCopy(ghost);
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
    moveIndicator(tab, !reduceMotion);
    if (reduceMotion || !fromPanel) return;
    const panel = panelOf(tab);
    scan(fromPanel, panel);
    enterCopy(panel);
  }

  moveIndicator(tabs.find((t) => t.classList.contains('is-active')), false);
  window.addEventListener('resize', () => moveIndicator(tabs.find((t) => t.classList.contains('is-active')), false));
  if (document.fonts) document.fonts.ready.then(() => moveIndicator(tabs.find((t) => t.classList.contains('is-active')), false));

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
