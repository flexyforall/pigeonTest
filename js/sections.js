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

    // Once the cards are well in view (on a clock of its own, not the scroll): the heading rises,
    // and as the mint block wipes in behind it a band of the "+" grid runs across the cards from
    // left to right, on the block's timing. The first card is
    // there from the start, the second and third come in behind the band as it passes. The grid
    // goes on with the band, so in the end it is left on the last card only.
    steps(section) {
      const RUN = 1800; // ms: the mint block's wipe and the band's run across the cards
      const DELAY = 350;
      const ease = 'cubic-bezier(0.65, 0, 0.35, 1)'; // the mint blocks' wipe everywhere
      const row = $('.steps__row', section);
      const band = $('.steps__sweep', section);
      const cards = $$('.step', section);

      // Everything here moves by transform, so it stays smooth while the rest of the page works:
      // the mint block scales in from its left edge, a white cover slides off the cards that are
      // still to come, and a card's grid clears through a sliding window.
      const cover = $('.steps__cover', section);
      const coverFrom = () => cards[1].offsetLeft;
      section.style.setProperty('--cover-from', `${coverFrom()}px`);

      // everything waits for the cards to be well in view, so the block and the band set off
      // together and keep pace
      section.classList.add('is-dim');
      section.classList.add('is-pending');
      new IntersectionObserver((entries, io) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        section.classList.remove('is-pending');
        rise($('.section-title', section));
        // same list of functions at both ends, so it scales rather than snapping
        $('.steps__mark', section).animate(
          [{ transform: 'translateX(-50%) scaleX(0)' }, { transform: 'translateX(-50%) scaleX(1)' }],
          { duration: RUN, delay: DELAY, easing: ease, fill: 'backwards' }
        );
        sweep();
      }, { threshold: 0.6 }).observe(row);

      function sweep() {
        const width = row.clientWidth;
        const bw = band.offsetWidth;
        const opts = { duration: RUN, delay: DELAY, easing: ease, fill: 'backwards' };
        // the band's leading edge goes from the row's left edge (progress 0) to its right edge (1)
        band.animate(
          [
            { transform: `translateX(${-bw}px)`, opacity: 1 },
            { opacity: 1, offset: 0.85 },
            { transform: `translateX(${width - bw}px)`, opacity: 0 },
          ],
          { ...opts, fill: 'both' }
        );
        // the cover holds until the edge reaches the second card, then goes with it: keyframe
        // offsets are in the band's progress, so between them it keeps exactly to the edge
        const x0 = coverFrom();
        cover.animate(
          [
            { transform: `translateX(${x0}px)`, offset: 0 },
            { transform: `translateX(${x0}px)`, offset: x0 / width },
            { transform: `translateX(${width}px)`, offset: 1 },
          ],
          { ...opts, fill: 'both' }
        ).finished.then(() => section.classList.remove('is-dim'));
        // the grid clears off every card but the last right behind the band's tail: a window over
        // it slides right while the grid inside slides back left by as much, so it stays put
        cards.slice(0, -1).forEach((card) => {
          const grid = $('.step__grid', card);
          const clip = document.createElement('span');
          clip.className = 'step__gridclip';
          grid.before(clip);
          clip.append(grid);
          const l = card.offsetLeft;
          const w = card.offsetWidth;
          const a = Math.min(1, (l + bw) / width);
          const b = Math.min(1, (l + w + bw) / width);
          const t = Math.min(w, width - bw - l); // how far it has cleared when the band is done
          const keys = (sign) => [
            { transform: 'none', offset: 0 },
            { transform: 'none', offset: a },
            { transform: `translateX(${sign * t}px)`, offset: b },
            { transform: `translateX(${sign * t}px)`, offset: 1 },
          ];
          clip.animate(keys(1), { ...opts, fill: 'forwards' });
          grid.animate(keys(-1), { ...opts, fill: 'forwards' });
        });
      }
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
