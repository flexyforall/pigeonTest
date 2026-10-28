// Sections below the hero reveal as they scroll into view, with the hero's motion language:
// headings rise word by word, copy fades up out of a blur, items follow in a short stagger.
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const $ = (sel, root) => root.querySelector(sel);
  const $$ = (sel, root) => [...root.querySelectorAll(sel)];

  // The element's current CSS values for the properties in `keyframe` (see hero.js)
  const cssState = (el, keyframe) => {
    const cs = getComputedStyle(el);
    return Object.fromEntries(
      Object.keys(keyframe).map((k) => [k, k === 'clipPath' && cs[k] === 'none' ? 'inset(0 0 0 0)' : cs[k]])
    );
  };
  // animates from the given state to the element's own CSS state and lets go afterwards
  const from = (el, keyframe, opts = {}) =>
    el.animate([keyframe, cssState(el, keyframe)], { fill: 'backwards', easing: EASE_OUT, ...opts });

  /* ---------- split headings into words ---------- */
  // Like the hero's splitter, but keeps inline elements (e.g. a dimmed <span>) around their words.
  function splitWords(title) {
    const label = title.textContent.replace(/\s+/g, ' ').trim();

    const split = (node, wrap) => {
      const frag = document.createDocumentFragment();
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          frag.append(split(child, (inner) => {
            const shell = child.cloneNode(false);
            shell.append(inner);
            return wrap(shell);
          }));
          return;
        }
        child.textContent.split(/(\s+)/).forEach((chunk) => {
          if (!chunk) return;
          if (/^\s+$/.test(chunk)) {
            frag.append(' ');
            return;
          }
          const w = document.createElement('span');
          w.className = 'w';
          const inner = document.createElement('span');
          inner.className = 'w__in';
          inner.append(wrap(document.createTextNode(chunk)));
          w.append(inner);
          frag.append(w);
        });
      });
      return frag;
    };

    const frag = split(title, (n) => n);
    title.textContent = '';
    title.append(frag);
    title.setAttribute('aria-label', label);
    [...title.children].forEach((el) => el.setAttribute('aria-hidden', 'true'));
  }

  const rise = (title, delay = 0, { word = 1000, stagger = 45 } = {}) =>
    $$('.w__in', title).forEach((w, i) =>
      from(w, { transform: 'translateY(105%)' }, { duration: word, delay: delay + i * stagger })
    );

  const fadeUp = (el, delay = 0, duration = 900) =>
    from(el, { opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' }, { duration, delay });

  /* ---------- reveals ---------- */
  const REVEALS = {
    logos(section) {
      $$('.logos__item', section).forEach((el, i) => fadeUp(el, i * 90, 1000));
    },

    benefits(section) {
      rise($('.section-title', section));
      // the mint block wipes in behind "for business." as those words land
      from($('.benefits__mark', section), { clipPath: 'inset(0 100% 0 0)' }, {
        duration: 900,
        delay: 350,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
      });

      $$('.benefit', section).forEach((card, i) => {
        const d = 300 + i * 120;
        $$('.benefit__grid, .benefit__fade', card).forEach((el) =>
          from(el, { opacity: 0 }, { duration: 1400, delay: d })
        );
        from($('.benefit__icon', card), { opacity: 0, transform: 'translateY(10px)' }, { duration: 900, delay: d + 100 });
        rise($('.benefit__title', card), d + 200, { word: 900, stagger: 40 });
        fadeUp($('.benefit__desc', card), d + 400);
      });
    },

    // same reveal as the benefits: the heading rises, the mint block wipes in, then the tabs
    // come in one after another like the benefit cards
    plans(section) {
      rise($('.section-title', section));
      from($('.plans__mark', section), { clipPath: 'inset(0 100% 0 0)' }, {
        duration: 900,
        delay: 350,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
      });

      // the block behind the active tab comes in ahead of the tab text
      from($('.plans__indicator', section), { opacity: 0 }, { duration: 600, delay: 100 });
      $$('.plan-tab', section).forEach((tab, i) => {
        const d = 300 + i * 120;
        rise($('.plan-tab__name', tab), d + 200, { word: 900, stagger: 40 });
        fadeUp($('.plan-tab__aps', tab), d + 400);
      });
    },

    // heading and mint block as everywhere else; then the "+" grid runs across the three cards
    // from left to right, on a clock of its own once the cards are in view, and lights each card
    // up as it passes: the grey copy turns dark, and the grid stays on the last card
    steps(section) {
      rise($('.section-title', section));
      from($('.steps__mark', section), { clipPath: 'inset(0 100% 0 0)' }, {
        duration: 900,
        delay: 350,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
      });

      const STEP = 650; // ms the grid takes across one card
      const START = 200;
      const ease = 'cubic-bezier(0.45, 0, 0.55, 1)';
      const cards = $$('.step', section);
      // the cards wait, grey and without their grid, until they are well in view themselves
      section.classList.add('is-dim');
      new IntersectionObserver((entries, io) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        section.classList.remove('is-dim');
        sweep();
      }, { threshold: 0.6 }).observe($('.steps__row', section));

      const sweep = () => cards.forEach((card, i) => {
        const grid = $('.step__grid', card);
        const w = card.offsetWidth;
        const right = grid.offsetWidth - w; // the grid runs on past the card's right edge
        const t0 = START + i * STEP;
        // in from the left edge to the right edge…
        grid.animate([{ clipPath: `inset(0 ${grid.offsetWidth}px 0 0)` }, { clipPath: `inset(0 ${right}px 0 0)` }], {
          duration: STEP,
          delay: t0,
          easing: ease,
          fill: i === cards.length - 1 ? 'backwards' : 'both',
        });
        // …and, but on the last card, out the same way as it moves on to the next
        if (i < cards.length - 1) {
          grid.animate([{ clipPath: `inset(0 ${right}px 0 0)` }, { clipPath: `inset(0 ${right}px 0 ${w}px)` }], {
            duration: STEP,
            delay: t0 + STEP,
            easing: ease,
            fill: 'forwards',
          });
        }
        $$('.step__num, .step__text', card).forEach((el) =>
          from(el, { opacity: 0.35 }, { duration: 700, delay: t0 + STEP * 0.4, easing: ease })
        );
      });
    },
  };

  const sections = Object.keys(REVEALS)
    .map((name) => [name, document.querySelector(`.${name}`)])
    .filter(([, el]) => el);

  // split once fonts are in, so word boxes are measured with the real face
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

  sections.forEach(([, section]) => {
    section.classList.add('is-pending');
    $$('.section-title, .benefit__title, .plan-tab__name', section).forEach(splitWords);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const [name, section] = sections.find(([, s]) => s === entry.target);
        fontsReady.then(() => {
          // drop the hidden state first so `from` reads the real end values
          section.classList.remove('is-pending');
          REVEALS[name](section);
        });
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 }
  );
  sections.forEach(([, section]) => observer.observe(section));
})();
