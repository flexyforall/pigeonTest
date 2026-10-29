// The connectivity clips are dithered like the rest of the site's imagery (the Figma "Dither"
// effect: ordered Bayer 16×16, 3 levels per colour channel, one cell per CSS pixel). Each clip is
// redrawn through a WebGL shader onto a canvas laid over it; the video itself stays in place,
// invisible, and keeps being scrubbed by js/connectivity.js. Where WebGL is missing the clips
// simply show as they are.
(() => {
  const videos = [...document.querySelectorAll('.connectivity__img')].filter((v) => v.tagName === 'VIDEO');
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
    void main() {
      vec2 cell = floor(vec2(gl_FragCoord.x, size.y - gl_FragCoord.y));
      // object-fit: cover, centred, then the zoom
      float scale = max(size.x / videoSize.x, size.y / videoSize.y) * zoom;
      vec2 uv = (cell + 0.5 - size * 0.5) / (videoSize * scale) + 0.5;
      vec3 c = texture2D(video, clamp(uv, 0.0, 1.0)).rgb;
      float t = (texture2D(matrix, (mod(cell, 16.0) + 0.5) / 16.0).r * 255.0 + 0.5) / 256.0;
      float l = levels - 1.0;
      gl_FragColor = vec4(clamp(floor(c * l + t) / l, 0.0, 1.0), 1.0);
    }
  `;

  function setup(video) {
    const canvas = document.createElement('canvas');
    canvas.className = 'dither';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
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
    const uSize = u('size');
    const uVideoSize = u('videoSize');
    const uZoom = u('zoom');

    video.after(canvas);
    const media = video.parentElement;
    let last = '';

    return function draw() {
      if (video.readyState < 2 || !video.videoWidth) return;
      const w = Math.max(1, Math.round(media.clientWidth));
      const h = Math.max(1, Math.round(media.clientHeight));
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

  const draws = videos.map(setup).filter(Boolean);
  if (!draws.length) return;

  // redraw while the section is on screen: each clip only when its frame, size or zoom changed
  let running = false;
  const loop = () => {
    if (!running) return;
    draws.forEach((draw) => draw());
    requestAnimationFrame(loop);
  };
  const section = videos[0].closest('section') || document.body;
  new IntersectionObserver(([entry]) => {
    const was = running;
    running = entry.isIntersecting;
    if (running && !was) requestAnimationFrame(loop);
  }).observe(section);
})();
