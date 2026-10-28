// The layout grid below the hero draws itself in as the page scrolls: from the benefits section
// on, every rule of the page (card sides, row and section edges, the bands between sections) is
// redrawn as a line on a layer of its own, and each line grows as the scroll brings it up to the
// lower part of the screen, vertical ones downwards, horizontal ones from the left. Scrolling back
// up draws them back out. The sections' own rules are turned off meanwhile (their --c-rule goes
// transparent), so it's the same grid, only drawn.
// The connectivity section keeps its own frame: it sticks to the screen, so it has no fixed place
// on the page to draw in.
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const wide = window.matchMedia('(min-width: 961px)');

  const SCOPE = '.benefits, .divider, .plans, .steps';
  const FRONT = 0.9; // the drawing front, as a share of the screen height from its top
  const SWEEP = 420; // px of scroll a horizontal line takes to draw across

  const root = document.documentElement;
  const layer = document.createElement('div');
  layer.className = 'grid-lines';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  let lines = [];
  let rule = null; // the rules' colour, as computed

  // Rules are drawn as borders or as inset box-shadows (Figma strokes take no layout space);
  // read both off every element (and the card ::after overlays) while they are still showing.
  function collect() {
    root.classList.remove('grid-drawn');
    rule = rule || getComputedStyle(document.querySelector('.divider')).borderTopColor;
    const segs = new Map();
    const add = (x, y, len, vertical) => {
      if (len < 2) return;
      const key = `${vertical ? 'v' : 'h'}${Math.round(x)}:${Math.round(y)}:${Math.round(len)}`;
      segs.set(key, { x, y, len, vertical });
    };
    const sides = (r, s) => {
      if (s.top) add(r.left, r.top, r.width, false);
      if (s.bottom) add(r.left, r.bottom - 1, r.width, false);
      if (s.left) add(r.left, r.top, r.height, true);
      if (s.right) add(r.right - 1, r.top, r.height, true);
    };
    const shadowSides = (shadow) => {
      const s = {};
      if (!shadow || shadow === 'none') return s;
      shadow.split(/,(?![^(]*\))/).forEach((one) => {
        if (!one.includes('inset') || !one.includes(rule)) return;
        const [x, y, , spread = 0] = (one.replace(rule, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
        if (!x && !y && spread) Object.assign(s, { top: 1, bottom: 1, left: 1, right: 1 });
        if (x > 0) s.left = 1;
        if (x < 0) s.right = 1;
        if (y > 0) s.top = 1;
        if (y < 0) s.bottom = 1;
      });
      return s;
    };
    const sx = window.scrollX;
    const sy = window.scrollY;
    document.querySelectorAll(SCOPE).forEach((section) => {
      [section, ...section.querySelectorAll('*')].forEach((el) => {
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) return;
        const r = { left: b.left + sx, right: b.right + sx, top: b.top + sy, bottom: b.bottom + sy, width: b.width, height: b.height };
        const cs = getComputedStyle(el);
        const border = (side) => parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Color`] === rule;
        sides(r, { top: border('Top'), bottom: border('Bottom'), left: border('Left'), right: border('Right') });
        sides(r, shadowSides(cs.boxShadow));
        const after = getComputedStyle(el, '::after');
        if (after.content !== 'none') sides(r, shadowSides(after.boxShadow));
      });
    });

    layer.textContent = '';
    lines = [...segs.values()].map((seg) => {
      const line = document.createElement('i');
      line.className = seg.vertical ? 'is-v' : 'is-h';
      Object.assign(line.style, {
        left: `${seg.x}px`,
        top: `${seg.y}px`,
        [seg.vertical ? 'height' : 'width']: `${seg.len}px`,
      });
      layer.append(line);
      return { ...seg, el: line, drawn: -1 };
    });
    layer.style.height = `${document.documentElement.scrollHeight}px`;
    root.classList.add('grid-drawn');
    draw();
  }

  const clamp = (v) => Math.min(1, Math.max(0, v));
  function draw() {
    frame = 0;
    const h = window.innerHeight;
    // over the last screen of the page the front speeds up to the very bottom, so the lines at
    // the end of the page get drawn in full too
    const left = document.documentElement.scrollHeight - h - window.scrollY;
    const tail = clamp(1 - left / h);
    const front = window.scrollY + h * (FRONT + tail * (1 - FRONT)) + tail * SWEEP;
    lines.forEach((l) => {
      const p = l.vertical ? clamp((front - l.y) / l.len) : clamp((front - l.y) / SWEEP);
      if (Math.abs(p - l.drawn) < 0.001) return;
      l.drawn = p;
      l.el.style.transform = l.vertical ? `scaleY(${p.toFixed(4)})` : `scaleX(${p.toFixed(4)})`;
    });
  }

  let frame = 0;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  function start() {
    if (!wide.matches) {
      root.classList.remove('grid-drawn');
      layer.textContent = '';
      lines = [];
      return;
    }
    collect();
  }

  // the layout settles once fonts and images are in; re-measure whenever the page changes size
  let resizing = 0;
  const remeasure = () => {
    clearTimeout(resizing);
    resizing = setTimeout(start, 150);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', remeasure);
  wide.addEventListener('change', start);
  new ResizeObserver(remeasure).observe(document.body);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
  window.addEventListener('load', start);
})();
