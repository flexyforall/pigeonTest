// Testimonials: the card shows one story at a time from <template id="quotes">; the arrows step
// through them. The story's words fade out and the next one rises in, as the hero's copy does.
(() => {
  const quote = document.querySelector('.quote');
  const tpl = document.getElementById('quotes');
  if (!quote || !tpl) return;

  const stories = [...tpl.content.children].map((el) => ({ ...el.dataset, text: el.textContent.trim() }));
  const slot = (name) => quote.querySelector(`[data-quote="${name}"]`);
  const fields = ['tag', 'aps', 'text', 'name', 'role'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

  let index = 0;
  let busy = false;

  function show(story) {
    fields.forEach((name) => (slot(name).textContent = story[name] || ''));
    const avatar = slot('avatar');
    if (story.avatar && avatar.getAttribute('src') !== story.avatar) avatar.src = story.avatar;
  }
  show(stories[0]);

  async function step(delta) {
    if (busy) return;
    busy = true;
    index = (index + delta + stories.length) % stories.length;
    const parts = [slot('text'), quote.querySelector('.quote__tags'), quote.querySelector('.quote__who'), slot('avatar')];
    if (!reduceMotion) {
      await Promise.all(parts.map((el) =>
        el.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(4px)' }], { duration: 250, easing: 'ease-in', fill: 'forwards' }).finished
      ));
    }
    show(stories[index]);
    parts.forEach((el, i) => {
      el.getAnimations().forEach((a) => a.cancel());
      if (!reduceMotion) {
        el.animate(
          [{ opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
          { duration: 700, delay: i * 60, easing: EASE_OUT, fill: 'backwards' }
        );
      }
    });
    busy = false;
  }

  quote.querySelectorAll('.quote__nav').forEach((btn) =>
    btn.addEventListener('click', () => step(Number(btn.dataset.step)))
  );
})();
