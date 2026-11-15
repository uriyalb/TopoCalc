import React, { useEffect, useRef } from "react";

// Every look-and-feel knob lives here.
const CONFIG = {
  // Grid spacing (CSS px) for sampling the height field. Finer = rounder
  // curves; it scales with screen area so phones and big monitors cost alike.
  cellMin: 8,
  cellMax: 13,
  cellTarget: 15000, // aim for roughly this many grid points
  scale: 1 / 560, // base noise frequency (lower = bigger landforms)
  octaves: 2,
  timeSpeed: 0.008, // how fast the terrain morphs (noise units per second)
  drift: [2.5, 1.5], // slow pan of the whole terrain, px per second
  levelStep: 0.2, // height between contour lines
  indexEvery: 5, // every Nth line is a thicker "index contour"
  line: { color: "77, 124, 15", alpha: 0.32, width: 1.1 }, // lime-700
  index: { color: "63, 98, 18", alpha: 0.5, width: 1.7 }, // lime-800
  smallLoopFade: [40, 220], // closed loops shorter than this (px) fade in/out instead of popping
  maxFps: 60,
  hill: {
    sigma: 120, // radius of the hill, px (shrinks on small screens, see sigmaScreen)
    sigmaScreen: 0.18, // ...to at most this fraction of the shorter screen side
    restRate: 1.0, // height added per second while the pointer rests on a spot
    moveRate: 0.002, // height added per px of travel
    max: 1.4, // soft cap on how tall the hill can grow
    follow: 9, // spring stiffness of the point the hill grows under (higher = tighter)
    rise: 0.45, // seconds for the hill to swell up (keeps the rings easing in)
    decay: 1.6, // seconds per e-fold of fade (flat again after ~5s)
  },
};

// ---- 3D simplex noise (Gustavson), seeded once per mount -------------------
function makeNoise3(seed = Math.random()) {
  const grad = new Int8Array([
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
    1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
    0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
  ]);
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

  // One simplex corner's contribution. Kept allocation-free: it runs ~100k times a frame.
  function corner(ii, jj, kk, dx, dy, dz, a, b, d) {
    let tt = 0.6 - dx * dx - dy * dy - dz * dz;
    if (tt <= 0) return 0;
    const g = (perm[ii + a + perm[jj + b + perm[kk + d]]] % 12) * 3;
    tt *= tt;
    return tt * tt * (grad[g] * dx + grad[g + 1] * dy + grad[g + 2] * dz);
  }

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
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    const n =
      corner(ii, jj, kk, x0, y0, z0, 0, 0, 0) +
      corner(ii, jj, kk, x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, i1, j1, k1) +
      corner(ii, jj, kk, x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3, i2, j2, k2) +
      corner(ii, jj, kk, x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3, 1, 1, 1);
    return 32 * n; // roughly [-1, 1]
  };
}

// ---- Marching squares → joined polylines ------------------------------------
// Crossing points are identified by the grid edge they sit on, so segments
// from neighbouring cells share endpoints and can be chained into lines.
// Buffers are typed arrays reused across levels and frames (no per-frame Maps).
function makeTracer(nx, ny) {
  const E = nx * ny * 2;
  const stamp = new Int32Array(E); // which pass last touched this edge
  const px = new Float32Array(E);
  const py = new Float32Array(E);
  const adjA = new Int32Array(E);
  const adjB = new Int32Array(E);
  const seen = new Int32Array(E);
  const touched = new Int32Array(E);
  let pass = 0;

  return function traceLevel(field, cell, level) {
    pass++;
    let nTouched = 0;

    const point = (id, x, y) => {
      if (stamp[id] !== pass) {
        stamp[id] = pass;
        px[id] = x;
        py[id] = y;
        adjA[id] = -1;
        adjB[id] = -1;
        touched[nTouched++] = id;
      }
      return id;
    };
    const attach = (a, b) => {
      if (adjA[a] === -1) adjA[a] = b; else adjB[a] = b;
    };
    const link = (a, b) => { attach(a, b); attach(b, a); };

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
        const T = () => point((j * nx + i) * 2, x + ((level - tl) / (tr - tl)) * cell, y);
        const R = () => point((j * nx + i + 1) * 2 + 1, x + cell, y + ((level - tr) / (br - tr)) * cell);
        const B = () => point(((j + 1) * nx + i) * 2, x + ((level - bl) / (br - bl)) * cell, y + cell);
        const L = () => point((j * nx + i) * 2 + 1, x, y + ((level - tl) / (bl - tl)) * cell);

        switch (code) {
          case 1: case 14: link(L(), B()); break;
          case 2: case 13: link(B(), R()); break;
          case 3: case 12: link(L(), R()); break;
          case 4: case 11: link(T(), R()); break;
          case 6: case 9: link(T(), B()); break;
          case 7: case 8: link(L(), T()); break;
          case 5: {
            if ((tl + tr + br + bl) / 4 > level) { link(L(), T()); link(B(), R()); }
            else { link(L(), B()); link(T(), R()); }
            break;
          }
          case 10: {
            if ((tl + tr + br + bl) / 4 > level) { link(T(), R()); link(L(), B()); }
            else { link(L(), T()); link(B(), R()); }
            break;
          }
          default: break;
        }
      }
    }

    const lines = [];
    const walk = (start) => {
      const line = [[px[start], py[start]]];
      seen[start] = pass;
      let cur = start;
      for (;;) {
        const a = adjA[cur];
        const b = adjB[cur];
        const next = a !== -1 && seen[a] !== pass ? a : b !== -1 && seen[b] !== pass ? b : -1;
        if (next === -1) {
          const closed = cur !== start && (a === start || b === start) && line.length > 2;
          return { line, closed };
        }
        seen[next] = pass;
        line.push([px[next], py[next]]);
        cur = next;
      }
    };
    // Open lines first (they start at the screen edge), then loops.
    for (let k = 0; k < nTouched; k++) {
      const id = touched[k];
      if (seen[id] !== pass && adjB[id] === -1) lines.push(walk(id));
    }
    for (let k = 0; k < nTouched; k++) {
      const id = touched[k];
      if (seen[id] !== pass) lines.push(walk(id));
    }
    return lines;
  };
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

