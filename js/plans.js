// "Coverage starts with your space": the space-type tabs. Each tab shows its own panel. On a
// switch a thin line sweeps up across the whole panel: below it the new tab (copy and plan),
// above it the old one, fading a little as it is cut away. The new copy comes in the way the
// hero copy does, each piece as the line reaches it: the heading rises word by word, the tags
// and text fade up out of a blur, the button opens from the bottom.
(() => {
  const section = document.querySelector('.plans');
  if (!section) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SCAN = 1600; // ms
  const SCAN_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'; // gentle in and out
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const content = section.querySelector('.plans__content');
  const tabs = [...section.querySelectorAll('.plan-tab')];
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));

  /* ---------- copy entrance, as in the hero ---------- */
  // headings split into words in clipping boxes (same markup as the hero's .w / .w__in)
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

  const from = (el, keyframe, opts) => el.animate([keyframe, {}].map((k, i) => (i ? Object.fromEntries(Object.keys(keyframe).map((p) => [p, getComputedStyle(el)[p] === 'none' && p === 'clipPath' ? 'inset(0 0 0 0)' : getComputedStyle(el)[p]])) : k)), { fill: 'backwards', easing: EASE_OUT, ...opts });

  // when the line reaches an element on its way up: the share of the scan, through its easing
  const reach = (panel, el) => {
    const y = (el.getBoundingClientRect().bottom - panel.getBoundingClientRect().top) / panel.offsetHeight;
    const p = Math.min(1, Math.max(0, 1 - y)); // how far up the line must have travelled
    // invert the in-out easing roughly with a smoothstep-shaped lookup
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const t = (lo + hi) / 2;
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      if (e < p) lo = t;
      else hi = t;
    }
    return lo * SCAN;
  };

  function enterCopy(panel) {
    const title = panel.querySelector('.plans__title');
    const words = [...title.querySelectorAll('.w__in')];
    const t0 = reach(panel, title);
    words.forEach((w, i) => from(w, { transform: 'translateY(105%)' }, { duration: 900, delay: t0 + i * 40 }));
    [panel.querySelector('.plans__tags'), panel.querySelector('.plans__desc'), panel.querySelector('.plans__icon')].forEach((el) =>
      from(el, { opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' }, { duration: 800, delay: reach(panel, el) })
    );
    const btn = panel.querySelector('.btn');
    from(btn, { opacity: 0, transform: 'translateY(16px)', clipPath: 'inset(100% 0 0 0)' }, { duration: 800, delay: reach(panel, btn) });
  }

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
    if (reduceMotion || !fromPanel) return;
    scan(fromPanel, panelOf(tab));
    enterCopy(panelOf(tab));
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
