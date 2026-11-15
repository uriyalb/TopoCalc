import React, { useEffect, useRef } from "react";

// Every look-and-feel knob lives here.
const CONFIG = {
  cell: 16, // grid spacing in CSS px for sampling the height field
  scale: 1 / 520, // base noise frequency (lower = bigger landforms)
  octaves: 2,
  timeSpeed: 0.009, // how fast the terrain morphs (noise units per second)
  drift: [2.5, 1.5], // slow pan of the whole terrain, px per second
  levelStep: 0.2, // height between contour lines
  indexEvery: 5, // every Nth line is a thicker "index contour"
  line: { color: "77, 124, 15", alpha: 0.32, width: 1.1 }, // lime-700
  index: { color: "63, 98, 18", alpha: 0.5, width: 1.7 }, // lime-800
  fps: 30,
  hill: {
    sigma: 110, // radius of one bump, px
    amplitude: 0.2, // height of one bump at full strength
    max: 0.95, // soft cap on how tall the hill can grow
    follow: 0.35, // seconds the hill lags behind the cursor
    rise: 0.35, // seconds for a bump to grow in
    decay: 1.5, // seconds per e-fold of fade (gone after ~4-5s)
    spawnEvery: 0.07, // seconds between bumps while the pointer moves
    maxBumps: 60,
  },
};

// ---- 3D simplex noise (Gustavson), seeded once per mount -------------------
function makeNoise3(seed = Math.random()) {
  const grad = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
  ];
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = Math.floor(seed * 2 ** 31) || 1;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const F3 = 1 / 3;
  const G3 = 1 / 6;

  return function noise(x, y, z) {
    const t = (x + y + z) * F3;
    const i = Math.floor(x + t);
    const j = Math.floor(y + t);
    const k = Math.floor(z + t);
    const t0 = (i + j + k) * G3;
    const x0 = x - (i - t0);
    const y0 = y - (j - t0);
    const z0 = z - (k - t0);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const offs = [
      [x0, y0, z0, 0, 0, 0],
      [x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, i1, j1, k1],
      [x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3, i2, j2, k2],
      [x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3, 1, 1, 1],
    ];
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    let n = 0;
    for (let c = 0; c < 4; c++) {
      const [dx, dy, dz, a, b, d] = offs[c];
      let tt = 0.6 - dx * dx - dy * dy - dz * dz;
      if (tt > 0) {
        const g = grad[perm[ii + a + perm[jj + b + perm[kk + d]]] % 12];
        tt *= tt;
        n += tt * tt * (g[0] * dx + g[1] * dy + g[2] * dz);
      }
    }
    return 32 * n; // roughly [-1, 1]
  };
}

