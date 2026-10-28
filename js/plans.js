// "Coverage starts with your space": the space-type tabs. On a switch the panel slides up as a
// whole: the old content goes up and out at its own size, the new content follows right under
// it, and a thin line runs along the seam between them. The grey block behind the active tab
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

  /* ---------- wifi signal ---------- */
  // all the zones of a plan grow out of their access points together, then fade away together
  section.querySelectorAll('.plans__panel').forEach((panel) =>
    panel.querySelectorAll('.plans__signal').forEach((zone) => {
      const ap = zone.querySelector('i');
      zone.style.setProperty('--ax', ap.style.getPropertyValue('--x'));
      zone.style.setProperty('--ay', ap.style.getPropertyValue('--y'));
    })
  );

  new IntersectionObserver((entries, io) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    section.classList.add('is-seen');
    io.disconnect();
  }, { threshold: 0.4 }).observe(section.querySelector('.plans__content'));

  /* ---------- tab block ---------- */
  function moveIndicator(tab, animated) {
    indicator.classList.toggle('is-animated', animated);
    indicator.style.width = `${tab.offsetWidth}px`;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
  }

  /* ---------- panel slide ---------- */
  // a copy of the outgoing panel goes up out of the incoming one while its content comes up
  // from below; the line is the seam between the two
  // The plans themselves don't travel: each sits still and is cut at the line, the old one above
  // it, the new one below. That's done by sliding the plan's frame and moving the plan back the
  // other way by as much, so everything runs as transforms on one clock. The grid behind the
  // plans is lifted onto a still layer of its own meanwhile.
  let sliding = null;
  function slide(fromPanel, toPanel) {
    if (sliding) sliding();
    const info = toPanel.querySelector('.plans__info');
    const illus = toPanel.querySelector('.plans__illus');
    const plan = toPanel.querySelector('.plans__plan');

    const grid = document.createElement('span');
    grid.className = 'plans__grid';
    Object.assign(grid.style, {
      left: `${illus.offsetLeft}px`,
      top: `${illus.offsetTop}px`,
      width: `${illus.offsetWidth}px`,
      height: `${illus.offsetHeight}px`,
      background: getComputedStyle(illus).background,
    });
    illus.style.background = 'none';

    const ghost = fromPanel.cloneNode(true);
    ghost.classList.add('plans__ghost');
    ['id', 'role', 'aria-labelledby', 'hidden'].forEach((a) => ghost.removeAttribute(a));
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.querySelector('.plans__illus').style.background = 'none';
    // the old zones are long gone; a fresh copy would play them again
    ghost.querySelectorAll('.plans__signal').forEach((zone) => zone.remove());
    const line = document.createElement('span');
    line.className = 'plans__scan';
    line.append(document.createElement('i'));
    toPanel.prepend(grid);
    toPanel.append(ghost, line);
    const done = () => {
      [info, illus, plan].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
      illus.style.background = '';
      [grid, ghost, line].forEach((el) => el.remove());
      sliding = null;
    };
    sliding = done;

    const h = toPanel.offsetHeight;
    const opts = { duration: SWITCH, easing: SWITCH_EASE, fill: 'forwards' };
    const move = (el, from, to) => el.animate([{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }], opts);
    move(ghost, 0, -h);
    move(ghost.querySelector('.plans__plan'), 0, h);
    move(info, h, 0);
    move(illus, h, 0);
    move(plan, -h, 0);
    const run = line.firstChild.animate(
      [
        { transform: `translateY(${h}px)`, opacity: 0 },
        { opacity: 1, offset: 0.06 },
        { opacity: 1, offset: 0.92 },
        { transform: 'none', opacity: 0 },
      ],
      opts
    );
    run.finished.then(() => sliding === done && done(), () => {});
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
