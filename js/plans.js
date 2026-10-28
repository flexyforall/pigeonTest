// "Coverage starts with your space": the space-type tabs, switched the way the hero switches
// audiences. A thin line sweeps up across the floor plan, cutting the old plan away above it,
// while the black block behind the active tab slides to the new tab with the same timing; the
// new copy comes in as the hero copy does on a switch, on its own clock.
(() => {
  const section = document.querySelector('.plans');
  if (!section) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SWITCH = 1600; // ms: the scan line and the tab block
  const SWITCH_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  // the hero's SWITCH_TIMING
  const T = { delay: 60, word: 800, stagger: 30, text: 120, button: 200, fade: 700 };

  const tabRow = section.querySelector('.plans__tabs');
  const indicator = section.querySelector('.plans__indicator');
  const tabs = [...section.querySelectorAll('.plan-tab')];
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));
  section.style.setProperty('--switch-duration', `${SWITCH}ms`);
  section.style.setProperty('--switch-ease', SWITCH_EASE);

  /* ---------- tab block ---------- */
  function moveIndicator(tab, animated) {
    indicator.classList.toggle('is-animated', animated);
    indicator.style.width = `${tab.offsetWidth}px`;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
  }

  /* ---------- copy, as the hero copy comes in on a switch ---------- */
  section.querySelectorAll('.plans__title').forEach((title) => {
    const label = title.textContent.trim();
    title.textContent = '';
    label.split(/\s+/).forEach((word, i, all) => {
      const w = document.createElement('span');
      w.className = 'w';
      const inner = document.createElement('span');
      inner.className = 'w__in';
      inner.textContent = word;
      w.append(inner);
      title.append(w);
      if (i < all.length - 1) title.append(' ');
    });
    title.setAttribute('aria-label', label);
    [...title.children].forEach((el) => el.setAttribute('aria-hidden', 'true'));
  });

  const from = (el, keyframe, opts) => {
    const cs = getComputedStyle(el);
    const end = Object.fromEntries(
      Object.keys(keyframe).map((k) => [k, k === 'clipPath' && cs[k] === 'none' ? 'inset(0 0 0 0)' : cs[k]])
    );
    return el.animate([keyframe, end], { fill: 'backwards', easing: EASE_OUT, ...opts });
  };

  function enterCopy(panel) {
    const d = T.delay;
    from(panel.querySelector('.plans__icon'), { opacity: 0, transform: 'translateY(10px)' }, { duration: T.fade, delay: d });
    panel.querySelectorAll('.plans__title .w__in').forEach((w, i) =>
      from(w, { transform: 'translateY(105%)' }, { duration: T.word, delay: d + i * T.stagger })
    );
    [panel.querySelector('.plans__tags'), panel.querySelector('.plans__desc')].forEach((el, i) =>
      from(el, { opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' }, { duration: T.fade, delay: d + T.text + i * 60 })
    );
    from(panel.querySelector('.btn'), { opacity: 0, transform: 'translateY(16px)', clipPath: 'inset(100% 0 0 0)' }, {
      duration: T.fade,
      delay: d + T.button + 60,
    });
  }

  /* ---------- scan over the plan ---------- */
  // a copy of the outgoing plan on top of the incoming one, cut away from the bottom
  let scanning = null;
  function scan(fromIllus, toIllus) {
    if (scanning) scanning.forEach((el) => el.remove());
    const ghost = fromIllus.cloneNode(true);
    ghost.classList.add('plans__ghost');
    const line = document.createElement('span');
    line.className = 'plans__scan';
    line.append(document.createElement('i'));
    toIllus.append(ghost, line);
    scanning = [ghost, line];

    const opts = { duration: SWITCH, easing: SWITCH_EASE, fill: 'forwards' };
    ghost.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], opts);
    // the old plan pales as it goes; the ghost's own backdrop stays opaque
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
    const fromIllus = section.querySelector('.plans__panel:not([hidden]) .plans__illus');
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panelOf(t).hidden = !on;
    });
    moveIndicator(tab, !reduceMotion);
    if (reduceMotion || !fromIllus) return;
    const panel = panelOf(tab);
    scan(fromIllus, panel.querySelector('.plans__illus'));
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