// Total length of a polyline, in px.
function lineLength(pts, closed) {
  let len = 0;
  for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  if (closed && pts.length > 1) {
    const a = pts[pts.length - 1];
    len += Math.hypot(a[0] - pts[0][0], a[1] - pts[0][1]);
  }
  return len;
}

export default function ContourBackground({ className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const noise = makeNoise3();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { hill } = CONFIG;

    let w = 0;
    let h = 0;
    let cell = 10;
    let nx = 0;
    let ny = 0;
    let field = new Float32Array(0);
    let traceLevel = null;
    // The hill is a persistent height layer in screen space: the pointer paints
    // into `source`, which fades out; `swell` eases toward it so rings grow in.
    let source = new Float32Array(0);
    let swell = new Float32Array(0);
    let hillActive = false;
    let sigma = hill.sigma;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = Math.min(CONFIG.cellMax, Math.max(CONFIG.cellMin, Math.sqrt((w * h) / CONFIG.cellTarget)));
      // One extra cell of margin past each edge so lines run off-screen cleanly.
      nx = Math.ceil(w / cell) + 3;
      ny = Math.ceil(h / cell) + 3;
      field = new Float32Array(nx * ny);
      traceLevel = makeTracer(nx, ny);
      source = new Float32Array(nx * ny);
      swell = new Float32Array(nx * ny);
      hillActive = false;
      sigma = Math.min(hill.sigma, hill.sigmaScreen * Math.min(w, h));
    };

    // ---- Pointer -----------------------------------------------------------
    // Mouse/pen use pointer events; touch uses touch events, because a drag on
    // a phone turns into a scroll gesture and the browser cancels the pointer
    // stream after the first few moves, while touchmove keeps firing.
    const target = { x: 0, y: 0, down: false };
    const follower = { x: 0, y: 0, vx: 0, vy: 0, placed: false };

    const placeAt = (x, y) => {
      target.x = x;
      target.y = y;
      if (!target.down || !follower.placed) {
        // A new touch or the mouse entering: start right there, no streak across the screen.
        follower.x = x;
        follower.y = y;
        follower.vx = 0;
        follower.vy = 0;
        follower.placed = true;
      }
      target.down = true;
    };
    const onPointerMove = (e) => {
      if (e.pointerType === "touch") return;
      placeAt(e.clientX, e.clientY);
    };
    const onMouseLeave = () => { target.down = false; };
    const onTouch = (e) => {
      const t0 = e.touches[0];
      if (!t0) return;
      if (e.type === "touchstart") target.down = false; // jump to the new finger
      placeAt(t0.clientX, t0.clientY);
    };
    const onTouchEnd = (e) => {
      if (e.touches.length === 0) target.down = false;
    };

    // Add a Gaussian of the given total height at (x, y) into `source`.
    const paint = (x, y, amount) => {
      if (amount <= 0) return;
      const r = sigma * 3;
      const inv2s2 = 1 / (2 * sigma * sigma);
      // Grid point (i, j) sits at screen (i*cell - cell, j*cell - cell).
      const i0 = Math.max(0, Math.floor((x - r) / cell) + 1);
      const i1 = Math.min(nx - 1, Math.ceil((x + r) / cell) + 1);
      const j0 = Math.max(0, Math.floor((y - r) / cell) + 1);
      const j1 = Math.min(ny - 1, Math.ceil((y + r) / cell) + 1);
      for (let j = j0; j <= j1; j++) {
        const dy = j * cell - cell - y;
        const row = j * nx;
        for (let i = i0; i <= i1; i++) {
          const dx = i * cell - cell - x;
          source[row + i] += amount * Math.exp(-(dx * dx + dy * dy) * inv2s2);
        }
      }
      hillActive = true;
    };

    const stepHill = (dt) => {
      if (follower.placed) {
        // Critically damped spring: smooth start and stop, no overshoot.
        const k = hill.follow;
        const steps = Math.ceil(dt / (1 / 120));
        const sdt = dt / steps;
        let travelled = 0;
        for (let s = 0; s < steps; s++) {
          const ax = k * k * (target.x - follower.x) - 2 * k * follower.vx;
          const ay = k * k * (target.y - follower.y) - 2 * k * follower.vy;
          follower.vx += ax * sdt;
          follower.vy += ay * sdt;
          follower.x += follower.vx * sdt;
          follower.y += follower.vy * sdt;
          travelled += Math.hypot(follower.vx, follower.vy) * sdt;
        }
        if (target.down) paint(follower.x, follower.y, hill.restRate * dt + hill.moveRate * travelled);
      }
      if (!hillActive) return;
      const fade = Math.exp(-dt / hill.decay);
      const ease = 1 - Math.exp(-dt / hill.rise);
      let any = false;
      for (let k = 0; k < source.length; k++) {
        const s = source[k] * fade;
        source[k] = s;
        const v = swell[k] + (s - swell[k]) * ease;
        swell[k] = v;
        if (v > 1e-4 || s > 1e-4) any = true;
      }
      if (!any && !target.down) {
        source.fill(0);
        swell.fill(0);
        hillActive = false;
      }
    };

    const render = (t) => {
      const ox = t * CONFIG.drift[0] - cell;
      const oy = t * CONFIG.drift[1] - cell;
      const z = t * CONFIG.timeSpeed;

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
          const s = swell[j * nx + i];
          if (s > 0) v += hill.max * (1 - Math.exp(-s / hill.max));
          field[j * nx + i] = v;
        }
      }

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
      const [fadeFrom, fadeTo] = CONFIG.smallLoopFade;
      for (let n = Math.ceil(min / step); n * step < max; n++) {
        const isIndex = ((n % CONFIG.indexEvery) + CONFIG.indexEvery) % CONFIG.indexEvery === 0;
        const style = isIndex ? CONFIG.index : CONFIG.line;
        ctx.lineWidth = style.width;
        const full = `rgba(${style.color}, ${style.alpha})`;
        ctx.strokeStyle = full;
        ctx.beginPath();
        for (const { line, closed } of traceLevel(field, cell, n * step)) {
          if (line.length < 2) continue;
          const pts = chaikin(chaikin(chaikin(line, closed), closed), closed);
          if (closed) {
            // Tiny loops (a peak just appearing or vanishing) fade by size.
            const f = (lineLength(pts, true) - fadeFrom) / (fadeTo - fadeFrom);
            if (f <= 0) continue;
            if (f < 1) {
              ctx.save();
              ctx.strokeStyle = `rgba(${style.color}, ${style.alpha * f * f * (3 - 2 * f)})`;
              ctx.beginPath();
              strokeSmooth(ctx, pts, true);
              ctx.stroke();
              ctx.restore();
              continue;
            }
          }
          strokeSmooth(ctx, pts, closed);
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
    const minFrame = 1 / CONFIG.maxFps - 0.002;

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      if (acc < minFrame) return;
      const dt = acc;
      acc = 0;
      t += dt;
      stepHill(dt);
      render(t);
    };

    const onResize = () => {
      resize();
      render(t);
    };
    const onVisibility = () => {
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
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerdown", onPointerMove, { passive: true });
      document.addEventListener("mouseleave", onMouseLeave);
      window.addEventListener("touchstart", onTouch, { passive: true });
      window.addEventListener("touchmove", onTouch, { passive: true });
      window.addEventListener("touchend", onTouchEnd, { passive: true });
      window.addEventListener("touchcancel", onTouchEnd, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
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
