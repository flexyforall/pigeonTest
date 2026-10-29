// FAQ: one answer open at a time; the open one opens out below its question (css/sections.css).
(() => {
  const items = [...document.querySelectorAll('.faq__item')];
  if (!items.length) return;

  const set = (item, open) => {
    item.classList.toggle('is-open', open);
    item.querySelector('button').setAttribute('aria-expanded', String(open));
  };

  items.forEach((item) =>
    item.querySelector('button').addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      items.forEach((other) => set(other, other === item && open));
    })
  );
})();
