// Testimonials: the card shows one story at a time from <template id="quotes">; the arrows step
// through them. The story fades out and the next one comes in as the hero's copy does on a switch:
// the quote rises word by word, the rest fades up out of a blur.
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

  // the quote is split into words, so it can rise in word by word like the hero's headline
  function words(el, text) {
    el.textContent = '';
    el.setAttribute('aria-label', text);
    text.split(/\s+/).forEach((word, i) => {
      if (i) el.append(' ');
      const w = document.createElement('span');
      w.className = 'w';
      w.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'w__in';
      inner.textContent = word;
      w.append(inner);
      el.append(w);
    });
  }

  function show(story) {
    fields.forEach((name) => {
      if (name === 'text') words(slot(name), story.text);
      else slot(name).textContent = story[name] || '';
    });
    const avatar = slot('avatar');
    if (story.avatar && avatar.getAttribute('src') !== story.avatar) avatar.src = story.avatar;
  }
  show(stories[0]);

  // the hero's switch timing (js/hero.js SWITCH_TIMING)
  const T = { delay: 60, word: 800, stagger: 30, text: 120, fade: 700 };
  const from = (el, keyframe, opts) =>
    el.animate([keyframe, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { easing: EASE_OUT, fill: 'backwards', ...opts });

  async function step(delta) {
    if (busy) return;
    busy = true;
    index = (index + delta + stories.length) % stories.length;
    const text = slot('text');
    const rest = [quote.querySelector('.quote__tags'), quote.querySelector('.quote__who'), slot('avatar')];
    if (!reduceMotion) {
      await Promise.all([text, ...rest].map((el) =>
        el.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(4px)' }], { duration: 250, easing: 'ease-in', fill: 'forwards' }).finished
      ));
    }
    show(stories[index]);
    [text, ...rest].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    if (!reduceMotion) {
      // the words rise out of their lines, the rest fades up out of a blur just after
      text.querySelectorAll('.w__in').forEach((w, i) =>
        w.animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], {
          duration: T.word,
          delay: T.delay + i * T.stagger,
          easing: EASE_OUT,
          fill: 'backwards',
        })
      );
      rest.forEach((el, i) =>
        from(el, { opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' }, { duration: T.fade, delay: T.delay + T.text + i * 60 })
      );
    }
    busy = false;
  }

  quote.querySelectorAll('.quote__nav').forEach((btn) =>
    btn.addEventListener('click', () => step(Number(btn.dataset.step)))
  );
})();
