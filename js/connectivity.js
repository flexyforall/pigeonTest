// "Connectivity without boundaries" — a scroll-driven sequence (Figma storyboard 248:7761).
// The stage sticks while the section scrolls past. First the title fills in white, then the
// panels run past as a horizontal strip, clipped to the box, one full-size panel at a time.
// Each change has two moves: the current panel slides a little to the left and the edge of the
// next one peeks in from the right; after a short pause the strip slides on until the next
// panel fills the box. At the end the last panel spreads out to the whole screen.
// Each image panel holds a short clip in which a line sweeps across, turning a wireframe into
// the photo. The clips are scrubbed by the scroll, not played: each runs from the moment its
// panel slides in until the next panel starts to peek, all over the same stretch of scroll, so
// they run at one speed. Every clip also slowly zooms out while its panel is on screen.
(() => {
  const section = document.querySelector('[data-connectivity]');
  if (!section) return;

  const box = section.querySelector('.connectivity__box');
  const track = section.querySelector('.connectivity__track');
  const panels = [...section.querySelectorAll('.connectivity__panel')];
  const title = section.querySelector('.connectivity__title');
  const videos = panels.map((panel) => panel.querySelector('video'));
  const infos = [...section.querySelectorAll('.connectivity__info')]; // caption + number per image panel

  // scroll lengths in viewport heights
  const FILL = 1; // title fill, once the stage has stuck
  const STEP = 1.6; // each change of panel
  const HOLD = 0.3; // the last panel stays full before the section scrolls away
  const changes = panels.length - 1;

  // One change per unit of seq: change k (panel k → k + 1) runs over seq [k, k + 1).
  // As fractions of that unit:
  const PEEK = 355 / 1360; // how far the strip moves for the peek (from the storyboard)
  const PEEK_END = 0.25; // the peek is done
  const SLIDE_START = 0.4; // after a pause, the strip slides on…
  const SLIDE_END = 0.75; // …and the next panel fills the box until the next change
  // A clip plays from its panel's slide-in to the next peek: the same length for every clip.
  const CLIP = 1 - SLIDE_START;
  // Pace within a clip: fast out of the start, slow through the middle, fast into the end.
  // A blend of linear and a cubic centred on the middle; PACE sets how strong the slow-down is
  // (0 = even pace; 0.55 runs the ends at ~2.2× and the middle at ~0.45× the average speed).
  // The start and end stay put, so the clips still hand over at the same moments.
  const PACE = 0.55;
  const pace = (p) => (1 - PACE) * p + PACE * (0.5 + 4 * (p - 0.5) ** 3);
  const ZOOM = 0.12; // extra scale a clip starts from; it eases back to 1 across the panel's life
  // the last clip ends a whole unit after the last change starts
  const seqEnd = changes;
  // Finale: once the last clip has played, its panel spreads from the box out to the whole
  // screen over OUTRO more of the sequence.
  const OUTRO = 0.35;
  const travel = FILL + (seqEnd + OUTRO) * STEP + HOLD;

  // The drawn state chases the scroll position instead of jumping with it, so wheel steps
  // and trackpad flicks glide. SMOOTH is the time constant of that chase, in ms.
  const SMOOTH = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140;

  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  section.classList.add('is-scrolling');
  section.style.setProperty('--track', `${(1 + travel) * 100}vh`);

  // Position of the strip, in panels: 0 = title in the box, 1 = first image, …
  function stripAt(seq) {
    if (seq >= changes) return changes;
    const k = Math.floor(seq);
    const t = seq - k;
    if (t < PEEK_END) return k + PEEK * smoothstep(t / PEEK_END);
    if (t < SLIDE_START) return k + PEEK;
    if (t < SLIDE_END) return k + PEEK + (1 - PEEK) * easeInOut((t - SLIDE_START) / (SLIDE_END - SLIDE_START));
    return k + 1;
  }

  // where the scroll position says we should be
  function target() {
    const scrolled = -section.getBoundingClientRect().top / window.innerHeight; // past the moment the stage sticks
    return {
      // the title panel grows to full size as the section rises into view, done as it sticks
      enter: clamp(1 + scrolled),
      // the fill starts just before the stage sticks, so it plays out in full view
      fill: clamp((scrolled + 0.15) / (FILL + 0.15)),
      // position along the sequence, in changes of panel
      seq: clamp((scrolled - FILL) / STEP, 0, seqEnd + OUTRO),
    };
  }

  /* ---------- scrubbing ---------- */
  // Seeks are asynchronous: while one is in flight only the latest wanted time is kept,
  // and it is applied as soon as the video lands. Safari can drop a seek without ever firing
  // `seeked`, which would leave the clip frozen, so a seek still pending after SEEK_TIMEOUT
  // is issued again.
  const wanted = new Map();
  const seekStarted = new Map();
  const FRAME = 1 / 24;
  const SEEK_TIMEOUT = 1500; // ms

  // true once the video shows the wanted frame (or can't seek yet)
  function seek(video) {
    const t = wanted.get(video);
    if (t === undefined || video.readyState < 1) return true;
    // only the scroll moves a clip: Safari may run the primer's play() late, when the panel shows
    if (!video.paused) video.pause();
    const now = performance.now();
    if (video.seeking) {
      if (now - seekStarted.get(video) < SEEK_TIMEOUT) return false;
    } else if (Math.abs(video.currentTime - t) < FRAME / 2) {
      return true;
    }
    video.currentTime = t;
    seekStarted.set(video, now);
    return false;
  }
  videos.forEach((video) => {
    if (!video) return;
    video.addEventListener('seeked', () => seek(video));
    // the wanted time depends on the duration, so recompute once it is known
    video.addEventListener('loadedmetadata', () => draw(state));
  });

  function scrub(seq, strip) {
    let synced = true;
    videos.forEach((video, k) => {
      if (!video) return;
      const p = pace(clamp((seq - (k - 1 + SLIDE_START)) / CLIP));
      // stop a frame short of the end: seeking to the very end can show a blank frame
      const duration = video.duration || 0;
      wanted.set(video, Math.round(p * Math.max(0, duration - FRAME) / FRAME) * FRAME);
      if (!seek(video)) synced = false;
      // the panel is on screen while the strip is between k − 1 and k + 1 (the last one stays)
      video.style.setProperty('--zoom', 1 + ZOOM * (1 - clamp((strip - (k - 1)) / 2)));
    });
    return synced;
  }

  // Browsers (iOS Safari above all) may not fetch a paused muted video until it has played once,
  // so each clip is nudged into play and straight back to pause as the section approaches.
  const primer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      primer.disconnect();
      videos.forEach((video) => {
        if (!video) return;
        const play = video.play();
        if (play) play.then(() => { video.pause(); seek(video); }).catch(() => {});
      });
    },
    { rootMargin: '100% 0px' }
  );
  primer.observe(section);

  /* ---------- captions ---------- */
  // Words sit in clipping boxes and flip like the hero headline: the old ones lift out of view,
  // the new ones rise in behind them, word by word.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const EASE_IN = 'cubic-bezier(0.55, 0, 0.75, 0.2)';

  infos.forEach((info) =>
    info.querySelectorAll('p').forEach((line) => {
      const words = line.textContent.trim().split(/\s+/);
      line.textContent = '';
      words.forEach((word, i) => {
        const w = document.createElement('span');
        w.className = 'w';
        const inner = document.createElement('span');
        inner.className = 'w__in';
        inner.textContent = word;
        w.append(inner);
        line.append(w);
        if (i < words.length - 1) line.append(' ');
      });
    })
  );

  let shownInfo = 0; // 1-based card number, 0 = none
  const wordsOf = (info) => [...info.querySelectorAll('.w__in')];

  function showInfo(n) {
    if (n === shownInfo) return;
    const prev = infos[shownInfo - 1];
    const next = infos[n - 1];
    shownInfo = n;

    if (prev) {
      const words = wordsOf(prev);
      words.forEach((w) => w.getAnimations().forEach((a) => a.cancel()));
      if (reduceMotion) prev.classList.remove('is-shown');
      else {
        const out = words.map((w, i) =>
          w.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-105%)' }], {
            duration: 450,
            delay: i * 20,
            easing: EASE_IN,
            fill: 'forwards',
          })
        );
        Promise.all(out.map((a) => a.finished)).then(() => {
          if (infos[shownInfo - 1] !== prev) prev.classList.remove('is-shown');
          out.forEach((a) => a.cancel());
        }, () => {});
      }
    }

    if (next) {
      const words = wordsOf(next);
      words.forEach((w) => w.getAnimations().forEach((a) => a.cancel()));
      next.classList.add('is-shown');
      if (!reduceMotion) {
        words.forEach((w, i) =>
          w.animate([{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], {
            duration: 900,
            delay: 200 + i * 40,
            easing: EASE_OUT,
            fill: 'backwards',
          })
        );
      }
    }
  }

  // the title panel starts at ENTER_SIZE of the box as the section enters and grows to full size
  // over the whole rise, settling just as the stage sticks
  const ENTER_SIZE = 0.83;

  function draw({ enter, fill, seq }) {
    const strip = stripAt(seq);
    title.style.setProperty('--fill', fill);
    const synced = scrub(seq, strip);
    // a card's caption flips in as its panel slides in and out as the next one starts to peek;
    // the last one leaves before the finale
    const focus = seq < SLIDE_START ? 0 : Math.min(changes, Math.floor(seq - SLIDE_START) + 1);
    showInfo(seq >= seqEnd ? 0 : focus);

    panels.forEach((panel, k) => {
      const offset = k - strip; // in panel widths, 0 = in the box
      panel.style.visibility = Math.abs(offset) < 1 ? 'visible' : 'hidden';
      panel.style.transform = `translateX(${(offset * 100).toFixed(3)}%)`;
    });

    // entrance: the title panel grows from ENTER_SIZE around its centre, its title with it
    const grow = ENTER_SIZE + (1 - ENTER_SIZE) * smoothstep(enter);
    const titlePanel = panels[0];
    titlePanel.style.inset = `${((1 - grow) / 2) * 100}%`;
    titlePanel.style.width = titlePanel.style.height = 'auto';
    title.style.setProperty('--title-scale', grow);

    // finale: the last panel spreads from the box to the edges of the stage (the screen),
    // and the strip's clip opens out with it
    const outro = smoothstep(clamp((seq - seqEnd) / OUTRO));
    const last = panels[changes];
    const bleedX = box.offsetLeft * outro;
    const bleedY = box.offsetTop * outro;
    last.style.inset = `${-bleedY}px ${-bleedX}px`;
    last.style.width = last.style.height = 'auto';
    track.style.setProperty('--bleed-x', `${bleedX}px`);
    track.style.setProperty('--bleed-y', `${bleedY}px`);
    return synced;
  }

  let state = target();
  let frame = 0;
  let last = 0;

  function tick(now) {
    const goal = target();
    const dt = last ? now - last : 16;
    const k = SMOOTH ? 1 - Math.exp(-dt / SMOOTH) : 1;
    state = Object.fromEntries(Object.keys(goal).map((key) => [key, state[key] + (goal[key] - state[key]) * k]));
    const settled = Object.keys(goal).every((key) => Math.abs(goal[key] - state[key]) < 0.001);
    if (settled) state = goal;
    // keep going until the clips have caught up too
    const done = draw(state) && settled;
    last = done ? 0 : now;
    frame = done ? 0 : requestAnimationFrame(tick);
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  draw(state);
})();
