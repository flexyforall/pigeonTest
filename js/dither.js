// The connectivity clips and the planet (the hero's, the loader's) are dithered like the rest of the site's imagery (the Figma "Dither"
// effect: ordered Bayer 16×16, 3 levels per colour channel, one cell per CSS pixel). Each clip is
// redrawn through a WebGL shader onto a canvas laid over it; the video itself stays in place,
// invisible, and keeps being scrubbed by js/connectivity.js. Where WebGL is missing the clips
// simply show as they are. The planet's clip is dark dots on white: it is inverted (and its
// faint dots lifted, data-dither-gain) into light grey dots before the dither, and the canvas is
// see-through between them.
(() => {
  const videos = [...document.querySelectorAll('.connectivity__img, .hero__planet-video, .loader__planet-video')].filter((v) => v.tagName === 'VIDEO');
  if (!videos.length) return;

  const LEVELS = 3;

  // the 16×16 Bayer matrix, as in the effect's source: rank 0…255 per cell
  function bayer(n) {
    if (n === 1) return [[0]];
    const small = bayer(n / 2);
    const m = n / 2;
    return Array.from({ length: n }, (_, y) =>
      Array.from({ length: n }, (_, x) => {
        const qx = Math.floor(x / m);
        const qy = Math.floor(y / m);
        const qoff = qy === 0 && qx === 0 ? 0 : qy === 0 && qx === 1 ? 2 : qy === 1 && qx === 0 ? 3 : 1;
        return small[y % m][x % m] * 4 + qoff;
      })
    );
  }
  const BAYER = new Uint8Array(bayer(16).flat());

  const VERTEX = `
    attribute vec2 pos;
    void main() { gl_Position = vec4(pos, 0.0, 1.0); }
  `;
  // c → floor(c·L + t) / L, with t the cell's Bayer threshold: the effect's
  // round((c + (t − 0.5) / L) · L) / L, written out
  const FRAGMENT = `
    precision mediump float;
    uniform sampler2D video;
    uniform sampler2D matrix;
    uniform vec2 size;      // canvas, in cells (CSS pixels)
    uniform vec2 videoSize; // the clip's own pixels
    uniform float zoom;     // the scroll-linked zoom on the clip
    uniform float levels;
    uniform float invert;   // 1: dark on light becomes light on dark
    uniform float gain;
    void main() {
      vec2 cell = floor(vec2(gl_FragCoord.x, size.y - gl_FragCoord.y));
      // object-fit: cover, centred, then the zoom
      float scale = max(size.x / videoSize.x, size.y / videoSize.y) * zoom;
      vec2 uv = (cell + 0.5 - size * 0.5) / (videoSize * scale) + 0.5;
      vec3 c = texture2D(video, clamp(uv, 0.0, 1.0)).rgb;
      // inverted, the clip's near-white paper must come out as true black, not a faint dither
      c = clamp((mix(c, 1.0 - c, invert) - 0.06 * invert) * gain, 0.0, 1.0);
      // inverted, it is a grey picture: dithered in grey, without the clip's colour noise
      c = mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), invert);
      float t = (texture2D(matrix, (mod(cell, 16.0) + 0.5) / 16.0).r * 255.0 + 0.5) / 256.0;
      float l = levels - 1.0;
      vec3 q = clamp(floor(c * l + t) / l, 0.0, 1.0);
      // inverted, black is see-through (premultiplied: light dots laid over the backdrop)
      gl_FragColor = mix(vec4(q, 1.0), vec4(q, q.r), invert);
    }
  `;

  function setup(video) {
    const canvas = document.createElement('canvas');
    canvas.className = 'dither';
    canvas.setAttribute('aria-hidden', 'true');
    const invert = !!video.dataset.ditherInvert;
    const gl = canvas.getContext('webgl', { alpha: invert, antialias: false, preserveDrawingBuffer: true });
    if (!gl) return null;

    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const texture = (unit, filter) => {
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    };
    texture(1, gl.NEAREST);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 16, 16, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, BAYER);
    texture(0, gl.LINEAR);

    const u = (name) => gl.getUniformLocation(program, name);
    gl.uniform1i(u('video'), 0);
    gl.uniform1i(u('matrix'), 1);
    gl.uniform1f(u('levels'), LEVELS);
    gl.uniform1f(u('invert'), invert ? 1 : 0);
    gl.uniform1f(u('gain'), Number(video.dataset.ditherGain) || 1);
    const uSize = u('size');
    const uVideoSize = u('videoSize');
    const uZoom = u('zoom');

    video.after(canvas);
    const media = video.parentElement;
    let last = '';

    return function draw() {
      if (!video.isConnected || video.readyState < 2 || !video.videoWidth) return;
      // one cell per pixel as shown, so a clip drawn smaller (the planet in the loader, on its
      // way into the hero) is dithered at that size rather than shrunk after
      const box = media.getBoundingClientRect();
      const w = Math.max(1, Math.round(box.width));
      const h = Math.max(1, Math.round(box.height));
      const zoom = parseFloat(video.style.getPropertyValue('--zoom')) || 1;
      const key = `${video.currentTime}|${w}|${h}|${zoom}`;
      if (key === last) return;
      last = key;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.activeTexture(gl.TEXTURE0);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      } catch {
        return;
      }
      gl.uniform2f(uSize, w, h);
      gl.uniform2f(uVideoSize, video.videoWidth, video.videoHeight);
      gl.uniform1f(uZoom, zoom);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      media.classList.add('is-dithered');
    };
  }

  // redraw while a clip's section is on screen: each clip only when its frame, size or zoom changed
  const groups = new Map();
  videos.forEach((video) => {
    const draw = setup(video);
    if (!draw) return;
    const section = video.closest('section') || document.body;
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(draw);
  });
  groups.forEach((draws, section) => {
    let running = false;
    const loop = () => {
      if (!running) return;
      draws.forEach((draw) => draw());
      requestAnimationFrame(loop);
    };
    new IntersectionObserver(([entry]) => {
      const was = running;
      running = entry.isIntersecting;
      if (running && !was) requestAnimationFrame(loop);
    }).observe(section);
  });
})();
