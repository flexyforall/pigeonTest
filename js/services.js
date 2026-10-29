// "Good connections go beyond WiFi": the services as an accordion along a row. The open card
// takes the room the closed ones (80 wide each) leave; picking a closed one slides it open as the
// open one folds away (CSS transitions on .is-active).
(() => {
  const row = document.querySelector('.services__row');
  if (!row) return;
  const items = [...row.querySelectorAll('.svc')];
  const tabs = items.map((item) => item.querySelector('.svc__tab'));

  /* ---------- copy, coming in as the hero copy does on a switch ---------- */
  // the hero's SWITCH_TIMING, waiting until the card has slid most of the way open (0.9s, see the CSS)
  const T = { delay: 500, word: 800, stagger: 30, text: 120, button: 200, items: 260, fade: 700 };
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // titles into words (keeping their line breaks), each in a clip to rise out of
  row.querySelectorAll('.svc__title').forEach((title) => {
    const label = title.textContent.replace(/\s+/g, ' ').trim();
    const frag = document.createDocumentFragment();
    title.childNodes.forEach((node) => {
      if (node.nodeName === 'BR') return frag.append(document.createElement('br'));
      node.textContent.split(/(\s+)/).forEach((chunk) => {
        if (!chunk) return;
        if (/^\s+$/.test(chunk)) return frag.append(' ');
        const w = document.createElement('span');
        w.className = 'w';
        const inner = document.createElement('span');
        inner.className = 'w__in';
        inner.textContent = chunk;
        w.append(inner);
        frag.append(w);
      });
    });
    title.textContent = '';
    title.append(frag);
    title.setAttribute('aria-label', label);
    [...title.children].forEach((el) => el.setAttribute('aria-hidden', 'true'));
  });

  // animates from the given state to the element's own CSS state (see hero.js)
  const from = (el, keyframe, opts) => {
    const cs = getComputedStyle(el);
    const end = Object.fromEntries(
      Object.keys(keyframe).map((k) => [k, k === 'clipPath' && cs[k] === 'none' ? 'inset(0 0 0 0)' : cs[k]])
    );
    return el.animate([keyframe, end], { fill: 'backwards', easing: EASE_OUT, ...opts });
  };

  function enter(item) {
    const card = item.querySelector('.svc__card');
    const d = T.delay;
    const fadeUp = { opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' };
    from(card.querySelector('.svc__label'), { opacity: 0, transform: 'translateY(10px)' }, { duration: T.fade, delay: d });
    card.querySelectorAll('.svc__title .w__in').forEach((w, i) =>
      from(w, { transform: 'translateY(105%)' }, { duration: T.word, delay: d + i * T.stagger })
    );
    from(card.querySelector('.svc__desc'), fadeUp, { duration: T.fade, delay: d + T.text });
    from(card.querySelector('.btn'), { opacity: 0, transform: 'translateY(16px)', clipPath: 'inset(100% 0 0 0)' }, {
      duration: T.fade,
      delay: d + T.button,
    });
    card.querySelectorAll('.svc__items li').forEach((li, i) =>
      from(li, { opacity: 0, transform: 'translateY(10px)' }, { duration: T.fade, delay: d + T.items + i * 60 })
    );
  }

  function open(item) {
    if (item.classList.contains('is-active')) return;
    items.forEach((it, i) => {
      const on = it === item;
      it.classList.toggle('is-active', on);
      tabs[i].setAttribute('aria-selected', String(on));
      tabs[i].tabIndex = on ? 0 : -1;
    });
    if (!reduceMotion) enter(item);
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