// ---- Marching squares → joined polylines ------------------------------------
// Crossing points are identified by the grid edge they sit on, so segments
// from neighbouring cells share endpoints and can be chained into lines.
function traceLevel(field, nx, ny, cell, level) {
  const pts = new Map(); // edgeId -> [x, y]
  const adj = new Map(); // edgeId -> [neighbour ids]

  const hId = (i, j) => (j * nx + i) * 2;
  const vId = (i, j) => (j * nx + i) * 2 + 1;

  const point = (id, x, y) => {
    if (!pts.has(id)) pts.set(id, [x, y]);
    return id;
  };
  const link = (a, b) => {
    const la = adj.get(a);
    if (la) la.push(b); else adj.set(a, [b]);
    const lb = adj.get(b);
    if (lb) lb.push(a); else adj.set(b, [a]);
  };

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const tl = field[j * nx + i];
      const tr = field[j * nx + i + 1];
      const br = field[(j + 1) * nx + i + 1];
      const bl = field[(j + 1) * nx + i];
      const code =
        (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
      if (code === 0 || code === 15) continue;

      const x = i * cell;
      const y = j * cell;
      const lerp = (a, b) => (level - a) / (b - a);
      const T = () => point(hId(i, j), x + lerp(tl, tr) * cell, y);
      const R = () => point(vId(i + 1, j), x + cell, y + lerp(tr, br) * cell);
      const B = () => point(hId(i, j + 1), x + lerp(bl, br) * cell, y + cell);
      const L = () => point(vId(i, j), x, y + lerp(tl, bl) * cell);

      switch (code) {
        case 1: case 14: link(L(), B()); break;
        case 2: case 13: link(B(), R()); break;
        case 3: case 12: link(L(), R()); break;
        case 4: case 11: link(T(), R()); break;
        case 6: case 9: link(T(), B()); break;
        case 7: case 8: link(L(), T()); break;
        case 5: {
          const center = (tl + tr + br + bl) / 4 > level;
          if (center) { link(L(), T()); link(B(), R()); }
          else { link(L(), B()); link(T(), R()); }
          break;
        }
        case 10: {
          const center = (tl + tr + br + bl) / 4 > level;
          if (center) { link(T(), R()); link(L(), B()); }
          else { link(L(), T()); link(B(), R()); }
          break;
        }
        default: break;
      }
    }
  }

  const lines = [];
  const seen = new Set();
  const walk = (start) => {
    const line = [pts.get(start)];
    seen.add(start);
    let prev = -1;
    let cur = start;
    for (;;) {
      const next = adj.get(cur).find((n) => n !== prev && !seen.has(n));
      if (next === undefined) {
        // Closed if we came back next to the start.
        const closed = cur !== start && adj.get(cur).includes(start) && line.length > 2;
        return { line, closed };
      }
      seen.add(next);
      line.push(pts.get(next));
      prev = cur;
      cur = next;
    }
  };
  // Open lines first (they start at the screen edge), then loops.
  for (const [id, n] of adj) if (n.length === 1 && !seen.has(id)) lines.push(walk(id));
  for (const id of adj.keys()) if (!seen.has(id)) lines.push(walk(id));
  return lines;
}

