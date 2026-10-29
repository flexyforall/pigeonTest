(() => {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const EASE_IN = 'cubic-bezier(0.55, 0, 0.75, 0.2)';
  const STATES = ['business', 'residential', 'mobile'];

  // the page stays put (html.is-locked, set in the head) until the hero has drawn itself in
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  const unlock = () => document.documentElement.classList.remove('is-locked');
  setTimeout(unlock, 15000); // whatever happens, never for good

  const $ = (sel, root = hero) => root.querySelector(sel);
  const $$ = (sel, root = hero) => [...root.querySelectorAll(sel)];

  const tabs = $$('.audience__tab');
  const indicator = $('.audience__indicator');
  const cards = $$('.card');
  const highlight = $('.cards__highlight');
  const panels = $$('.panel');
  const bgs = $$('.hero__bg-img');

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
    indicator.classList.toggle('is-animated', animated);
    indicator.style.width = `${tab.offsetWidth}px`;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
  }

  function moveHighlight(animated, state = current) {
    const card = cards.find((c) => c.dataset.target === state);
    highlight.classList.toggle('is-animated', animated);
    highlight.style.width = `${card.offsetWidth}px`;
    highlight.style.height = `${card.offsetHeight}px`;
    highlight.style.transform = `translate(${card.offsetLeft}px, ${card.offsetTop}px)`;
  }

  const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* ---------- background wipe ---------- */
  // A hairline sweeps across the hero from right to left and repaints it with the next background.
  const wipeLine = $('.hero__wipe');
  const WIPE = 1100;
  const WIPE_EASE = 'cubic-bezier(0.6, 0, 0.3, 1)';
  // the tab pill and card highlight move with the same timing as the line
  hero.style.setProperty('--wipe-duration', `${WIPE}ms`);
  hero.style.setProperty('--wipe-ease', WIPE_EASE);

  function wipeBackground(next) {
    const prevBg = bgs.find((b) => b.dataset.bg === current);
    const nextBg = bgs.find((b) => b.dataset.bg === next);
    // keep the incoming image above the outgoing one
    nextBg.style.zIndex = 1;
    prevBg.style.zIndex = 0;
    nextBg.classList.add('is-active');

    const hidden = 'inset(0 0 0 100%)';
    const opts = { duration: WIPE, easing: WIPE_EASE };
    // explicit end value: `none` doesn't interpolate with inset()
    nextBg.animate(
      [{ clipPath: hidden, transform: 'scale(1.04)' }, { clipPath: 'inset(0 0 0 0)', transform: 'scale(1)' }],
      opts
    );
    wipeLine.animate(
      [{ left: '100%', opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.92 }, { left: '0%', opacity: 0 }],
      opts
    );
    return timeout(WIPE).then(() => prevBg.classList.remove('is-active'));
  }

  // Clips `el` to the part of the hero the line hasn't reached yet, in step with the wipe.
  // The clip's right inset is linear in the line's position, so the same easing keeps them in sync.
  function eraseBehindLine(el) {
    const heroBox = hero.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const right = box.right - heroBox.left; // el's right edge in hero coordinates
    const pad = 40; // room for descenders and transforms above/below/left
    const clip = (lineX) => `inset(${-pad}px ${right - lineX}px ${-pad}px ${-pad}px)`;
    return el.animate([{ clipPath: clip(heroBox.width) }, { clipPath: clip(0) }], {
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
  async function setState(next) {
    if (next === current || busy || !STATES.includes(next)) return;
    if (hero.classList.contains('is-loading') || hero.classList.contains('is-handoff')) return;
    busy = true;

    const prevPanel = panels.find((p) => p.dataset.panel === current);
    const nextPanel = panels.find((p) => p.dataset.panel === next);

    const markActive = () => {
      tabs.forEach((t) => {
        const on = t.dataset.target === next;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
      });
      cards.forEach((c) => c.classList.toggle('is-active', c.dataset.target === next));
      moveIndicator(!reduceMotion, next);
      moveHighlight(!reduceMotion, next);
    };

    if (reduceMotion) {
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
    await nextBg.decode().catch(() => {});

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
    from($('[data-intro="rating"]'), { opacity: 0, transform: 'translateY(10px)' }, { duration: 700 });
    await Promise.all([enterPanel(nextPanel, 60, SWITCH_TIMING), wiped]);
    busy = false;
  }

  tabs.forEach((t) => t.addEventListener('click', () => setState(t.dataset.target)));
  cards.forEach((c) =>
    c.addEventListener('click', (e) => {
      if (!STATES.includes(c.dataset.target)) return;
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

  // Secondary backgrounds load after the intro so they don't compete with the loader video
  const loadDeferredImages = () =>
    bgs.filter((b) => b.dataset.src).forEach((b) => {
      b.srcset = b.dataset.srcset;
      b.src = b.dataset.src;
      b.removeAttribute('data-src');
      b.removeAttribute('data-srcset');
      b.decode().catch(() => {}); // decode ahead so the first switch doesn't wait on it
    });

  /* ---------- intro ---------- */
  // afterLoader: the loader video is already on screen and the logo is in place
  function intro({ afterLoader = false } = {}) {
    moveIndicator(false);
    moveHighlight(false);
    hero.classList.add('is-ready');
    hero.classList.remove('is-loading');
    loadDeferredImages();

    const activePanel = panels.find((p) => p.dataset.panel === current);

    if (reduceMotion) {
      unlock();
      return;
    }
    // the last of it, the cards, are in by then
    setTimeout(unlock, 2200);

    if (!afterLoader) {
      const bg = bgs.find((b) => b.dataset.bg === current);
      from(bg, { opacity: 0, transform: 'scale(1.12)' }, { duration: 2200 });
    }

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
    $$('[data-intro="header"]')
      .filter((el) => !(afterLoader && el.classList.contains('header__logo')))
      .forEach((el, i) =>
        from(el, { opacity: 0, transform: 'translateY(-14px)' }, { duration: 900, delay: 500 + i * 60 })
      );
    from(indicator, { opacity: 0 }, { duration: 700, delay: 1000 });

    // rating
    from($('[data-intro="rating"]'), { opacity: 0, transform: 'translateY(12px)' }, { duration: 900, delay: 650 });

    // headline, text, button
    enterPanel(activePanel, 750);

    // cards
    $$('[data-intro="card"]').forEach((el, i) =>
      from(el, { opacity: 0, transform: 'translateY(40px)' }, { duration: 1100, delay: 900 + i * 110 })
    );
    from(highlight, { opacity: 0 }, { duration: 900, delay: 1300 });
  }

  /* ---------- loader ---------- */
  // The loader video runs once per tab session; its last frame stays as the Business background.
  const video = $('.hero__video');
  const LOADER_KEY = 'pigeonm:loader-seen';

  const loaderSeen = () => {
    try { return sessionStorage.getItem(LOADER_KEY) === '1'; } catch { return false; }
  };
  const markLoaderSeen = () => {
    try { sessionStorage.setItem(LOADER_KEY, '1'); } catch { /* storage unavailable */ }
  };

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

  function runLoader() {
    hero.classList.add('is-ready', 'is-loading');
    from($('.header__logo'), { opacity: 0 }, { duration: 900, delay: 200 });

    let introStarted = false;
    let finished = false;

    // The hero UI comes in as the building has fully materialised in the video (data-intro-at, seconds),
    // while the video plays out underneath.
    const startIntro = () => {
      if (introStarted) return;
      introStarted = true;
      markLoaderSeen();
      const played = video.currentTime > 0;
      if (played) hero.classList.add('is-handoff');
      // fonts are long loaded by now, but never split/measure before they are
      Promise.race([fontsReady, timeout(500)]).then(() => intro({ afterLoader: played }));
    };

    // The video stops on its last frame, which is swapped for the identical still image.
    const finish = () => {
      if (finished) return;
      finished = true;
      startIntro();
      video.pause();
      video.remove();
      hero.classList.remove('is-handoff');
    };

    const introAt = Number(video.dataset.introAt) || Infinity;
    const watchTime = (mediaTime) => {
      if (mediaTime >= introAt) startIntro();
      else if (!finished) waitFrame();
    };
    const waitFrame = () =>
      video.requestVideoFrameCallback
        ? video.requestVideoFrameCallback((now, meta) => watchTime(meta.mediaTime))
        : video.addEventListener('timeupdate', () => watchTime(video.currentTime), { once: true });
    waitFrame();

    video.addEventListener('ended', finish, { once: true });
    video.addEventListener('error', finish, { once: true });

    // video that never starts (blocked autoplay, slow network) falls back to the still image
    const started = new Promise((resolve) => video.addEventListener('playing', resolve, { once: true }));
    const play = video.play();
    if (play) play.catch(finish);
    Promise.race([started, timeout(3000)]).then(() => {
      if (video.paused && !finished) finish();
      // safety net if playback stalls midway
      else setTimeout(finish, ((video.duration || 16) + 4) * 1000);
    });
  }

  function skipLoader() {
    video.remove();
    const firstBg = bgs.find((b) => b.dataset.bg === current);
    const bgReady = firstBg.complete
      ? Promise.resolve()
      : new Promise((resolve) => {
          firstBg.addEventListener('load', resolve, { once: true });
          firstBg.addEventListener('error', resolve, { once: true });
        });
    // wait for fonts so the split text and tab widths are measured correctly
    Promise.race([Promise.all([fontsReady, bgReady]), timeout(2500)]).then(() => intro());
  }

  if (reduceMotion || loaderSeen() || current !== 'business') skipLoader();
  else runLoader();
})();
