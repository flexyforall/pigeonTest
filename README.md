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

The loader video (`assets/video/loader.*`) plays once per tab session; its last
frame is `assets/img/hero-business.jpg`, which stays as the Business background.
With reduced motion enabled, or if the video can't start within 3 s, the hero
opens straight on that still image.
