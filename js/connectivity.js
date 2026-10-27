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
  const FILL = 0.6; // title fill after the stage sticks
  const STEP = 0.9; // each hand-over
  const HOLD = 0.3; // the last panel stays full before the section scrolls away
  const handovers = panels.length - 1;
  const travel = FILL + handovers * STEP + HOLD;

  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const ease = (t) => t * t * (3 - 2 * t); // smoothstep: settles at each panel

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
    return size;
  }

  let frame = 0;
  function update() {
    frame = 0;
    const vh = window.innerHeight;
    const top = section.getBoundingClientRect().top;
    const scrolled = -top / vh; // viewport heights past the moment the stage sticks

    // the title starts filling as the section rises into view and finishes once it has stuck
    title.style.setProperty('--fill', clamp((1 - top / vh) / (1 + FILL)));

    // position along the panel sequence: 0 = title, 1 = first image, …
    const s = clamp((scrolled - FILL) / STEP, 0, handovers);
    const i = Math.min(Math.floor(s), handovers - 1);
    const corner = 1 - ease(s - i); // shared corner along the diagonal, 1 = bottom-right

    panels.forEach((panel, k) => {
      if (k === i) place(panel, 0, corner);
      else if (k === i + 1) place(panel, corner, 1);
      else place(panel, 0, 0);
    });

    // the title shrinks with its panel instead of reflowing
    if (i === 0) title.style.setProperty('--title-scale', corner);
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
})();
