// "Connectivity without boundaries" — a scroll-driven sequence (Figma storyboard 248:7761).
// The stage sticks while the section scrolls past. First the title fills in white, then the
// panels run past as a horizontal strip, clipped to the box. The strip never stops: it eases
// down while a panel fills the box and speeds up between panels. At the end the last panel
// spreads out to the whole screen.
// Each image panel holds a short clip in which a line sweeps across, turning a wireframe into
// the photo. The clips are scrubbed by the scroll, not played, and chained so the line reads as
// one: a clip's line leaves its panel at the right edge exactly as the next clip's line enters
// at the left edge of the next panel — the same seam on screen. Only the stretch of each clip
// where the line is on screen is used (data-line, in seconds), at the same pace for all; the
// first clip also plays its opening, where the line appears, as its panel slides in.
// Every clip also slowly zooms out while its panel is on screen.
(() => {
  const section = document.querySelector('[data-connectivity]');
  if (!section) return;

  const box = section.querySelector('.connectivity__box');
  const track = section.querySelector('.connectivity__track');
  const progress = section.querySelector('.connectivity__progress');
  const panels = [...section.querySelectorAll('.connectivity__panel')];
  const title = section.querySelector('.connectivity__title');
  const videos = panels.map((panel) => panel.querySelector('video'));

  // scroll lengths in viewport heights
  const FILL = 1; // title fill, once the stage has stuck
  const STEP = 1.6; // each change of panel
  const HOLD = 0.3; // the last panel stays full before the section scrolls away
  const changes = panels.length - 1;

  // One change per unit of seq: change k (panel k → k + 1) runs over seq [k, k + 1). Within a
  // change the strip eases: slower (but never still) while a panel is centred, faster between.
  const EASE = 0.5; // 0 = constant speed; 0.5 = from half speed at a panel to 1.5× in between
  const ease = (t) => t - (EASE * Math.sin(2 * Math.PI * t)) / (2 * Math.PI);
  // A clip's line enters as its panel shows SEAM of itself at the right of the box, and leaves
  // as the next panel shows the same: every clip takes one change's worth of scroll.
  const SEAM = 0.3;
  const invEase = (y) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (ease(mid) < y) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const CLIP_AT = invEase(SEAM); // where in a change the next clip starts
  const clipStart = (k) => k - 1 + CLIP_AT; // seq at which panel k's clip starts (k ≥ 1)
  const ZOOM = 0.12; // extra scale a clip starts from; it eases back to 1 across the panel's life
  // the last clip ends CLIP_AT after the strip has come to rest on the last panel
  const seqEnd = clipStart(changes) + 1;
  // Finale: as the strip comes to rest, the last panel spreads out to the whole screen while its
  // clip plays out.
  const OUTRO_END = seqEnd + 0.15;
  const travel = FILL + OUTRO_END * STEP + HOLD;

  // The drawn state chases the scroll position instead of jumping with it, so wheel steps
  // and trackpad flicks glide. SMOOTH is the time constant of that chase, in ms.
  const SMOOTH = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140;

  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const smoothstep = (t) => t * t * (3 - 2 * t);

  section.classList.add('is-scrolling');
  section.style.setProperty('--track', `${(1 + travel) * 100}vh`);

  // Position of the strip, in panels: 0 = title in the box, 1 = first image, …
  function stripAt(seq) {
    if (seq >= changes) return changes;
    const k = Math.floor(seq);
    return k + ease(seq - k);
  }

  // where the scroll position says we should be
  function target() {
    const scrolled = -section.getBoundingClientRect().top / window.innerHeight; // past the moment the stage sticks
    return {
      // the title panel grows to full size as the section rises into view, done as it sticks
      enter: clamp(1 + scrolled),
      // the fill starts just before the stage sticks, so it plays out in full view
      fill: clamp((scrolled + 0.15) / (FILL + 0.15)),
      // progress bar: from the start of the title fill to the start of the finale
      progress: clamp((scrolled + 0.15) / (FILL + 0.15 + changes * STEP)),
      // position along the sequence, in changes of panel
      seq: clamp((scrolled - FILL) / STEP, 0, OUTRO_END),
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

  // the part of each clip where the line crosses the frame, in seconds
  const lines = videos.map((video) => video && video.dataset.line.split(' ').map(Number));

  function scrub(seq, strip) {
    let synced = true;
    videos.forEach((video, k) => {
      if (!video) return;
      const [from, to] = lines[k];
      // The first clip has no line to take over, so as its panel slides in from the right it
      // plays its opening too, where the line first appears (0 → `from`).
      const t = k === 1 && seq < clipStart(1)
        ? from * (seq / clipStart(1))
        : from + clamp(seq - clipStart(k)) * (to - from);
      wanted.set(video, Math.round(t / FRAME) * FRAME);
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

  // the title panel starts at ENTER_SIZE of the box as the section enters and grows to full size
  // over the whole rise, settling just as the stage sticks
  const ENTER_SIZE = 0.83;

  function draw({ enter, fill, progress: done, seq }) {
    const strip = stripAt(seq);
    title.style.setProperty('--fill', fill);
    const synced = scrub(seq, strip);

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
    const outro = smoothstep(clamp((seq - changes) / (OUTRO_END - changes)));
    const last = panels[changes];
    const bleedX = box.offsetLeft * outro;
    const bleedY = box.offsetTop * outro;
    last.style.inset = `${-bleedY}px ${-bleedX}px`;
    last.style.width = last.style.height = 'auto';
    track.style.setProperty('--bleed-x', `${bleedX}px`);
    track.style.setProperty('--bleed-y', `${bleedY}px`);
    progress.style.setProperty('--progress', done.toFixed(4));
    progress.style.setProperty('--progress-fade', (1 - outro).toFixed(3));
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
