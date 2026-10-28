// "Coverage starts with your space": the space-type tabs. Only the Small Office plan is drawn so
// far, so a tab switches the selection and the heading; the plan and copy stay as they are.
(() => {
  const section = document.querySelector('.plans');
  if (!section) return;

  const tabs = [...section.querySelectorAll('.plan-tab')];
  const title = section.querySelector('.plans__title');

  function select(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    title.textContent = tab.querySelector('.plan-tab__name').textContent;
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
