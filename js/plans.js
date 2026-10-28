// "Coverage starts with your space": the space-type tabs. Each tab shows its own panel; the
// incoming copy rises in and its floor plan fades in, the way the hero copy comes in.
(() => {
  const section = document.querySelector('.plans');
  if (!section) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const tabs = [...section.querySelectorAll('.plan-tab')];
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));

  function select(tab) {
    if (tab.classList.contains('is-active')) return;
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panelOf(t).hidden = !on;
    });
    if (reduceMotion) return;

    const panel = panelOf(tab);
    const info = panel.querySelector('.plans__info');
    [...info.querySelector('.plans__texts').children, info.querySelector('.btn')].forEach((el, i) =>
      el.animate([{ opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], {
        duration: 700,
        delay: i * 70,
        easing: EASE_OUT,
        fill: 'backwards',
      })
    );
    panel.querySelector('.plans__plan').animate(
      [{ opacity: 0, transform: 'scale(0.98)' }, { opacity: 1, transform: 'none' }],
      { duration: 800, easing: EASE_OUT }
    );
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
