// "Connectivity without boundaries" — a scroll-driven sequence (Figma storyboard 228:3913).
// The stage sticks while the section scrolls past. First the title fills in white, then each
// panel hands over to the next along the box diagonal: the shared corner travels from the
// bottom-right to the top-left, so the current panel shrinks into the top-left corner while the
// next one grows out of the bottom-right. Both keep the box's proportions all the way.
(() => {
  const section = document.querySelector('[data-connectivity]');
  if (!section) return;

  const box = section.querySelector('.connectivity__box');
  const panels = [...section.querySelectorAll('.connectivity__panel')];
  const title = section.querySelector('.connectivity__title');

  // scroll lengths in viewport heights
  const FILL = 1; // title fill, once the stage has stuck
  const STEP = 1.2; // each hand-over
  const HOLD = 0.3; // the last panel stays full before the section scrolls away
  const handovers = panels.length - 1;
  const travel = FILL + handovers * STEP + HOLD;

  // The drawn state chases the scroll position instead of jumping with it, so wheel steps
  // and trackpad flicks glide. SMOOTH is the time constant of that chase, in ms.
  const SMOOTH = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140;

  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  // half linear, half smoothstep: eases into each panel without rushing through the middle
  const ease = (t) => 0.5 * t + 0.5 * t * t * (3 - 2 * t);

  section.classList.add('is-scrolling');
  section.style.setProperty('--track', `${(1 + travel) * 100}vh`);

  // Lays a panel out as the diagonal slice from `a` to `b` (fractions of the box diagonal).
  function place(panel, a, b) {
    const size = b - a;
    panel.style.visibility = size > 0.001 ? 'visible' : 'hidden';
    if (size <= 0.001) return;
    panel.style.left = `${a * 100}%`;
    panel.style.top = `${a * 100}%`;
    panel.style.width = `${size * 100}%`;
    panel.style.height = `${size * 100}%`;
    // corners would clump together on a sliver of a panel
    panel.style.setProperty('--corner-opacity', clamp((size * box.offsetWidth - 20) / 60));
  }

  // where the scroll position says we should be
  function target() {
    const scrolled = -section.getBoundingClientRect().top / window.innerHeight; // past the moment the stage sticks
    return {
      // the fill starts just before the stage sticks, so it plays out in full view
      fill: clamp((scrolled + 0.15) / (FILL + 0.15)),
      // position along the panel sequence: 0 = title, 1 = first image, …
      seq: clamp((scrolled - FILL) / STEP, 0, handovers),
    };
  }

  function draw({ fill, seq }) {
    title.style.setProperty('--fill', fill);

    const i = Math.min(Math.floor(seq), handovers - 1);
    const corner = 1 - ease(seq - i); // shared corner along the diagonal, 1 = bottom-right
    panels.forEach((panel, k) => {
      if (k === i) place(panel, 0, corner);
      else if (k === i + 1) place(panel, corner, 1);
      else place(panel, 0, 0);
    });

    // the title shrinks with its panel instead of reflowing
    if (i === 0) title.style.setProperty('--title-scale', corner);
  }

  let state = target();
  let frame = 0;
  let last = 0;

  function tick(now) {
    const goal = target();
    const dt = last ? now - last : 16;
    const k = SMOOTH ? 1 - Math.exp(-dt / SMOOTH) : 1;
    state = {
      fill: state.fill + (goal.fill - state.fill) * k,
      seq: state.seq + (goal.seq - state.seq) * k,
    };
    const settled = Math.abs(goal.fill - state.fill) < 0.001 && Math.abs(goal.seq - state.seq) < 0.001;
    if (settled) state = goal;
    draw(state);
    last = settled ? 0 : now;
    frame = settled ? 0 : requestAnimationFrame(tick);
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  draw(state);
})();
