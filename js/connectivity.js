// "Connectivity without boundaries" — a scroll-driven sequence (Figma storyboard 228:3913).
// The stage sticks while the section scrolls past. First the title fills in white, then each
// panel hands over to the next along the box diagonal: the shared corner travels from the
// bottom-right to the top-left, so the current panel shrinks into the top-left corner while the
// next one grows out of the bottom-right. All keep the box's proportions all the way. Each
// hand-over starts before the previous one has finished, so mid-sequence three panels share
// the diagonal: one leaving, one in focus, one arriving.
// Each image panel holds a short clip in which a line sweeps across, turning a wireframe into
// the photo. The clips are scrubbed by the scroll, not played: all four get the same stretch of
// scroll, back to back, so they run at one speed and each line starts where the last one ended.
// On top of that every clip slowly zooms out for as long as its panel is on screen, so no panel
// ever sits still, even once its clip has finished.
(() => {
  const section = document.querySelector('[data-connectivity]');
  if (!section) return;

  const box = section.querySelector('.connectivity__box');
  const panels = [...section.querySelectorAll('.connectivity__panel')];
  const title = section.querySelector('.connectivity__title');
  const videos = panels.map((panel) => panel.querySelector('video'));
  const infos = [...section.querySelectorAll('.connectivity__info')]; // caption + number per image panel

  // scroll lengths in viewport heights
  const FILL = 1; // title fill, once the stage has stuck
  const STEP = 2; // each hand-over
  const HOLD = 0.3; // the last panel stays full before the section scrolls away
  const handovers = panels.length - 1;
  // Hand-over k (panel k → k + 1) runs over seq [k·LAG, k·LAG + 1]; with LAG < 1 the next one
  // starts while the previous is still finishing.
  const LAG = 0.5;
  // A clip starts a third of the way into its panel's arrival (the new panel at about a third of
  // the box) and runs until the next clip starts at the same point of the next hand-over, so
  // every clip gets LAG of scroll and they all run at one speed.
  const CLIP_START = 0.41; // ease(0.41) ≈ 0.34
  // Pace within a clip: fast out of the start, slow through the middle, fast into the end.
  // A blend of linear and a cubic centred on the middle; PACE sets how strong the slow-down is
  // (0 = even pace; 0.55 runs the ends at ~2.2× and the middle at ~0.45× the average speed).
  // The start and end stay put, so the clips still hand over at the same moments.
  const PACE = 0.55;
  const pace = (p) => (1 - PACE) * p + PACE * (0.5 + 4 * (p - 0.5) ** 3);
  const ZOOM = 0.12; // extra scale a clip starts from; it eases back to 1 across the panel's life
  // Captions follow the clips: card k's caption and number flip in as its clip starts and flip
  // out as the next one's start. The last caption leaves before its panel fills the box and
  // covers the corner it sits in.
  const CAPTION_END = (handovers - 1) * LAG + 0.65;
  const seqEnd = Math.max((handovers - 1) * LAG + 1, handovers * LAG + CLIP_START);
  const travel = FILL + seqEnd * STEP + HOLD;

  // The drawn state chases the scroll position instead of jumping with it, so wheel steps
  // and trackpad flicks glide. SMOOTH is the time constant of that chase, in ms.
  const SMOOTH = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140;

  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  // ease-in-out: each boundary lingers near the box corners and crosses the middle quickly, so the
  // panels at either end stay small and the one in focus gets most of the diagonal; with the
  // hand-overs overlapping, one boundary is always on the move, so the whole never stalls
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

  section.classList.add('is-scrolling');
  section.style.setProperty('--track', `${(1 + travel) * 100}vh`);

  // Lays a panel out as the diagonal slice from `a` to `b` (fractions of the box diagonal),
  // shrunk by `inset` on every side (a fraction of the box) around its centre.
  function place(panel, a, b, inset = 0) {
    const size = b - a - 2 * inset;
    panel.style.visibility = size > 0.001 ? 'visible' : 'hidden';
    if (size <= 0.001) return;
    panel.style.left = `${(a + inset) * 100}%`;
    panel.style.top = `${(a + inset) * 100}%`;
    panel.style.width = `${size * 100}%`;
    panel.style.height = `${size * 100}%`;
    // corners would clump together on a sliver of a panel
    panel.style.setProperty('--corner-opacity', clamp((size * box.offsetWidth - 20) / 60));
  }

  // where the scroll position says we should be
  function target() {
    const scrolled = -section.getBoundingClientRect().top / window.innerHeight; // past the moment the stage sticks
    return {
      // the title panel grows to full size as the section rises into view, done as it sticks
      enter: clamp(1 + scrolled),
      // the fill starts just before the stage sticks, so it plays out in full view
      fill: clamp((scrolled + 0.15) / (FILL + 0.15)),
      // position along the panel sequence: 0 = title, 1 = first image, …
      seq: clamp((scrolled - FILL) / STEP, 0, seqEnd),
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

  function scrub(seq) {
    let synced = true;
    videos.forEach((video, k) => {
      if (!video) return;
      const p = pace(clamp((seq - ((k - 1) * LAG + CLIP_START)) / LAG));
      // stop a frame short of the end: seeking to the very end can show a blank frame
      const duration = video.duration || 0;
      wanted.set(video, Math.round(p * Math.max(0, duration - FRAME) / FRAME) * FRAME);
      if (!seek(video)) synced = false;
      // the panel is on screen from its arrival to the end of its exit (the last one stays)
      video.style.setProperty('--zoom', 1 + ZOOM * (1 - clamp((seq - (k - 1) * LAG) / (LAG + 1))));
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
  const smoothstep = (t) => t * t * (3 - 2 * t);

  function draw({ enter, fill, seq }) {
    const grow = ENTER_SIZE + (1 - ENTER_SIZE) * smoothstep(enter);
    title.style.setProperty('--fill', fill);
    box.style.setProperty('--drift', (seq * 60).toFixed(1)); // background grid, px
    // the spot over the grid swings along the anti-diagonal, between the free top-right and
    // bottom-left corners, with a gentle sideways sway
    const swing = Math.sin(seq * 2.4 + 0.9);
    const sway = Math.cos(seq * 3.7) * 8;
    box.style.setProperty('--spot-x', `${(50 + 30 * swing + sway).toFixed(2)}%`);
    box.style.setProperty('--spot-y', `${(50 - 30 * swing + sway).toFixed(2)}%`);
    const synced = scrub(seq);
    const focus = seq < CLIP_START ? 0 : Math.min(handovers, Math.floor((seq - CLIP_START) / LAG) + 1);
    showInfo(seq > CAPTION_END ? 0 : focus);

    // boundary k sits between panels k and k + 1, as a fraction of the diagonal from the
    // top-left: it sweeps from 1 to 0 over hand-over k; the panels fill the gaps between them
    let from = 0;
    panels.forEach((panel, k) => {
      const to = k < handovers ? 1 - ease(clamp(seq - k * LAG)) : 1;
      place(panel, from, to, k === 0 ? (to - from) * (1 - grow) / 2 : 0);
      // the title shrinks with its panel instead of reflowing
      if (k === 0) title.style.setProperty('--title-scale', to * grow);
      from = to;
    });
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
