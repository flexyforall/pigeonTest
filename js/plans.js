// "Coverage starts with your space": the space-type tabs. On a switch the panel slides up as a
// whole: the old content goes up and out at its own size, the new content follows right under
// it, and a thin line runs along the seam between them. The black block behind the active tab
// slides quickly to the new tab.
(() => {
  const section = document.querySelector('.plans');
  if (!section) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SWITCH = 1000; // ms: the panel slide
  const SLIDE = 500; // ms: the tab block
  const SWITCH_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

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

  /* ---------- panel slide ---------- */
  // a copy of the outgoing panel goes up out of the incoming one while its content comes up
  // from below; the line is the seam between the two
  let sliding = null;
  function slide(fromPanel, toPanel) {
    if (sliding) sliding.forEach((el) => el.remove());
    const content = [...toPanel.children];
    const ghost = fromPanel.cloneNode(true);
    ghost.classList.add('plans__ghost');
    ['id', 'role', 'aria-labelledby', 'hidden'].forEach((a) => ghost.removeAttribute(a));
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    const line = document.createElement('span');
    line.className = 'plans__scan';
    line.append(document.createElement('i'));
    toPanel.append(ghost, line);
    sliding = [ghost, line];

    const h = toPanel.offsetHeight;
    const opts = { duration: SWITCH, easing: SWITCH_EASE };
    ghost.animate([{ transform: 'none' }, { transform: `translateY(${-h}px)` }], { ...opts, fill: 'forwards' });
    content.forEach((el) => el.animate([{ transform: `translateY(${h}px)` }, { transform: 'none' }], opts));
    const run = line.firstChild.animate(
      [{ top: '100%', opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.92 }, { top: '0%', opacity: 0 }],
      { ...opts, fill: 'forwards' }
    );
    run.finished.then(() => {
      ghost.remove();
      line.remove();
      if (sliding && sliding[0] === ghost) sliding = null;
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
    slide(fromPanel, panelOf(tab));
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
