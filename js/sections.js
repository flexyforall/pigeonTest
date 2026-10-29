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
        if (child.nodeName === 'BR') {
          frag.append(document.createElement('br'));
          return;
        }
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

  // counts a figure up from zero to what it reads ("2,450", "100%", "12 min"), keeping its
  // thousands commas and whatever follows the number
  function countUp(el, delay = 0, duration = 1600) {
    const m = el.textContent.match(/^([^\d]*)([\d,]+)(.*)$/);
    if (!m) return;
    const [, before, digits, after] = m;
    const target = Number(digits.replace(/,/g, ''));
    const commas = digits.includes(',');
    const show = (n) => {
      const v = Math.round(n);
      el.textContent = before + (commas ? v.toLocaleString('en-US') : String(v)) + after;
    };
    show(0);
    const start = performance.now() + delay;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      show(target * ease(t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

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
      const WIPE = 1300; // ms: the mint block's wipe (slow enough for the band to be seen)
      const RUN = WIPE; // ms: the band's run across the cards, in step with the block
      const DELAY = 150;
      const ease = 'cubic-bezier(0.45, 0, 0.2, 1)'; // soft at both ends
      const row = $('.steps__row', section);
      const band = $('.steps__sweep', section);
      const cards = $$('.step', section);

      // everything waits for the cards to be well in view, so the block and the band set off
      // together and keep pace
      section.classList.add('is-dim');
      section.classList.add('is-pending');
      new IntersectionObserver((entries, io) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        section.classList.remove('is-dim', 'is-pending');
        rise($('.section-title', section));
        from($('.steps__mark', section), { clipPath: 'inset(0 100% 0 0)' }, { duration: WIPE, delay: DELAY, easing: ease });
        sweep();
      }, { threshold: 0.25 }).observe(row);

      function sweep() {
        const width = row.clientWidth;
        const bw = band.offsetWidth;
        const opts = { duration: RUN, delay: DELAY, easing: ease, fill: 'backwards' };
        // the band's leading edge goes from the row's left edge to its right edge
        band.animate(
          [
            // it fades in as it sets off, so it doesn't just appear at the left edge
            { transform: `translateX(${-bw}px)`, opacity: 0 },
            { opacity: 1, offset: 0.2 },
            { opacity: 1, offset: 0.85 },
            { transform: `translateX(${width - bw}px)`, opacity: 0 },
          ],
          { ...opts, fill: 'both' }
        );
        // every card but the first fades in as the band crosses it, and the grid fades off every
        // card but the last right behind the band (keyframe offsets are in the band's progress)
        cards.slice(1).forEach((card) => {
          const a = card.offsetLeft / width;
          const b = Math.min(1, (card.offsetLeft + card.offsetWidth * 0.8) / width);
          card.animate(
            [
              { opacity: 0, offset: 0 },
              { opacity: 0, offset: a },
              { opacity: 1, offset: b, easing: 'ease-out' },
              { opacity: 1, offset: 1 },
            ],
            opts
          );
        });
        const lag = bw / width;
        cards.slice(0, -1).forEach((card) => {
          const grid = $('.step__grid', card);
          const a = Math.min(1, card.offsetLeft / width + lag * 0.5);
          const b = Math.min(1, (card.offsetLeft + card.offsetWidth) / width + lag);
          grid.animate(
            [
              { opacity: 1, offset: 0 },
              { opacity: 1, offset: a },
              { opacity: 0, offset: b },
              { opacity: 0, offset: 1 },
            ],
            { ...opts, fill: 'forwards' }
          );
        });
      }
    },

    // heading and mint block as in the other sections, then the open card fades up
    services(section) {
      rise($('.section-title', section));
      from($('.services__mark', section), { clipPath: 'inset(0 100% 0 0)' }, {
        duration: 900,
        delay: 350,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
      });
      fadeUp($('.services__row', section), 400, 1000);
    },

    // the globe fades in, the copy rises beside it, the figures follow one after another
    network(section) {
      from($('.network__media', section), { opacity: 0 }, { duration: 1400 });
      fadeUp($('.network__texts', section), 200);
      // the figures wait for their own row to be well in view, so their count is seen
      const stats = $('.network__stats', section);
      stats.classList.add('is-waiting');
      new IntersectionObserver((entries, io) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        stats.classList.remove('is-waiting');
        $$('.stat', section).forEach((el, i) => {
          fadeUp(el, i * 100);
          countUp($('.stat__value', el), i * 100);
        });
      }, { threshold: 0.7 }).observe(stats);
    },

    // the dark panel's copy rises like the other headings, then the record and the cards follow
    solana(section) {
      rise($('.section-title', section));
      fadeUp($('.solana__desc', section), 300);
      fadeUp($('.solana__link', section), 400);
      fadeUp($('.solana__record', section), 550, 1000);
      // the cards below the dark panel come in as the benefit cards do, once their own row is in view
      const row = $('.solana__row', section);
      row.classList.add('is-waiting');
      new IntersectionObserver((entries, io) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        row.classList.remove('is-waiting');
        benefitCards(row);
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.5 }).observe(row);
    },

    // heading and mint block, then the mission, the figures (counting up) and the logos
    about(section) {
      heading(section, '.about__mark');
      $$('.about__mission > *', section).forEach((el, i) => fadeUp(el, 300 + i * 150, 1000));
      $$('.about__stat', section).forEach((stat, i) => {
        const d = 400 + i * 120;
        fadeUp($('.about__value', stat), d);
        countUp($('.about__value', stat), d);
        fadeUp($('.about__texts', stat), d + 100);
      });
      // the logos come in as the logos row after the hero does, once their own row is in view
      const logos = $('.about__logos', section);
      logos.classList.add('is-waiting');
      new IntersectionObserver((entries, io) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        logos.classList.remove('is-waiting');
        $$('li', logos).forEach((el, i) => fadeUp(el, i * 90, 1000));
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.5 }).observe(logos);
    },

    testimonials(section) {
      heading(section, '.testimonials__mark');
      fadeUp($('.quote', section), 400, 1000);
    },

    faq(section) {
      heading(section, '.faq__mark');
      $$('.faq__item', section).forEach((el, i) => fadeUp(el, 300 + i * 60));
    },

    cta(section) {
      from($('.cta__icon', section), { opacity: 0, transform: 'translateY(10px)' }, { duration: 900 });
      rise($('.section-title', section), 150);
      fadeUp($('.cta__desc', section), 450);
      from($('.cta__btn', section), { opacity: 0, transform: 'translateY(16px)', clipPath: 'inset(100% 0 0 0)' }, { duration: 900, delay: 600 });
      $$('.cta__stat', section).forEach((el, i) => fadeUp(el, 500 + i * 100));
    },
  };

  // benefit-style cards: grid and fade come in, then the icon, the title rising, the line below
  function benefitCards(root, delay = 0) {
    $$('.benefit', root).forEach((card, i) => {
      const d = delay + i * 120;
      $$('.benefit__grid, .benefit__fade', card).forEach((el) =>
        from(el, { opacity: 0 }, { duration: 1400, delay: d })
      );
      from($('.benefit__icon', card), { opacity: 0, transform: 'translateY(10px)' }, { duration: 900, delay: d + 100 });
      rise($('.benefit__title', card), d + 200, { word: 900, stagger: 40 });
      fadeUp($('.benefit__desc', card), d + 400);
    });
  }

  // the heading rises word by word while its mint block wipes in behind the last words
  function heading(section, mark) {
    rise($('.section-title', section));
    from($(mark, section), { clipPath: 'inset(0 100% 0 0)' }, {
      duration: 900,
      delay: 350,
      easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    });
  }

  /* ---------- the network globe ---------- */
  // It turns slowly (the clip is slowed down, with in-between frames, when made), and only while it's on screen.
  const globe = document.querySelector('.network__media video');
  if (globe) {
    const rate = Number(globe.dataset.rate) || 1;
    globe.defaultPlaybackRate = rate;
    globe.playbackRate = rate;
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        globe.playbackRate = rate;
        globe.play().catch(() => {});
      } else globe.pause();
    }, { rootMargin: '200px 0px' }).observe(globe);
  }

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
