// The dark panels' "+" grid (assets/patterns/connectivity-grid.svg: the call to action, Figma
// 285:5210, and the connectivity title) is drawn on a canvas so it can answer the pointer: while
// it moves over the panel, the pluses around it lean in towards it, a little larger and brighter
// the nearer they are, and take on the hero's mint glow in a wide soft spot; they settle back
// when it leaves. The grid covers its box from the top left, as the <img> it replaces did
// (object-fit: cover; object-position: left top).
(() => {
  [
    // the CTA's grid keeps the design's cell size and grows to fill its box; the connectivity
    // title's covers its box, scaling with the panel as it grows
    ['.cta__pattern', '.cta__panel', 'tile'],
    ['.connectivity__pattern', '.connectivity__panel', 'cover'],
  ].forEach(([imgSel, areaSel, fit]) => {
    const img = document.querySelector(imgSel);
    const panel = img && img.closest(areaSel);
    if (panel) attach(img, panel, fit);
  });

function attach(img, panel, fit) {
  // the grid, in the pattern's 1388 × 979 design pixels
  const W = 1388;
  const H = 979;
  const COLS = 82;
  const ROWS = 58;
  const X0 = 4.99;
  const Y0 = 4.99;
  const DX = 17.0255;
  const DY = 17;
  const ARM = 4.99; // half the plus
  const BAR = 0.587; // its stroke
  const ALPHA = 0.1;
  const GLOW = 0.08; // how much brighter the pluses nearest the pointer get
  // the hero's mint glow (css/hero.css .hero__glow), on the pluses: they take its colour, and a
  // little more light, in a wide soft spot around the pointer
  const TINT = [160, 240, 212];
  const TINT_REACH = 190; // falloff of the tint (design px; ~the hero glow's 814px spot)
  const TINT_GLOW = 0.2;

  const REACH = 110; // falloff of the pull around the pointer (design px)
  const PULL = 0.14; // share of the way to the pointer a plus leans at most
  const FOLLOW = 0.14; // how quickly the pull's centre catches up with the pointer, per frame

  const canvas = document.createElement('canvas');
  canvas.className = img.className;
  canvas.setAttribute('aria-hidden', 'true');
  img.replaceWith(canvas);
  const ctx = canvas.getContext('2d');

  let scale = 1;
  let cols = COLS;
  let rows = ROWS;
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    // one design pixel (css/hero.css --px), or cover, from the top left
    scale = fit === 'tile' ? Math.min(1.25, Math.max(1, window.innerWidth / 1440)) : Math.max(w / W, h / H);
    cols = Math.max(COLS, Math.ceil(w / scale / DX) + 1);
    rows = Math.max(ROWS, Math.ceil(h / scale / DY) + 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    draw();
  }

  const target = { x: 0, y: 0, on: 0 };
  const cur = { x: 0, y: 0, on: 0 };

  function draw() {
    ctx.clearRect(0, 0, cols * DX + X0, rows * DY + Y0);
    const s2 = 2 * REACH * REACH;
    const t2 = 2 * TINT_REACH * TINT_REACH;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        let x = X0 + i * DX;
        let y = Y0 + j * DY;
        let f = 0;
        let g = 0;
        if (cur.on > 0.001) {
          const dx = cur.x - x;
          const dy = cur.y - y;
          const d2 = dx * dx + dy * dy;
          f = cur.on * Math.exp(-d2 / s2);
          g = cur.on * Math.exp(-d2 / t2);
          x += dx * PULL * f;
          y += dy * PULL * f;
        }
        const arm = ARM * (1 + 0.35 * f);
        const c = (i) => Math.round(255 + (TINT[i] - 255) * g);
        ctx.fillStyle = `rgba(${c(0)}, ${c(1)}, ${c(2)}, ${ALPHA + GLOW * f + TINT_GLOW * g})`;
        ctx.fillRect(x - arm, y - BAR / 2, arm * 2, BAR);
        ctx.fillRect(x - BAR / 2, y - arm, BAR, arm * 2);
      }
    }
  }

  let frame = 0;
  function tick() {
    frame = 0;
    cur.x += (target.x - cur.x) * FOLLOW;
    cur.y += (target.y - cur.y) * FOLLOW;
    cur.on += (target.on - cur.on) * 0.08;
    draw();
    const moving = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.1 || Math.abs(target.on - cur.on) > 0.002;
    if (moving) frame = requestAnimationFrame(tick);
    else if (!target.on) {
      cur.on = 0;
      draw();
    }
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    panel.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = canvas.getBoundingClientRect();
      target.x = (e.clientX - r.left) / scale;
      target.y = (e.clientY - r.top) / scale;
      if (!target.on) {
        // start the pull where the pointer comes in, rather than gliding over from the last spot
        if (cur.on < 0.01) {
          cur.x = target.x;
          cur.y = target.y;
        }
        target.on = 1;
      }
      schedule();
    });
    panel.addEventListener('pointerleave', () => {
      target.on = 0;
      schedule();
    });
  }

  new ResizeObserver(size).observe(canvas);
}
})();
