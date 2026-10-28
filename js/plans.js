// "Coverage starts with your space": the space-type tabs. On a switch the panel slides up as a
// whole: the old content goes up and out at its own size, the new content follows right under
// it, and a thin line runs along the seam between them. The grey block behind the active tab
// slides to the new tab with the same timing.
(() => {
  const section = document.querySelector('.plans');
  if (!section) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SWITCH = 1000; // ms: the panel slide, the line and the tab block, all on one clock
  const SWITCH_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  // the hero's SWITCH_TIMING; the copy waits, hidden, until the new panel has nearly come to rest
  const T = { delay: 650, word: 800, stagger: 30, text: 120, fade: 700 };

  const tabRow = section.querySelector('.plans__tabs');
  const indicator = section.querySelector('.plans__indicator');
  const tabs = [...section.querySelectorAll('.plan-tab')];
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));
  section.style.setProperty('--switch-duration', `${SWITCH}ms`);
  section.style.setProperty('--switch-ease', SWITCH_EASE);

  /* ---------- copy, entering as the hero copy does on a switch ---------- */
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

  // animates from the given state to the element's own CSS state (see hero.js)
  const from = (el, keyframe, opts) => {
    const cs = getComputedStyle(el);
    const end = Object.fromEntries(Object.keys(keyframe).map((k) => [k, cs[k]]));
    return el.animate([keyframe, end], { fill: 'backwards', easing: EASE_OUT, ...opts });
  };

  function enterCopy(panel) {
    // the panel's own copy only, not the outgoing copy sliding over it
    panel = panel.querySelector(':scope > .plans__info');
    const d = T.delay;
    from(panel.querySelector('.plans__icon'), { opacity: 0, transform: 'translateY(10px)' }, { duration: T.fade, delay: d });
    panel.querySelectorAll('.plans__title .w__in').forEach((w, i) =>
      from(w, { transform: 'translateY(105%)' }, { duration: T.word, delay: d + i * T.stagger })
    );
    [panel.querySelector('.plans__tags'), panel.querySelector('.plans__desc')].forEach((el, i) =>
      from(el, { opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' }, {
        duration: T.fade,
        delay: d + T.text + i * 60,
      })
    );
  }

  /* ---------- wifi signal ---------- */
  // A single wave out of every access point, across the whole building (the zones together tile
  // it), at one speed for all: a wave that has further to go takes longer.
  const WAVE_SPEED = 320; // plan units (of the 680 wide plan) per second
  section.querySelectorAll('.plans__plan').forEach((plan) => {
    const zones = [...plan.querySelectorAll('.plans__signal')];
    if (!zones.length) return;
    const num = (el, v) => parseFloat(el.style.getPropertyValue(v));
    const box = zones.map((z) => [num(z, '--x'), num(z, '--y'), num(z, '--w'), num(z, '--h')]);
    const x0 = Math.min(...box.map((b) => b[0]));
    const y0 = Math.min(...box.map((b) => b[1]));
    const x1 = Math.max(...box.map((b) => b[0] + b[2]));
    const y1 = Math.max(...box.map((b) => b[1] + b[3]));
    const layer = document.createElement('span');
    layer.className = 'plans__waves';
    layer.setAttribute('aria-hidden', 'true');
    Object.entries({ '--x': x0, '--y': y0, '--w': x1 - x0, '--h': y1 - y0 }).forEach(([k, v]) => layer.style.setProperty(k, v));
    zones.forEach((z, i) => {
      const ap = z.querySelector('i');
      const cx = box[i][0] + num(ap, '--x') + 6 - x0; // the square's centre, in the layer
      const cy = box[i][1] + num(ap, '--y') + 6 - y0;
      const r = Math.max(...[[0, 0], [x1 - x0, 0], [0, y1 - y0], [x1 - x0, y1 - y0]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
      const wave = document.createElement('span');
      wave.className = 'plans__wave';
      Object.entries({ '--cx': cx, '--cy': cy, '--r': r, '--dur': `${(r / WAVE_SPEED).toFixed(2)}s` }).forEach(([k, v]) => wave.style.setProperty(k, v));
      layer.append(wave);
    });
    plan.insertBefore(layer, zones[0]);
  });

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
    // the old waves are long gone; a fresh copy would play them again
    ghost.querySelectorAll('.plans__waves').forEach((layer) => layer.remove());
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
    enterCopy(panelOf(tab));
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
