(() => {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const EASE_IN = 'cubic-bezier(0.55, 0, 0.75, 0.2)';
  const STATES = ['business', 'residential']; // "mobile" has no design yet

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
    return Object.fromEntries(Object.keys(keyframe).map((k) => [k, cs[k]]));
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

  /* ---------- split headings into words > chars ---------- */
  function splitTitle(title) {
    const lit = Number(title.dataset.lit) || 0;
    const label = title.textContent.replace(/\s+/g, ' ').trim();
    const frag = document.createDocumentFragment();
    let index = 0;

    title.childNodes.forEach((node) => {
      if (node.nodeName === 'BR') {
        frag.append(document.createElement('br'));
        return;
      }
      const words = node.textContent.split(/(\s+)/);
      words.forEach((chunk) => {
        if (!chunk) return;
        if (/^\s+$/.test(chunk)) {
          frag.append(' ');
          index += 1;
          return;
        }
        const w = document.createElement('span');
        w.className = 'w';
        const inner = document.createElement('span');
        inner.className = 'w__in';
        [...chunk].forEach((ch) => {
          const c = document.createElement('span');
          c.className = 'c';
          c.textContent = ch;
          if (index < lit) c.dataset.lit = '';
          inner.append(c);
          index += 1;
        });
        w.append(inner);
        frag.append(w);
      });
    });

    title.textContent = '';
    title.append(frag);
    title.setAttribute('aria-label', label);
    [...title.children].forEach((el) => el.setAttribute('aria-hidden', 'true'));
    title.classList.add('is-split');
  }
  $$('[data-split]').forEach(splitTitle);

  /* ---------- text fill (dim -> white, char by char) ---------- */
  function lightUp(panel, delay = 0) {
    const chars = $$('.c[data-lit]', panel);
    chars.forEach((c, i) => {
      c.style.transitionDelay = `${delay + i * 22}ms`;
      c.classList.add('is-lit');
    });
  }
  function dimDown(panel) {
    $$('.c', panel).forEach((c) => {
      c.style.transitionDelay = '0ms';
      c.classList.remove('is-lit');
    });
  }

  /* ---------- panel enter / leave ---------- */
  function enterPanel(panel, delay = 0) {
    const words = $$('.w__in', panel);
    const text = $('.panel__text', panel);
    const btn = $('.btn', panel);

    words.forEach((w, i) =>
      from(w, { transform: 'translateY(105%)' }, { duration: 1000, delay: delay + i * 45 })
    );
    lightUp(panel, delay + 250);

    from(text, { opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' }, {
      duration: 900,
      delay: delay + 250,
    });

    return from(btn, { opacity: 0, transform: 'translateY(16px)', clipPath: 'inset(100% 0 0 0)' }, {
      duration: 900,
      delay: delay + 380,
    }).finished;
  }

  function leavePanel(panel) {
    const words = $$('.w__in', panel);
    const text = $('.panel__text', panel);
    const btn = $('.btn', panel);
    const opts = { duration: 450, easing: EASE_IN };

    const anims = words.map((w, i) => to(w, { transform: 'translateY(-105%)' }, { ...opts, delay: i * 18 }));
    anims.push(to(text, { opacity: 0, transform: 'translateY(-10px)' }, opts));
    anims.push(to(btn, { opacity: 0, transform: 'translateY(-10px)' }, { ...opts, delay: 60 }));
    return Promise.all(anims.map((a) => a.finished)).then(() => anims);
  }

  /* ---------- indicator + highlight ---------- */
  function moveIndicator(animated) {
    const tab = tabs.find((t) => t.dataset.target === current);
    indicator.classList.toggle('is-animated', animated);
    indicator.style.width = `${tab.offsetWidth}px`;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
  }

  function moveHighlight(animated) {
    const card = cards.find((c) => c.dataset.target === current);
    highlight.classList.toggle('is-animated', animated);
    highlight.style.width = `${card.offsetWidth}px`;
    highlight.style.height = `${card.offsetHeight}px`;
    highlight.style.transform = `translate(${card.offsetLeft}px, ${card.offsetTop}px)`;
  }

  /* ---------- background crossfade ---------- */
  function swapBackground(next) {
    const prevBg = bgs.find((b) => b.dataset.bg === current);
    const nextBg = bgs.find((b) => b.dataset.bg === next);
    // keep the incoming image above the outgoing one
    nextBg.style.zIndex = 1;
    prevBg.style.zIndex = 0;
    nextBg.classList.add('is-active');
    from(nextBg, { opacity: 0, transform: 'scale(1.08)', filter: 'blur(8px)' }, { duration: 1400 });
    const out = to(prevBg, { opacity: 0, transform: 'scale(0.98)' }, { duration: 1200, easing: 'ease' });
    out.finished.then(() => {
      prevBg.classList.remove('is-active');
      out.cancel();
    });
  }

  /* ---------- switch state ---------- */
  async function setState(next) {
    if (next === current || busy || !STATES.includes(next)) return;
    if (hero.classList.contains('is-loading')) return;
    busy = true;

    const prevPanel = panels.find((p) => p.dataset.panel === current);
    const nextPanel = panels.find((p) => p.dataset.panel === next);

    swapBackground(next);
    current = next;
    hero.dataset.state = next;

    tabs.forEach((t) => {
      const on = t.dataset.target === next;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    cards.forEach((c) => c.classList.toggle('is-active', c.dataset.target === next));
    moveIndicator(true);
    moveHighlight(true);

    if (reduceMotion) {
      prevPanel.classList.remove('is-active');
      prevPanel.setAttribute('aria-hidden', 'true');
      nextPanel.classList.add('is-active');
      nextPanel.removeAttribute('aria-hidden');
      lightUp(nextPanel);
      busy = false;
      return;
    }

    const leaveAnims = await leavePanel(prevPanel);
    prevPanel.classList.remove('is-active');
    prevPanel.setAttribute('aria-hidden', 'true');
    leaveAnims.forEach((a) => a.cancel());
    dimDown(prevPanel);

    nextPanel.classList.add('is-active');
    nextPanel.removeAttribute('aria-hidden');
    await enterPanel(nextPanel, 0);
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
      b.src = b.dataset.src;
      b.removeAttribute('data-src');
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
      lightUp(activePanel);
      return;
    }

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
  const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* ---------- countdown ---------- */
  // 3 → 2 → 1 while the loader video downloads in full; "1" holds until it has.
  const countdown = $('.countdown');
  const COUNT_FROM = 3;
  const TICK = 800; // ms per digit
  const MAX_WAIT = 12000; // give up on the video after this and open on the still frame

  function showDigit(n) {
    const box = $('.countdown__box', countdown);
    const prev = $('.countdown__digit', box);
    const next = prev.cloneNode();
    next.textContent = n;
    box.append(next);
    from(next, { transform: 'translateY(100%)', opacity: 0 }, { duration: 600 });
    to(prev, { transform: 'translateY(-100%)', opacity: 0 }, { duration: 500 }).finished.then(() => prev.remove());
  }

  const setProgress = (p) => {
    $('.countdown__fill', countdown).style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
  };

  // Downloads the whole video so playback can't stall; resolves to an object URL (or null).
  async function downloadVideo() {
    const src = [...video.querySelectorAll('source')].find((el) => video.canPlayType(el.type))?.src;
    if (!src) return null;
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      const total = Number(res.headers.get('content-length')) || 0;
      if (!res.body || !total) {
        const blob = await res.blob();
        setProgress(1);
        return URL.createObjectURL(blob);
      }
      const reader = res.body.getReader();
      const chunks = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        setProgress(loaded / total);
      }
      return URL.createObjectURL(new Blob(chunks, { type: res.headers.get('content-type') || 'video/mp4' }));
    } catch {
      return null;
    }
  }

  async function runCountdown(download) {
    // digits are set in Outfit; don't show a fallback face if it's quick to arrive
    if (document.fonts) await Promise.race([document.fonts.load('300 72px Outfit'), timeout(1500)]);
    hero.classList.add('is-ticking');
    from($('.countdown__box', countdown), { opacity: 0, transform: 'scale(0.92)' }, { duration: 900 });
    from($('.countdown__bar', countdown), { opacity: 0 }, { duration: 900, delay: 200 });

    for (let n = COUNT_FROM - 1; n >= 1; n -= 1) {
      await timeout(TICK);
      showDigit(n);
    }
    // "1" stays at least one tick, longer if the video is still downloading
    const [url] = await Promise.all([Promise.race([download, timeout(MAX_WAIT).then(() => null)]), timeout(TICK)]);
    setProgress(1);

    const out = [
      to($('.countdown__box', countdown), { opacity: 0, transform: 'scale(1.06)' }, { duration: 500 }),
      to($('.countdown__bar', countdown), { opacity: 0 }, { duration: 400 }),
    ];
    await Promise.all(out.map((a) => a.finished));
    return url;
  }

  /* ---------- loader ---------- */
  async function runLoader() {
    const download = downloadVideo();
    hero.classList.add('is-ready', 'is-loading', 'is-counting');
    from($('.header__logo'), { opacity: 0 }, { duration: 900, delay: 200 });

    const url = await runCountdown(download);

    let finished = false;

    // The hero UI comes in only once the video has stopped on its last frame.
    // That frame is swapped for the identical still image, so nothing visibly changes.
    const finish = () => {
      if (finished) return;
      finished = true;
      markLoaderSeen();
      const played = video.currentTime > 0;
      hero.classList.remove('is-counting', 'is-ticking');
      video.pause();
      video.remove();
      if (url) URL.revokeObjectURL(url);
      // fonts are long loaded by now, but never split/measure before they are
      Promise.race([fontsReady, timeout(500)]).then(() => intro({ afterLoader: played }));
    };

    if (!url) {
      finish();
      return;
    }

    video.addEventListener('ended', finish, { once: true });
    video.addEventListener('error', finish, { once: true });
    // the countdown's black screen stays until the first video frame is on screen
    video.addEventListener('playing', () => hero.classList.remove('is-counting', 'is-ticking'), { once: true });

    video.src = url;
    const play = video.play();
    if (play) play.catch(finish);
    // safety net if playback never starts or stalls
    timeout(3000).then(() => {
      if (video.paused && !finished) finish();
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
