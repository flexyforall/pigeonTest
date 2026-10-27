# pigeonTest

Hero section for PigeonM, built from the Figma design (`PigeonM`, node `182:12148`).

Plain HTML / CSS / JS, no build step:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

- `index.html` — markup
- `css/hero.css` — hero styles (design width 1440 × 810)
- `css/sections.css` — logos, benefits and connectivity sections
- `js/hero.js` — loader, intro animation and Business / Residential / Mobile switching
- `js/sections.js` — scroll-in reveal of the sections below the hero
- `js/connectivity.js` — scroll-driven "Connectivity without boundaries" sequence (Figma storyboard `228:3913`);
  its clips in `assets/connectivity/` are fetched whole and scrubbed by the scroll from memory,
  encoded with a keyframe every 4 frames and no B-frames so each seek is cheap
- `assets/` — images, icons and loader video exported from Figma

The loader video (`assets/video/loader.*`) plays once per tab session; its last
frame is `assets/img/hero-business-*.jpg`, which stays as the Business background.
With reduced motion enabled, or if the video can't start within 3 s, the hero
opens straight on that still image.
