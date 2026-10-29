// "Good connections go beyond WiFi": the services as an accordion along a row. The open card
// takes the room the closed ones (80 wide each) leave; picking a closed one slides it open as the
// open one folds away (CSS transitions on .is-active).
(() => {
  const row = document.querySelector('.services__row');
  if (!row) return;
  const items = [...row.querySelectorAll('.svc')];
  const tabs = items.map((item) => item.querySelector('.svc__tab'));

  function open(item) {
    if (item.classList.contains('is-active')) return;
    items.forEach((it, i) => {
      const on = it === item;
      it.classList.toggle('is-active', on);
      tabs[i].setAttribute('aria-selected', String(on));
      tabs[i].tabIndex = on ? 0 : -1;
    });
  }

  tabs.forEach((tab, i) => tab.addEventListener('click', () => open(items[i])));

  // arrows move between services
  row.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const i = items.findIndex((it) => it.classList.contains('is-active'));
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = items[(i + step + items.length) % items.length];
    open(next);
    next.querySelector('.svc__tab').focus({ preventScroll: true });
    e.preventDefault();
  });
})();
