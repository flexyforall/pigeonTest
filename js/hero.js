(() => {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const EASE_IN = 'cubic-bezier(0.55, 0, 0.75, 0.2)';
  // the default hero (the planet, centred copy) and the three audiences, picked with the tabs or
  // the cards; the logo goes back to the default
  const STATES = ['home', 'business', 'residential', 'mobile'];

  // the page stays put (html.is-locked, set in the head) until the hero has drawn itself in.
  // It always opens at its top, the hero, whichever page it comes from and wherever that was
  // scrolled to: the browser's own restoring is off (in the head), and the top is set again
  // once everything is in and when the page is shown from the history. Where the page is shown
  // inside another one (a preview) that keeps its scroll, the hero is brought into view there too.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const toTop = () => {
    if (location.hash) return; // a link to a part of the page goes there
    window.scrollTo(0, 0);
    if (window.top !== window) hero.scrollIntoView({ block: 'start' });
  };
  toTop();
  // (only while it is still held: never under someone already scrolling)
  window.addEventListener('load', () => {
    if (document.documentElement.classList.contains('is-locked')) toTop();
  }, { once: true });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) toTop();
  });
  const unlock = () => document.documentElement.classList.remove('is-locked');
  setTimeout(unlock, 15000); // whatever happens, never for good

  const $ = (sel, root = hero) => root.querySelector(sel);
  const $$ = (sel, root = hero) => [...root.querySelectorAll(sel)];

  const tabs = $$('.audience__tab');
  const indicator = $('.audience__indicator');
  const cards = $$('.card');
  const highlight = $('.cards__highlight');
  const panels = $$('.panel');
  const bgs = $$('[data-bg]'); // the planet's box and the three illustrations
  const planet = $('.hero__planet-video');
  const isImg = (bg) => bg.tagName === 'IMG';

  let current = hero.dataset.state;
  let busy = false;

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
  // `to` animates away from the CSS state and holds the end state until cancelled
  const to = (el, keyframe, opts = {}) =>
    el.animate([cssState(el, keyframe, opts.pseudoElement), keyframe], {
      fill: 'forwards',
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
  const SWITCH_TIMING = { word: 800, stagger: 30, text: 120, button: 200, fade: 700 };

  function enterPanel(panel, delay = 0, t = INTRO_TIMING) {
    const words = $$('.w__in', panel);
    const text = $('.panel__text', panel);
    const btn = $('.btn', panel);

    from($('.rating', panel), { opacity: 0, transform: 'translateY(12px)' }, {
      duration: t.fade,
      delay: Math.max(0, delay - 100),
    });

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

  /* ---------- indicator + highlight ---------- */
  function moveIndicator(animated, state = current) {
    const tab = tabs.find((t) => t.dataset.target === state);
    if (!tab) return; // the default hero has none: the pill stays put, hidden
    indicator.classList.toggle('is-animated', animated);
    indicator.style.width = `${tab.offsetWidth}px`;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
  }

  function moveHighlight(animated, state = current) {
    const card = cards.find((c) => c.dataset.target === state);
    if (!card) return;
    highlight.classList.toggle('is-animated', animated);
    highlight.style.width = `${card.offsetWidth}px`;
    highlight.style.height = `${card.offsetHeight}px`;
    highlight.style.transform = `translate(${card.offsetLeft}px, ${card.offsetTop}px)`;
  }

  const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* ---------- background wipe ---------- */
  // A hairline sweeps across the content box from right to left and repaints it with the next
  // illustration.
  const wipeLine = $('.hero__wipe');
  const wipeArea = $('.hero__bg'); // the box the line runs across
  const WIPE = 1100;
  const WIPE_EASE = 'cubic-bezier(0.6, 0, 0.3, 1)';
  // the tab pill and card highlight move with the same timing as the line
  hero.style.setProperty('--wipe-duration', `${WIPE}ms`);
  hero.style.setProperty('--wipe-ease', WIPE_EASE);

  // A clip for `el` as the line runs from the right edge of the wipe area to its left one: `side`
  // 'left' keeps what is right of the line, 'right' what is left of it. The insets are linear in
  // the line's position (and may run past the box), so the line's easing keeps them in step.
  function clipAlongLine(el, side, pad = 0) {
    const area = wipeArea.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const scale = el.offsetWidth ? box.width / el.offsetWidth : 1;
    const inset = (lineX) => {
      const x = area.left + lineX;
      const left = side === 'left' ? (x - box.left) / scale : -pad;
      const right = side === 'right' ? (box.right - x) / scale : -pad;
      return `inset(${-pad}px ${right}px ${-pad}px ${left}px)`;
    };
    return [inset(area.width), inset(0)];
  }

  function wipeBackground(next) {
    const prevBg = bgs.find((b) => b.dataset.bg === current);
    const nextBg = bgs.find((b) => b.dataset.bg === next);
    // keep the incoming image above the outgoing one
    nextBg.style.zIndex = 1;
    prevBg.style.zIndex = 0;
    nextBg.classList.add('is-active');

    const opts = { duration: WIPE, easing: WIPE_EASE };
    // the illustrations are see-through, so the outgoing one gives way behind the line as the
    // incoming one comes in ahead of it
    const [shown, hidden] = clipAlongLine(prevBg, 'right');
    prevBg.animate([{ clipPath: shown }, { clipPath: hidden }], { ...opts, fill: 'forwards' });
    const [from0, to0] = clipAlongLine(nextBg, 'left');
    // the illustrations settle from a touch larger; the planet's box keeps its own transform
    nextBg.animate(
      isImg(nextBg)
        ? [{ clipPath: from0, transform: 'scale(1.04)' }, { clipPath: to0, transform: 'scale(1)' }]
        : [{ clipPath: from0 }, { clipPath: to0 }],
      opts
    );
    wipeLine.animate(
      [{ left: '100%', opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.92 }, { left: '0%', opacity: 0 }],
      opts
    );
    return timeout(WIPE).then(() => {
      prevBg.classList.remove('is-active');
      prevBg.getAnimations().forEach((anim) => anim.cancel());
    });
  }

  // Clips `el` to the part of the content box the line hasn't reached yet, in step with the wipe.
  function eraseBehindLine(el) {
    const [from0, to0] = clipAlongLine(el, 'right', 40); // room for descenders and transforms
    return el.animate([{ clipPath: from0 }, { clipPath: to0 }], {
      duration: WIPE,
      easing: WIPE_EASE,
      fill: 'forwards',
    });
  }

  // Resolves once the erase clip has passed the element's left edge (nothing of it is visible).
  function fullyErased(erase, el) {
    const width = el.getBoundingClientRect().width;
    return new Promise((resolve) => {
      const check = () => {
        const inset = getComputedStyle(el).clipPath.match(/inset\(([^)]*)\)/);
        const right = inset ? parseFloat(inset[1].split(/\s+/)[1]) : 0;
        if (right >= width || erase.playState === 'finished') resolve();
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  }

  /* ---------- switch state ---------- */
  // `instant`: straight there, with no wipe (a page arriving in the state the last one was in)
  async function setState(next, { instant = false } = {}) {
    if (next === current || busy || !STATES.includes(next)) return;
    busy = true;

    const prevPanel = panels.find((p) => p.dataset.panel === current);
    const nextPanel = panels.find((p) => p.dataset.panel === next);

    const markActive = () => {
      // leaving the default hero, the pill and the card highlight appear in place rather than
      // sliding in from wherever they were
      const appear = current === 'home';
      hero.classList.toggle('is-home', next === 'home');
      // the header carries it too: it may be floating outside the hero
      header.classList.toggle('is-home', next === 'home');
      tabs.forEach((t) => {
        const on = t.dataset.target === next;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
      });
      cards.forEach((c) => c.classList.toggle('is-active', c.dataset.target === next));
      moveIndicator(!reduceMotion && !appear, next);
      moveHighlight(!reduceMotion && !appear, next);
    };

    if (reduceMotion || instant) {
      bgs.forEach((b) => b.classList.toggle('is-active', b.dataset.bg === next));
      current = next;
      hero.dataset.state = next;
      markActive();
      prevPanel.classList.remove('is-active');
      prevPanel.setAttribute('aria-hidden', 'true');
      nextPanel.classList.add('is-active');
      nextPanel.removeAttribute('aria-hidden');
      busy = false;
      return;
    }

    // the wipe must reveal a ready image, not one still loading or decoding
    const nextBg = bgs.find((b) => b.dataset.bg === next);
    if (nextBg.dataset.src) loadDeferredImages();
    if (isImg(nextBg)) await nextBg.decode().catch(() => {});
    if (next === 'home') playPlanet();

    // the tab and card respond right away, the content follows the line
    markActive();

    // 1. the line sweeps across, repainting the background and erasing the old copy as it goes
    const content = $('.hero__content');
    const wiped = wipeBackground(next);
    await fullyErased(eraseBehindLine(content), content);
    current = next;
    hero.dataset.state = next;

    prevPanel.classList.remove('is-active');
    prevPanel.setAttribute('aria-hidden', 'true');
    content.getAnimations().forEach((a) => a.cancel());

    // 2. as soon as the line has cleared the copy, the new copy comes in
    //    (the line finishes its last stretch over the empty left margin meanwhile)
    nextPanel.classList.add('is-active');
    nextPanel.removeAttribute('aria-hidden');
    await Promise.all([enterPanel(nextPanel, 60, SWITCH_TIMING), wiped]);
    if (current !== 'home') planet?.pause(); // out of sight now
    busy = false;
  }

  // a tab for an audience with a page of its own (data-page) simply goes there
  tabs.forEach((t) => t.addEventListener('click', (e) => {
    if ('page' in t.dataset) {
      // on that page itself it picks the audience in the hero, as the other tabs do
      if (t.getAttribute('aria-current') !== 'page') return;
      e.preventDefault();
    }
    setState(t.dataset.target);
  }));
  // on the home page the logo takes the hero back to its default; elsewhere it goes home
  $('.header__logo[data-target="home"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    setState('home');
  });
  // a card for an audience with a page of its own (data-page) goes there, as its tab does; on
  // that page itself it picks the audience in the hero
  cards.forEach((c) =>
    c.addEventListener('click', (e) => {
      if (!STATES.includes(c.dataset.target)) return;
      if ('page' in c.dataset && c.getAttribute('aria-current') !== 'page') return;
      e.preventDefault();
      setState(c.dataset.target);
    })
  );

  // keyboard: arrows between tabs
  $('.audience').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
  });

  window.addEventListener('resize', () => {
    moveIndicator(false);
    moveHighlight(false);
  });

  // Secondary backgrounds load after the intro so they don't compete with the first one
  const loadDeferredImages = () =>
    bgs.filter((b) => b.dataset.src).forEach((b) => {
      b.srcset = b.dataset.srcset;
      b.src = b.dataset.src;
      b.removeAttribute('data-src');
      b.removeAttribute('data-srcset');
      b.decode().catch(() => {}); // decode ahead so the first switch doesn't wait on it
    });

  /* ---------- the header, back on scrolling up ---------- */
  // Scrolling down, the header goes with the hero as it always has. Once it is out of sight,
  // scrolling back up brings it in from the top, fixed; scrolling down again sends it back up.
  // Back at the very top it is the hero's own again, in its place.
  // While it floats it is moved out of the hero to the page's body: Safari clips a fixed element
  // to an overflow-hidden ancestor that has a layer of its own (the hero, with its animated
  // pictures), so inside the hero it would vanish with it.
  const header = $('.header');
  const headerHome = header.parentElement;
  header.classList.toggle('is-home', current === 'home'); // no pill on the default hero
  const HEADER_H = () => header.offsetHeight;
  let lastY = 0;
  let floating = false;

  const setFloating = (on) => {
    if (on === floating) return;
    floating = on;
    if (on) document.body.append(header);
    header.classList.toggle('is-floating', on);
    if (!on) {
      header.classList.remove('is-shown');
      headerHome.prepend(header);
    }
  };
  function onScroll() {
    // how far the hero's top has gone above the screen (whatever element scrolls the page)
    const y = -hero.getBoundingClientRect().top;
    const dy = y - lastY;
    if (Math.abs(dy) < 3) return; // the small jitter of a trackpad
    lastY = y;
    if (document.documentElement.classList.contains('is-locked')) return;
    if (!floating) {
      // out of sight above and on the way back up: in it comes, from above
      if (dy < 0 && y > HEADER_H()) {
        setFloating(true);
        header.getBoundingClientRect(); // the hidden state first, so it slides in
        header.classList.add('is-shown');
      }
      return;
    }
    if (y <= 0) setFloating(false); // home: the hero's own header again
    else if (dy > 0) {
      header.classList.remove('is-shown');
      // hidden, and its own place in the hero in view again: it can go back there
      if (y < HEADER_H()) setFloating(false);
    } else header.classList.add('is-shown');
  }
  document.addEventListener('scroll', onScroll, { passive: true, capture: true });

  /* ---------- the planet ---------- */
  // The copy moves up on a screen lower than the design's (css .hero__content: sizes follow the
  // width, the hero the height), so the planet follows it by as much, keeping the copy at the
  // foot of its dome: lifted up to LIFT (so the dome's top stays clear of the header), then made
  // smaller about its top (65 down the box) for the rest.
  const LIFT = 36;
  const fitBox = $('.hero__fit');
  function fitGlobe() {
    if (!fitBox) return;
    const px = Math.min(1.25, Math.max(1, window.innerWidth / 1440)); // --px
    const short = Math.max(0, 810 * px - hero.clientHeight);
    const lift = Math.min(short, LIFT * px);
    const scale = Math.max(0.6, 1 - (short - lift) / (215 * px)); // the copy is 215 below the top
    fitBox.style.setProperty('--globe-lift', `${lift.toFixed(1)}px`);
    fitBox.style.setProperty('--globe-scale', scale.toFixed(4));
  }
  fitGlobe();
  window.addEventListener('resize', fitGlobe);

  // it turns slowly and for good: the clip is a seamless loop, played below its own speed; only
  // while the hero is on screen and showing it
  let heroInView = true;
  function playPlanet() {
    if (planet && !reduceMotion && heroInView) planet.play().catch(() => {});
  }
  if (planet) {
    const rate = Number(planet.dataset.rate) || 1;
    planet.defaultPlaybackRate = rate;
    planet.playbackRate = rate;
    if (reduceMotion) planet.removeAttribute('autoplay');
    else if (current === 'home') planet.play().catch(() => {});
    new IntersectionObserver(([entry]) => {
      heroInView = entry.isIntersecting;
      if (heroInView && current === 'home') playPlanet();
      else planet.pause();
    }).observe(hero);
  }

  /* ---------- intro ---------- */
  function intro() {
    moveIndicator(false);
    moveHighlight(false);
    hero.classList.add('is-ready');
    loadDeferredImages();

    const activePanel = panels.find((p) => p.dataset.panel === current);

    if (reduceMotion) {
      unlock();
      return;
    }
    // the last of it, the cards, are in by then
    setTimeout(unlock, 2200);

    // the backdrop it opens on comes in: the planet, or an audience's illustration
    const bg = bgs.find((b) => b.dataset.bg === current);
    if (isImg(bg)) from(bg, { opacity: 0, transform: 'scale(1.12)' }, { duration: 2200 });
    else from($('.hero__planet'), { opacity: 0, transform: 'scale(1.08)' }, { duration: 2200 });

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
    from(indicator, { opacity: 0 }, { duration: 700, delay: 1000 });

    // rating, headline, text, button
    enterPanel(activePanel, 750);

    // cards
    $$('[data-intro="card"]').forEach((el, i) =>
      from(el, { opacity: 0, transform: 'translateY(40px)' }, { duration: 1100, delay: 900 + i * 110 })
    );
    from(highlight, { opacity: 0 }, { duration: 900, delay: 1300 });
  }

  /* ---------- glow ---------- */
  // While the pointer is over the hero's backdrop, a mint glow trails it, tinting the
  // illustration's lit parts (it is laid over them in overlay).
  const glow = $('.hero__glow');
  if (glow && !reduceMotion && window.matchMedia('(hover: hover)').matches) {
    const area = $('.hero__glow-area');
    // the glow keeps to the shape of the illustration on show
    const fit = () => {
      const img = bgs.find((b) => b.dataset.bg === current);
      if (!img || !isImg(img)) return;
      // the box follows the picture's size every time (it changes with the window)
      area.style.setProperty('--glow-w', getComputedStyle(img).width);
      const src = img.currentSrc || img.src;
      if (area.dataset.src === src) return;
      area.dataset.src = src;
      glow.style.setProperty('--glow-mask', `url("${src}")`);
    };
    fit();
    hero.addEventListener('pointerenter', fit);
    const pos = { x: 0, y: 0, tx: 0, ty: 0 };
    let raf = 0;
    const step = () => {
      pos.x += (pos.tx - pos.x) * 0.12;
      pos.y += (pos.ty - pos.y) * 0.12;
      glow.style.transform = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px)`;
      // the picture's mask, held in place against the area: offset back by the glow's position
      const half = glow.offsetWidth / 2;
      glow.style.setProperty('--mx', `${(half - pos.x).toFixed(1)}px`);
      glow.style.setProperty('--my', `${(half - pos.y).toFixed(1)}px`);
      glow.style.setProperty('--mw', `${area.clientWidth}px`);
      glow.style.setProperty('--mh', `${area.clientHeight}px`);
      raf = Math.abs(pos.tx - pos.x) + Math.abs(pos.ty - pos.y) > 0.3 ? requestAnimationFrame(step) : 0;
    };
    hero.addEventListener('pointermove', (e) => {
      fit();
      const r = area.getBoundingClientRect();
      // over an illustration only, not the default hero's planet
      const inside = current !== 'home' && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      pos.tx = e.clientX - r.left;
      pos.ty = e.clientY - r.top;
      if (inside && !glow.classList.contains('is-on')) {
        // it appears where the pointer is, rather than gliding over from where it last was
        pos.x = pos.tx;
        pos.y = pos.ty;
      }
      glow.classList.toggle('is-on', inside);
      if (!raf) raf = requestAnimationFrame(step);
    });
    hero.addEventListener('pointerleave', () => glow.classList.remove('is-on'));
  }

  /* ---------- from page to page ---------- */
  // Going to another of the site's pages, the hero's state is noted; the next page opens in that
  // state with no loader, and wipes over to its own, as a switch within the hero does: so the
  // home page's planet gives way to the Business illustration behind the line, and back.
  const NAV_KEY = 'pm-nav';
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || link.target === '_blank') return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !/\.html$/.test(url.pathname) || url.pathname === location.pathname) return;
    try {
      sessionStorage.setItem(NAV_KEY, JSON.stringify({ from: current, t: Date.now() }));
    } catch (err) {}
  });
  let arriveFrom = null;
  try {
    const nav = JSON.parse(sessionStorage.getItem(NAV_KEY));
    sessionStorage.removeItem(NAV_KEY);
    if (nav && Date.now() - nav.t < 10000 && STATES.includes(nav.from)) arriveFrom = nav.from;
  } catch (err) {}
  const arriving = arriveFrom !== null && !reduceMotion;

  async function arrive() {
    const own = current;
    // the last page's state, at once, and the hero shown as it was there (once its picture and
    // the fonts are in, which they mostly are, from that page)
    loadDeferredImages();
    if (arriveFrom !== own) await setState(arriveFrom, { instant: true });
    const bg = bgs.find((b) => b.dataset.bg === arriveFrom);
    await Promise.race([Promise.all([fontsReady, isImg(bg) ? bg.decode().catch(() => {}) : Promise.resolve()]), timeout(1500)]);
    moveIndicator(false);
    moveHighlight(false);
    hero.classList.add('is-ready');
    unlock();
    if (arriveFrom === 'home') playPlanet();
    // then over to this page's own, behind the line
    if (arriveFrom !== own) setTimeout(() => setState(own), 120);
  }

  /* ---------- loader ---------- */
  // The planet turns in the middle of the screen until the page is ready (and for SPIN at least),
  // then fades; halfway through the hero starts drawing itself in underneath and the loader clears
  // off it, so the one runs into the other with no pause between and the hero's lines are seen
  // drawing.
  const loader = document.querySelector('.loader');
  const SPIN = 1400;
  const PLANET_FADE = 600;
  const FADE = 700; // the loader's own fade, over the hero's start
  const GRID_END = 2000; // from the hand-over to the grid's full reveal, with the hero's intro

  // the loader's planet turns as slowly as the hero's
  const loaderPlanet = loader?.querySelector('.loader__planet-video');
  if (loaderPlanet) {
    loaderPlanet.defaultPlaybackRate = loaderPlanet.playbackRate = Number(loaderPlanet.dataset.rate) || 1;
    loaderPlanet.play().catch(() => {});
  }

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  // the planet's first frame, so it is there to be seen as the hero comes in
  // the backdrop it opens on, so it is there to be seen as the hero comes in: the planet's first
  // frame, or (on an audience's page) its illustration
  const firstBg = bgs.find((b) => b.dataset.bg === current);
  const bgReady = isImg(firstBg)
    ? (firstBg.complete ? Promise.resolve() : new Promise((resolve) => {
        firstBg.addEventListener('load', resolve, { once: true });
        firstBg.addEventListener('error', resolve, { once: true });
      }))
    : !planet || planet.readyState >= 2
      ? Promise.resolve()
      : new Promise((resolve) => {
          planet.addEventListener('loadeddata', resolve, { once: true });
          planet.addEventListener('error', resolve, { once: true });
        });
  // wait for fonts so the split text is measured correctly
  const ready = Promise.race([Promise.all([fontsReady, bgReady]), timeout(6000)]);

  const removeLoader = () => loader?.remove();

  // The grid's reveal runs the whole length of the loader and completes as it ends. How long the
  // loader lasts is only known once the page is ready, so until then the reveal eases towards
  // HOLD of the way, slowly enough never to get there; once the end is known it runs on from
  // wherever it is to the full reveal, landing as the loader goes.
  const grid = arriving ? null : loader?.querySelector('.loader__grid');
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
    // all at once: the planet fades as the hero starts drawing itself in and the loader clears
    // off it, while the grid runs on to its edges in the hero, completing with the hero's intro
    finishGrid(GRID_END);
    const ease = 'cubic-bezier(0.4, 0, 0.2, 1)';
    loader.querySelectorAll('.loader__logo, .loader__planet').forEach((el) =>
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: PLANET_FADE, easing: ease, fill: 'forwards' })
    );
    intro();
    await loader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: ease, fill: 'forwards' }).finished;
    removeLoader();
  }

  if (arriving) {
    removeLoader();
    arrive();
  } else if (reduceMotion || !loader) {
    removeLoader();
    ready.then(() => intro());
  } else {
    runLoader();
  }
})();
