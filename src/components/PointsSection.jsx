import React, { useEffect, useRef, useState } from "react";

// Vertical exaggerations offered when a gentle slope would draw as a flat line.
const EXAGGERATIONS = [2, 5, 10, 20, 50, 100, 200, 500, 1000];
const MAX_RISE_PX = 150; // tallest the slope triangle may be
const MIN_RISE_PX = 24; // shortest it may be before the vertical is exaggerated

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const fmt = (v) => v.toFixed(2);

const Label = ({ x, y, children, anchor = "middle", size = 11, transform }) => (
  <text
    x={x}
    y={y}
    transform={transform}
    textAnchor={anchor}
    fontSize={size}
    fontWeight="900"
    fill="#000"
    stroke="#f7fee7"
    strokeWidth="3"
    paintOrder="stroke"
    style={{ letterSpacing: "0.03em" }}
  >
    {children}
  </text>
);

/** Spot level: a small downward triangle over the point with its level beside it. */
function Level({ x, y, value, anchor }) {
  const tx = anchor === "end" ? x - 8 : x + 8; // beside the marker, clear of a steep slope line
  return (
    <g>
      <path d={`M ${x - 5} ${y - 16} L ${x + 5} ${y - 16} L ${x} ${y - 8} Z`} fill="#000" />
      <Label x={tx} y={y - 20} anchor={anchor}>
        {fmt(value)}
      </Label>
    </g>
  );
}

/**
 * Side section through two points: the ground between them, their levels,
 * the horizontal distance and the height difference. Drawn to scale unless the
 * slope is too gentle to see, in which case the vertical is exaggerated and says so.
 */
export default function PointsSection({ z1, z2, distance, slope }) {
  const [ref, width] = useWidth();

  const run = Math.abs(distance);
  const rise = z2 - z1;
  const drop = Math.abs(rise);

  // The height dimension sits beside the higher point, where there is room for it.
  // The top leaves space for the scale tag above the levels.
  const up = rise >= 0;
  const pad = { l: up ? 56 : 104, r: up ? 104 : 56, t: 64, b: 58 };
  const lead = 22; // flat ground drawn beyond each point (px)
  const ground = 18; // depth of the hatched ground under the lower point (px)
  const plotW = Math.max(110, width - pad.l - pad.r - 2 * lead);

  // Metres -> pixels, the same on both axes unless exaggerated.
  let k = plotW / run;
  let ex = 1;
  if (drop * k > MAX_RISE_PX) {
    k = MAX_RISE_PX / drop; // steep: keep it to scale, draw the run shorter
  } else if (drop > 0 && drop * k < MIN_RISE_PX) {
    ex = EXAGGERATIONS.find((e) => drop * k * e >= MIN_RISE_PX) ?? EXAGGERATIONS[EXAGGERATIONS.length - 1];
  }
  const runPx = run * k;
  const risePx = drop * k * ex;

  const x0 = pad.l + lead + (plotW - runPx) / 2;
  const x1 = x0 + runPx;
  const base = Math.min(z1, z2);
  const Y = (z) => pad.t + risePx - (z - base) * k * ex;
  const y0 = Y(z1);
  const y1 = Y(z2);
  const bottom = pad.t + risePx + ground;
  const height = bottom + pad.b;

  const d = `M ${x0 - lead} ${y0} L ${x0} ${y0} L ${x1} ${y1} L ${x1 + lead} ${y1} L ${x1 + lead} ${bottom} L ${x0 - lead} ${bottom} Z`;

  // Height difference: dashed level lines out to a dimension beside the higher point.
  const tick = 5;
  const dimX = up ? x1 + lead + 20 : x0 - lead - 20;
  const out = up ? tick : -tick; // extension lines run just past the dimension
  const yHigh = Math.min(y0, y1);
  const yLow = Math.max(y0, y1);
  const xHigh = y0 < y1 ? x0 : x1;
  const xLow = y0 < y1 ? x1 : x0;

  // Horizontal distance under the ground.
  const runY = bottom + 16;

  // Slope value along the line, lifted off it.
  const angle = (Math.atan2(y1 - y0, runPx) * 180) / Math.PI;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;

  return (
    <div ref={ref} className="w-full min-w-0 bg-lime-50 border-4 border-black shadow-[4px_4px_0px_#000] overflow-hidden relative">
      <span className="absolute top-2 left-2 border-2 border-black bg-white px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
        {ex > 1 ? `Vertical ×${ex}` : "To scale"}
      </span>
      <svg width={width} height={height} className="block max-w-full" role="img" aria-label={`Section from ${fmt(z1)} m to ${fmt(z2)} m over ${fmt(run)} m, slope ${slope}%`}>
        <defs>
          <pattern id="points-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#84cc16" />
            <rect width="3" height="8" fill="#65a30d" />
          </pattern>
        </defs>

        <path d={d} fill="url(#points-hatch)" stroke="#000" strokeWidth="3" strokeLinejoin="miter" />

        {/* Height difference */}
        {drop > 0 && (
          <g stroke="#000">
            <line x1={xHigh} y1={yHigh} x2={dimX + out} y2={yHigh} strokeWidth="1" strokeDasharray="3 3" />
            <line x1={xLow} y1={yLow} x2={dimX + out} y2={yLow} strokeWidth="1" strokeDasharray="3 3" />
            <line x1={dimX} y1={yHigh} x2={dimX} y2={yLow} strokeWidth="2" />
            <line x1={dimX - tick} y1={yHigh} x2={dimX + tick} y2={yHigh} strokeWidth="2" />
            <line x1={dimX - tick} y1={yLow} x2={dimX + tick} y2={yLow} strokeWidth="2" />
          </g>
        )}
        {drop > 0 && (
          <Label x={up ? dimX + 9 : dimX - 9} y={(yHigh + yLow) / 2 + 4} anchor={up ? "start" : "end"}>
            Δh {fmt(drop)} m
          </Label>
        )}

        {/* The two points and their levels, labels pointing away from the slope */}
        <rect x={x0 - 4} y={y0 - 4} width="8" height="8" fill="#fff" stroke="#000" strokeWidth="2" />
        <rect x={x1 - 4} y={y1 - 4} width="8" height="8" fill="#fff" stroke="#000" strokeWidth="2" />
        <Level x={x0} y={y0} value={z1} anchor="end" />
        <Level x={x1} y={y1} value={z2} anchor="start" />

        {/* Slope */}
        <Label x={mx} y={my - 9} transform={`rotate(${angle} ${mx} ${my})`} size={12}>
          {slope}%
        </Label>

        {/* Horizontal distance */}
        <g stroke="#000" strokeWidth="2">
          <line x1={x0} y1={runY} x2={x1} y2={runY} />
          <line x1={x0} y1={runY - tick} x2={x0} y2={runY + tick} />
          <line x1={x1} y1={runY - tick} x2={x1} y2={runY + tick} />
        </g>
        <Label x={mx} y={runY + 18}>{fmt(run)} m</Label>
        {/* On a short run the names lean outwards so they don't collide */}
        <Label x={runPx < 110 ? x0 - 2 : x0} y={runY + 34} size={10} anchor={runPx < 110 ? "end" : "middle"}>POINT 1</Label>
        <Label x={runPx < 110 ? x1 + 2 : x1} y={runY + 34} size={10} anchor={runPx < 110 ? "start" : "middle"}>POINT 2</Label>
      </svg>
    </div>
  );
}
