// Services ("Connectivity for every part of your life."): the list on the left picks a service.
// The picked one grows into a heading with its accent square; its description and link fade up
// out of a blur, and its picture comes in over the last one, settling from a touch larger.
(() => {
  const section = document.querySelector('.connect');
  if (!section) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const items = [...section.querySelectorAll('.connect__item')];
  const copies = [...section.querySelectorAll('.connect__copy')];
  const imgs = [...section.querySelectorAll('.connect__img')];
  const find = (list, key) => list.find((el) => el.dataset.connect === key);

  let current = items.find((item) => item.classList.contains('is-active'))?.dataset.connect;

  // the pictures load once the section is near, so a pick never waits on one
  new IntersectionObserver((entries, io) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    imgs.forEach((img) => {
      img.loading = 'eager';
      img.decode?.().catch(() => {});
    });
  }, { rootMargin: '600px 0px' }).observe(section);

  function pick(key) {
    if (key === current) return;
    const prevImg = find(imgs, current);
    const nextImg = find(imgs, key);
    const nextCopy = find(copies, key);
    current = key;

    items.forEach((item) => {
      const on = item.dataset.connect === key;
      item.classList.toggle('is-active', on);
      item.setAttribute('aria-selected', String(on));
    });
    copies.forEach((copy) => {
      const on = copy === nextCopy;
      copy.classList.toggle('is-active', on);
      if (on) copy.removeAttribute('aria-hidden');
      else copy.setAttribute('aria-hidden', 'true');
    });

    // the last picture stays underneath until the new one is in
    imgs.forEach((img) => {
      img.getAnimations().forEach((a) => a.cancel());
      img.style.zIndex = img === nextImg ? 2 : img === prevImg ? 1 : '';
      img.classList.toggle('is-active', img === nextImg);
    });
    if (reduceMotion) return;
    prevImg.style.opacity = 1;
    nextImg
      .animate([{ opacity: 0, transform: 'scale(1.04)' }, { opacity: 1, transform: 'none' }], { duration: 900, easing: EASE_OUT })
      .finished.then(() => {
        if (current === key) prevImg.style.opacity = '';
      }, () => {});
    [...nextCopy.children].forEach((el, i) =>
      el.animate(
        [{ opacity: 0, transform: 'translateY(12px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
        { duration: 700, delay: i * 80, easing: EASE_OUT, fill: 'backwards' }
      )
    );
  }

  items.forEach((item) => item.addEventListener('click', () => pick(item.dataset.connect)));
  // keyboard: arrows up and down the list
  section.querySelector('.connect__list').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
    next.focus();
    pick(next.dataset.connect);
  });
})();
