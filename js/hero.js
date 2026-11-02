(() => {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const EASE_IN = 'cubic-bezier(0.55, 0, 0.75, 0.2)';

  // the page stays put (html.is-locked, set in the head) until the hero has drawn itself in
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  const unlock = () => document.documentElement.classList.remove('is-locked');
  setTimeout(unlock, 15000); // whatever happens, never for good

  const $ = (sel, root = hero) => root.querySelector(sel);
  const $$ = (sel, root = hero) => [...root.querySelectorAll(sel)];

  const cards = $$('.card');
  const planet = $('.hero__planet-video');

  // The element's current CSS values for the properties in `keyframe`.
  // Explicit keyframes are needed: Chrome ignores backwards fill on implicit ones during the delay.
  const cssState = (el, keyframe, pseudoElement) => {
    const cs = getComputedStyle(el, pseudoElement);
    return Object.fromEntries(
      // `none` doesn't interpolate with inset(), so spell out the unclipped box
      Object.keys(keyframe).map((k) => [k, k === 'clipPath' && cs[k] === 'none' ? 'inset(0 0 0 0)' : cs[k]])
    );
  };
  // `from` animates from the given state to the element's own CSS state and lets go afterwards
  const from = (el, keyframe, opts = {}) =>
    el.animate([keyframe, cssState(el, keyframe, opts.pseudoElement)], {
      fill: 'backwards',
      easing: EASE_OUT,
      ...opts,
    });
  /* ---------- dots icon ---------- */
  const dotsTpl = document.getElementById('dots-icon');
  $$('.card__icon').forEach((slot) => slot.append(dotsTpl.content.cloneNode(true)));

  // On hover the 17 dots regroup into a symbol for the audience; on leave they fly back.
  // Points are dot centres in the icon's 50×50 box; every dot becomes a 3px square.
  const wifiArc = (r, angles) =>
    angles.map((a) => [25 + r * Math.cos((a * Math.PI) / 180), 41 + r * Math.sin((a * Math.PI) / 180)]);
  const SYMBOLS = {
    // business centre: a tall two-column tower between lower wings
    business: [
      ...[6, 12.5, 19, 25.5, 32, 38.5].flatMap((y) => [21.75, 28.25].map((x) => [x, y])),
      [12, 25.5], [12, 32], [12, 38.5],
      [38, 32], [38, 38.5],
    ],
    // house: pitched roof, walls, two windows, door, ground line
    residential: [
      [25, 6], [17.5, 13], [32.5, 13], [10, 20], [40, 20],
      [12, 27], [12, 34], [12, 41], [38, 27], [38, 34], [38, 41],
      [19, 28], [31, 28], [25, 35], [25, 41], [18.5, 41], [31.5, 41],
    ],
    // WiFi signal: a source dot under three arcs
    mobile: [
      [25, 41], [25, 41],
      ...wifiArc(9, [-125, -90, -55]),
      ...wifiArc(17, [-135, -112, -90, -68, -45]),
      ...wifiArc(25, [-135, -120, -105, -90, -75, -60, -45]),
    ],
  };
  const DOT = 3;
  const byPosition = (a, b) => a[1] - b[1] || a[0] - b[0];

  cards.forEach((card) => {
    const symbol = SYMBOLS[card.dataset.target];
    if (!symbol) return;
    const rects = $$('rect', card);
    const dots = rects
      .map((rect) => {
        const x = +rect.getAttribute('x');
        const y = +rect.getAttribute('y');
        const w = +rect.getAttribute('width');
        return { rect, cx: x + w / 2, cy: y + w / 2, w };
      })
      .sort((a, b) => byPosition([a.cx, a.cy], [b.cx, b.cy]));
    const targets = [...symbol].sort(byPosition);

    // one animation per dot, played forwards on enter and backwards on leave
    const morphs = dots.map(({ rect, cx, cy, w }, i) => {
      const [tx, ty] = targets[i];
      const anim = rect.animate(
        [
          { transform: 'translate(0, 0) scale(1)' },
          { transform: `translate(${tx - cx}px, ${ty - cy}px) scale(${DOT / w})` },
        ],
        { duration: 520 + i * 12, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'both' }
      );
      anim.pause();
      return anim;
    });

    const play = (rate) => {
      morphs.forEach((m) => {
        m.playbackRate = rate;
        m.play();
      });
      return Promise.all(morphs.map((m) => m.finished));
    };

    // At rest the dots shimmer: each one fades in and out on its own rhythm and phase,
    // so the icon is always gently alive and the cards read as interactive.
    // The shimmer pauses while the symbol shows.
    let idle = [];
    let hovered = false;

    const startIdle = () => {
      idle = dots.map(({ rect }) =>
        rect.animate([{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }], {
          duration: 900 + Math.random() * 900,
          delay: -Math.random() * 1800, // start mid-cycle so dots are out of step
          iterations: Infinity,
          easing: 'ease-in-out',
        })
      );
    };
    const stopIdle = () => {
      idle.forEach((anim, i) => {
        const { rect } = dots[i];
        const now = getComputedStyle(rect).opacity;
        anim.cancel();
        rect.animate([{ opacity: now }, { opacity: 1 }], { duration: 250, easing: 'ease-out' });
      });
      idle = [];
    };

    if (reduceMotion) return;
    startIdle();
    card.addEventListener('mouseenter', () => {
      hovered = true;
      stopIdle();
      play(1);
    });
    card.addEventListener('mouseleave', () => {
      hovered = false;
      play(-1).then(() => {
        if (!hovered && !idle.length) startIdle();
      });
    });
  });

  /* ---------- split headings into words ---------- */
  function splitTitle(title) {
    const label = title.textContent.replace(/\s+/g, ' ').trim();
    const frag = document.createDocumentFragment();

    title.childNodes.forEach((node) => {
      if (node.nodeName === 'BR') {
        frag.append(document.createElement('br'));
        return;
      }
      node.textContent.split(/(\s+)/).forEach((chunk) => {
        if (!chunk) return;
        if (/^\s+$/.test(chunk)) {
          frag.append(' ');
          return;
        }
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
  }
  $$('[data-split]').forEach(splitTitle);

  /* ---------- panel enter ---------- */
  const INTRO_TIMING = { word: 1000, stagger: 45, text: 250, button: 380, fade: 900 };

  function enterPanel(panel, delay = 0, t = INTRO_TIMING) {
    const words = $$('.w__in', panel);
    const text = $('.panel__text', panel);
    const btn = $('.btn', panel);

    words.forEach((w, i) =>
      from(w, { transform: 'translateY(105%)' }, { duration: t.word, delay: delay + i * t.stagger })
    );

    from(text, { opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' }, {
      duration: t.fade,
      delay: delay + t.text,
    });

    return from(btn, { opacity: 0, transform: 'translateY(16px)', clipPath: 'inset(100% 0 0 0)' }, {
      duration: t.fade,
      delay: delay + t.button,
    }).finished;
  }

  const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* ---------- the planet ---------- */
  // The copy moves up on a screen lower than the design's (css .hero__content: sizes follow the
  // width, the hero the height), so the planet follows it by as much, keeping the copy at the
  // foot of its dome: lifted up to LIFT (so the dome's top stays clear of the header), then made
  // smaller about its top for the rest.
  const LIFT = 60;
  const fitBox = $('.hero__fit');
  function fitGlobe() {
    if (!fitBox) return;
    const k = Math.min(1.25, Math.max(1, window.innerWidth / 1440)); // --px
    const short = Math.max(0, 810 * k - hero.clientHeight);
    const lift = Math.min(short, LIFT * k);
    const scale = Math.max(0.7, 1 - (short - lift) / (280 * k));
    fitBox.style.setProperty('--globe-lift', `${lift.toFixed(1)}px`);
    fitBox.style.setProperty('--globe-scale', scale.toFixed(4));
  }
  fitGlobe();
  window.addEventListener('resize', fitGlobe);

  // it turns slowly and for good: the clip is a seamless loop, played below its own speed
  if (planet) {
    const rate = Number(planet.dataset.rate) || 1;
    planet.defaultPlaybackRate = rate;
    planet.playbackRate = rate;
    if (reduceMotion) planet.removeAttribute('autoplay');
    else planet.play().catch(() => {});
    // it only turns while the hero is on screen
    new IntersectionObserver(([entry]) => {
      if (reduceMotion) return;
      if (entry.isIntersecting) planet.play().catch(() => {});
      else planet.pause();
    }).observe(hero);
  }

  /* ---------- intro ---------- */
  let fromLoader = false; // the planet is already on show, having come over from the loader

  function intro() {
    hero.classList.add('is-ready');

    if (reduceMotion) {
      unlock();
      return;
    }
    // the last of it, the cards, are in by then
    setTimeout(unlock, 2200);

    if (!fromLoader) from($('.hero__planet'), { opacity: 0, transform: 'scale(1.08)' }, { duration: 2200 });

    // frame and hairlines draw in
    from($('.hero__frame'), { clipPath: 'inset(0 50% 0 50%)' }, {
      pseudoElement: '::before',
      duration: 1400,
      delay: 100,
      easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    });
    from($('.header'), { transform: 'scaleX(0)' }, { pseudoElement: '::after', duration: 1400, delay: 200 });
    from($('.cards'), { transform: 'scaleX(0)' }, { pseudoElement: '::before', duration: 1400, delay: 400 });

    // header items
    $$('[data-intro="header"]').forEach((el, i) =>
      from(el, { opacity: 0, transform: 'translateY(-14px)' }, { duration: 900, delay: 500 + i * 60 })
    );

    // rating
    from($('[data-intro="rating"]'), { opacity: 0, transform: 'translateY(12px)' }, { duration: 900, delay: 650 });

    // headline, text, button
    enterPanel($('.panel'), 750);

    // cards
    $$('[data-intro="card"]').forEach((el, i) =>
      from(el, { opacity: 0, transform: 'translateY(40px)' }, { duration: 1100, delay: 900 + i * 110 })
    );
  }

  /* ---------- loader ---------- */
  // The hero's planet turns in the middle of the screen until the page is ready (and for SPIN at
  // least): the hero's backdrop is lifted over the loader for it (.is-loading) and its globe set
  // in the loader's pose. Then the globe glides up into its place as the loader clears off and the
  // hero draws itself in, so the one runs into the other with no pause and no second planet.
  const loader = document.querySelector('.loader');
  const SPIN = 1400;
  const LOGO_FADE = 600;
  const FADE = 700; // the loader's own fade, over the hero's start
  const GLIDE = 1600; // the planet's way up into the hero
  const LOADER_SCALE = 0.8;
  const globe = $('.hero__globe');
  const GRID_END = 2000; // from the hand-over to the grid's full reveal, with the hero's intro

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  // the planet's first frame, so it is there to be seen as the hero comes in
  const planetReady = !planet || planet.readyState >= 2
    ? Promise.resolve()
    : new Promise((resolve) => {
        planet.addEventListener('loadeddata', resolve, { once: true });
        planet.addEventListener('error', resolve, { once: true });
      });
  // wait for fonts so the split text is measured correctly
  const ready = Promise.race([Promise.all([fontsReady, planetReady]), timeout(6000)]);

  const removeLoader = () => {
    loader?.remove();
    hero.classList.remove('is-loading');
  };

  // the loader's pose: the planet's visible dome (from the globe's top to where it fades under the
  // shade; its middle is about 42% down the frame) centred on the screen, a little smaller
  function loaderPose() {
    globe.style.transform = 'none'; // measured in its own place
    const box = globe.getBoundingClientRect();
    const frame = $('.hero__planet').getBoundingClientRect();
    const x = frame.left + frame.width / 2 - box.left;
    const y = frame.top + frame.height * 0.42 - box.top;
    const dx = window.innerWidth / 2 - (box.left + x);
    const dy = window.innerHeight / 2 - (box.top + y);
    globe.style.transformOrigin = `${x}px ${y}px`;
    return `translate(${dx}px, ${dy}px) scale(${LOADER_SCALE})`;
  }
  if (loader && globe && !reduceMotion) {
    hero.classList.add('is-loading');
    fromLoader = true;
    globe.style.transform = loaderPose();
    // it comes in softly once its first frame is there
    globe.style.opacity = 0;
    planetReady.then(() => {
      globe.style.opacity = '';
      globe.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 800, easing: 'ease-out' });
    });
  }

  // The grid's reveal runs the whole length of the loader and completes as it ends. How long the
  // loader lasts is only known once the page is ready, so until then the reveal eases towards
  // HOLD of the way, slowly enough never to get there; once the end is known it runs on from
  // wherever it is to the full reveal, landing as the loader goes.
  const grid = loader?.querySelector('.loader__grid');
  const HOLD = 0.8;
  const reveal = { from: 0, to: HOLD, start: performance.now(), duration: SPIN * 1.6, p: 0 };
  // a gentle start while it waits, an ease out on the run to the end
  const easeInOut = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - Math.pow(1 - t, 2);
  // the hero's own grid is revealed on the same clock, so the reveal runs on in the hero once
  // the loader has gone
  const heroGrid = $('.hero__pattern');
  if (grid && !reduceMotion) heroGrid.classList.add('is-revealing');
  function gridFrame(now) {
    if (!grid) return;
    const t = Math.min(1, (now - reveal.start) / reveal.duration);
    reveal.p = reveal.from + (reveal.to - reveal.from) * (reveal.to < 1 ? easeInOut(t) : easeOut(t));
    const box = heroGrid.parentElement.getBoundingClientRect(); // the content box both grids fill
    const full = Math.hypot(box.width, box.height) / 2 + 240; // the soft edge clears the corners
    const r = `${(reveal.p * full).toFixed(1)}px`;
    grid.style.setProperty('--grid-reveal', r);
    heroGrid.style.setProperty('--grid-reveal', r);
    if (reveal.to === 1 && t === 1) {
      heroGrid.classList.remove('is-revealing');
      return;
    }
    requestAnimationFrame(gridFrame);
  }
  if (grid && !reduceMotion) requestAnimationFrame(gridFrame);
  const finishGrid = (duration) => Object.assign(reveal, { from: reveal.p, to: 1, start: performance.now(), duration });

  async function runLoader() {
    await Promise.all([ready, timeout(SPIN)]);
    // all at once: the planet glides up into its place as the hero starts drawing itself in and
    // the loader clears off it, while the grid runs on to its edges in the hero, completing with
    // the hero's intro
    finishGrid(GRID_END);
    const ease = 'cubic-bezier(0.4, 0, 0.2, 1)';
    loader.querySelectorAll('.loader__logo').forEach((el) =>
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LOGO_FADE, easing: ease, fill: 'forwards' })
    );
    // from the pose the loader holds it in, wherever the window has been resized to meanwhile
    const pose = loaderPose();
    globe.style.transform = '';
    globe.animate([{ transform: pose }, { transform: 'none' }], { duration: GLIDE, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
    intro();
    await loader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: ease, fill: 'forwards' }).finished;
    removeLoader();
  }

  if (reduceMotion || !loader) {
    removeLoader();
    ready.then(() => intro());
  } else {
    runLoader();
  }
})();