// Chaikin corner cutting: rounds every corner.
function chaikin(line, closed) {
  const n = line.length;
  if (n < 3) return line;
  const out = [];
  if (!closed) out.push(line[0]);
  const last = closed ? n : n - 1;
  for (let k = 0; k < last; k++) {
    const a = line[k];
    const b = line[(k + 1) % n];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
    out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  if (!closed) out.push(line[n - 1]);
  return out;
}

// Draw through midpoints with quadratic curves so the line stays smooth.
function strokeSmooth(ctx, pts, closed) {
  const n = pts.length;
  if (n < 2) return;
  if (closed) {
    const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
    ctx.moveTo(m0[0], m0[1]);
    for (let k = 0; k < n; k++) {
      const p = pts[k];
      const q = pts[(k + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
  } else {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < n - 1; k++) {
      const p = pts[k];
      const q = pts[k + 1];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}

export default function ContourBackground({ className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const noise = makeNoise3();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { cell, hill } = CONFIG;

    let w = 0;
    let h = 0;
    let nx = 0;
    let ny = 0;
    let field = new Float32Array(0);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // One extra cell of margin past each edge so lines run off-screen cleanly.
      nx = Math.ceil(w / cell) + 3;
      ny = Math.ceil(h / cell) + 3;
      field = new Float32Array(nx * ny);
    };

    // Pointer state: the hill follows a lagging point and leaves fading bumps.
    const pointer = { x: 0, y: 0, active: false, moved: false };
    const follower = { x: 0, y: 0, init: false };
    let bumps = []; // { x, y, born }
    let spawnClock = 0;

    const onMove = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      pointer.moved = true;
      if (!follower.init) {
        follower.x = e.clientX;
        follower.y = e.clientY;
        follower.init = true;
      }
    };
    const onLeave = () => { pointer.active = false; };

    const bumpStrength = (age) => {
      const rise = 1 - Math.exp(-age / hill.rise);
      const fall = Math.exp(-Math.max(0, age - hill.rise) / hill.decay);
      return rise * fall;
    };

    const render = (t) => {
      const ox = (t * CONFIG.drift[0]) - cell;
      const oy = (t * CONFIG.drift[1]) - cell;
      const z = t * CONFIG.timeSpeed;

      // Base terrain.
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const x = (i * cell + ox) * CONFIG.scale;
          const y = (j * cell + oy) * CONFIG.scale;
          let v = 0;
          let amp = 1;
          let freq = 1;
          for (let o = 0; o < CONFIG.octaves; o++) {
            v += amp * noise(x * freq, y * freq, z * freq + o * 17.3);
            amp *= 0.45;
            freq *= 2.1;
          }
          field[j * nx + i] = v;
        }
      }

      // Mouse hill: sum bumps into a scratch layer, then soft-cap and add.
      if (bumps.length) {
        const hillLayer = new Float32Array(nx * ny);
        const r = hill.sigma * 3;
        const inv2s2 = 1 / (2 * hill.sigma * hill.sigma);
        for (const b of bumps) {
          const a = hill.amplitude * bumpStrength(t - b.born);
          if (a < 0.002) continue;
          // Grid point (i, j) sits at screen (i*cell - cell, j*cell - cell).
          const i0 = Math.max(0, Math.floor((b.x - r) / cell) + 1);
          const i1 = Math.min(nx - 1, Math.ceil((b.x + r) / cell) + 1);
          const j0 = Math.max(0, Math.floor((b.y - r) / cell) + 1);
          const j1 = Math.min(ny - 1, Math.ceil((b.y + r) / cell) + 1);
          for (let j = j0; j <= j1; j++) {
            const dy = j * cell - cell - b.y;
            for (let i = i0; i <= i1; i++) {
              const dx = i * cell - cell - b.x;
              hillLayer[j * nx + i] += a * Math.exp(-(dx * dx + dy * dy) * inv2s2);
            }
          }
        }
        for (let k = 0; k < field.length; k++) {
          const s = hillLayer[k];
          if (s > 0) field[k] += hill.max * (1 - Math.exp(-s / hill.max));
        }
      }

      // Contours.
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(-cell, -cell);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      let min = Infinity;
      let max = -Infinity;
      for (let k = 0; k < field.length; k++) {
        if (field[k] < min) min = field[k];
        if (field[k] > max) max = field[k];
      }
      const step = CONFIG.levelStep;
      for (let n = Math.ceil(min / step); n * step < max; n++) {
        const isIndex = ((n % CONFIG.indexEvery) + CONFIG.indexEvery) % CONFIG.indexEvery === 0;
        const style = isIndex ? CONFIG.index : CONFIG.line;
        ctx.strokeStyle = `rgba(${style.color}, ${style.alpha})`;
        ctx.lineWidth = style.width;
        ctx.beginPath();
        for (const { line, closed } of traceLevel(field, nx, ny, cell, n * step)) {
          if (line.length < 2) continue;
          strokeSmooth(ctx, chaikin(chaikin(chaikin(line, closed), closed), closed), closed);
        }
        ctx.stroke();
      }
      ctx.restore();
    };

    resize();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let t = Math.random() * 100; // random starting landscape
    const frameTime = 1 / CONFIG.fps;

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc < frameTime) return;
      const step = acc;
      acc = 0;
      t += step;

      if (follower.init) {
        const k = 1 - Math.exp(-step / hill.follow);
        follower.x += (pointer.x - follower.x) * k;
        follower.y += (pointer.y - follower.y) * k;
        spawnClock += step;
        const stillCatchingUp = Math.hypot(pointer.x - follower.x, pointer.y - follower.y) > 2;
        if (pointer.active && (pointer.moved || stillCatchingUp) && spawnClock >= hill.spawnEvery) {
          spawnClock = 0;
          bumps.push({ x: follower.x, y: follower.y, born: t });
          if (bumps.length > hill.maxBumps) bumps.shift();
        }
        pointer.moved = false;
      }
      bumps = bumps.filter((b) => bumpStrength(t - b.born) > 0.01 || t - b.born < hill.rise);

      render(t);
    };

    const onResize = () => {
      resize();
      render(t);
    };
    const onVisibility = () => {
      if (reduceMotion) return;
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    window.addEventListener("resize", onResize);
    if (reduceMotion) {
      render(t);
    } else {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
      document.addEventListener("visibilitychange", onVisibility);
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`fixed inset-0 z-0 pointer-events-none ${className}`}
    />
  );
}
