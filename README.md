# pigeonTest

Hero section for PigeonM, built from the Figma design (`PigeonM`, node `182:12148`).

Plain HTML / CSS / JS, no build step:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

- `index.html` — markup
- `css/hero.css` — styles (design width 1440 × 810)
- `js/hero.js` — loader, intro animation and Business ↔ Residential switching
- `assets/` — images, icons and loader video exported from Figma

On the first visit in a tab session a 3-2-1 countdown runs while the loader
video (`assets/video/loader.*`) downloads in full; "1" holds until it has.
Then the video plays; its last frame is `assets/img/hero-business.jpg`, which
stays as the Business background. With reduced motion enabled, or if the video
can't load within 12 s, the hero opens straight on that still image.
