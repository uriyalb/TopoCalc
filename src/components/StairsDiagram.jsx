import React, { useEffect, useRef, useState } from "react";
import { fmtCm, fmtM } from "@/lib/stairs";

const PERSON_CM = 175;

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Blocky figure, 175 cm tall, feet centred on (x, y). `s` is px per cm.
function Person({ x, y, s, ghost = false }) {
  const fill = ghost ? "none" : "#000";
  const props = { fill, stroke: "#000", strokeWidth: ghost ? 1.5 : 0, strokeDasharray: ghost ? "3 3" : undefined, shapeRendering: "crispEdges" };
  const r = (cx, cy, w, h) => <rect x={x + cx * s} y={y - (cy + h) * s} width={w * s} height={h * s} {...props} />;
  return (
    <g>
      {r(-11, 151, 22, 24)}
      {r(-4, 145, 8, 6)}
      {r(-20, 85, 40, 60)}
      {r(-30, 90, 8, 52)}
      {r(22, 90, 8, 52)}
      {r(-18, 0, 15, 85)}
      {r(3, 0, 15, 85)}
    </g>
  );
}

const Label = ({ x, y, children, anchor = "middle", color = "#000", size = 11 }) => (
  <text
    x={x}
    y={y}
    textAnchor={anchor}
    fontSize={size}
    fontWeight="900"
    fill={color}
    stroke="#f7fee7"
    strokeWidth="3"
    paintOrder="stroke"
    style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}
  >
    {children}
  </text>
);

/** Side section of the whole stair, drawn to scale with a 1.75 m figure. */
export default function StairsDiagram({ stair, landingLength, availableRun }) {
  const [ref, width] = useWidth();
  const { riser, tread, flights, rise, run } = stair;

  const lead = 95; // lower ground before the first riser (cm)
  const tail = 110; // upper ground after the last riser (cm)
  const spanCm = lead + Math.max(run, availableRun ?? 0) + tail;
  const tallCm = Math.max(rise + PERSON_CM, PERSON_CM) + 25;
  const pad = { l: 8, r: 54, t: 10, b: 58 };
  const maxH = Math.min(440, Math.max(260, width * 0.8));
  const s = Math.min((width - pad.l - pad.r) / spanCm, (maxH - pad.t - pad.b) / tallCm);
  const height = tallCm * s + pad.t + pad.b;
  const offset = (width - pad.l - pad.r - spanCm * s) / 2; // centre short stairs
  const X = (cm) => pad.l + offset + (lead + cm) * s;
  const Y = (cm) => pad.t + (tallCm - cm) * s;

  // Walk the profile.
  const pts = [[-lead, 0], [0, 0]];
  const landings = [];
  let x = 0;
  let y = 0;
  flights.forEach((count, f) => {
    for (let i = 1; i <= count; i++) {
      y += riser;
      pts.push([x, y]);
      if (i < count) {
        x += tread;
        pts.push([x, y]);
      }
    }
    if (f < flights.length - 1) {
      landings.push({ from: x, to: x + landingLength, y });
      x += landingLength;
      pts.push([x, y]);
    }
  });
  const endX = Math.max(run, availableRun ?? 0) + tail;
  pts.push([endX, rise]);
  const groundY = Y(0) + 14;
  const d =
    `M ${X(-lead)} ${groundY} ` +
    pts.map(([px, py]) => `L ${X(px)} ${Y(py)}`).join(" ") +
    ` L ${X(endX)} ${groundY} Z`;

  const over = availableRun != null && run > availableRun + 1e-6;
  const dimY = groundY + 14;
  const dimX = X(endX) + 16;
  const tick = 5;

  return (
    <div ref={ref} className="bg-lime-50 border-4 border-black shadow-[4px_4px_0px_#000] overflow-hidden">
      <svg width={width} height={height} role="img" aria-label={`Section of a stair with ${stair.steps} steps`}>
        <defs>
          <pattern id="stair-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#84cc16" />
            <rect width="3" height="8" fill="#65a30d" />
          </pattern>
        </defs>

        <path d={d} fill="url(#stair-hatch)" stroke="#000" strokeWidth="3" strokeLinejoin="miter" shapeRendering="crispEdges" />

        {landings.map((l, i) =>
          (l.to - l.from) * s > 78 ? (
            <Label key={i} x={X((l.from + l.to) / 2)} y={Y(l.y) - 7} size={10}>
              Landing {fmtM(landingLength)} m
            </Label>
          ) : null
        )}

        {/* Scale figures: one at the bottom, a ghost at the top */}
        <Person x={X(-lead / 2)} y={Y(0)} s={s} />
        <Person x={X(run + tail / 2)} y={Y(rise)} s={s} ghost />
        <Label x={X(-lead / 2)} y={Y(PERSON_CM) - 6} size={10}>1.75 m</Label>

        {/* Available run limit */}
        {availableRun != null && (
          <g>
            <line x1={X(availableRun)} y1={pad.t} x2={X(availableRun)} y2={groundY} stroke={over ? "#dc2626" : "#000"} strokeWidth="2" strokeDasharray="6 5" />
            <Label x={X(availableRun) - 6} y={pad.t + 12} anchor="end" color={over ? "#dc2626" : "#000"} size={10}>
              Limit {fmtM(availableRun)} m
            </Label>
          </g>
        )}

        {/* Run dimension */}
        <g stroke="#000" strokeWidth="2">
          <line x1={X(0)} y1={dimY} x2={X(run)} y2={dimY} />
          <line x1={X(0)} y1={dimY - tick} x2={X(0)} y2={dimY + tick} />
          <line x1={X(run)} y1={dimY - tick} x2={X(run)} y2={dimY + tick} />
        </g>
        <Label x={X(run / 2)} y={dimY + 16} color={over ? "#dc2626" : "#000"}>Run {fmtM(run)} m</Label>

        {/* Rise dimension */}
        <g stroke="#000" strokeWidth="2">
          <line x1={dimX} y1={Y(0)} x2={dimX} y2={Y(rise)} />
          <line x1={dimX - tick} y1={Y(0)} x2={dimX + tick} y2={Y(0)} />
          <line x1={dimX - tick} y1={Y(rise)} x2={dimX + tick} y2={Y(rise)} />
        </g>
        <text
          transform={`translate(${dimX + 16} ${(Y(0) + Y(rise)) / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}
        >
          Rise {fmtM(rise)} m
        </text>
      </svg>
    </div>
  );
}

/** Close-up of two steps with a 28 cm shoe, so riser and tread can be judged at a glance. */
export function StepDetail({ riser, tread }) {
  const s = 2.6;
  const pad = { l: 104, t: 30, r: 16, b: 14 };
  const w = (tread * 2 + 14) * s + pad.l + pad.r;
  const h = (riser * 2 + 16) * s + pad.t + pad.b;
  const X = (cm) => pad.l + cm * s;
  const Y = (cm) => h - pad.b - cm * s;
  const d = `M ${X(-14)} ${Y(-5)} L ${X(-14)} ${Y(0)} L ${X(0)} ${Y(0)} L ${X(0)} ${Y(riser)} L ${X(tread)} ${Y(riser)} L ${X(tread)} ${Y(riser * 2)} L ${X(tread * 2)} ${Y(riser * 2)} L ${X(tread * 2)} ${Y(-5)} Z`;
  const shoe = 28;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto max-h-56" role="img" aria-label="Close-up of one step with a shoe for scale">
      <path d={d} fill="#84cc16" stroke="#000" strokeWidth="3" shapeRendering="crispEdges" />
      {/* shoe */}
      <g fill="#000" shapeRendering="crispEdges">
        <rect x={X(1.5)} y={Y(riser + 5)} width={shoe * s} height={5 * s} />
        <rect x={X(1.5)} y={Y(riser + 12)} width={11 * s} height={7 * s} />
      </g>
      {/* tread dimension */}
      <g stroke="#000" strokeWidth="2">
        <line x1={X(0)} y1={Y(riser * 2) - 12} x2={X(tread)} y2={Y(riser * 2) - 12} />
        <line x1={X(0)} y1={Y(riser * 2) - 17} x2={X(0)} y2={Y(riser * 2) - 7} />
        <line x1={X(tread)} y1={Y(riser * 2) - 17} x2={X(tread)} y2={Y(riser * 2) - 7} />
      </g>
      <text x={X(tread / 2)} y={Y(riser * 2) - 18} textAnchor="middle" fontSize="12" fontWeight="900">{fmtCm(tread)} CM</text>
      {/* riser dimension */}
      <g stroke="#000" strokeWidth="2">
        <line x1={X(-14) - 10} y1={Y(0)} x2={X(-14) - 10} y2={Y(riser)} />
        <line x1={X(-14) - 15} y1={Y(0)} x2={X(-14) - 5} y2={Y(0)} />
        <line x1={X(-14) - 15} y1={Y(riser)} x2={X(-14) - 5} y2={Y(riser)} />
        <line x1={X(-14) - 5} y1={Y(riser)} x2={X(0)} y2={Y(riser)} strokeDasharray="3 3" strokeWidth="1" />
      </g>
      <text x={X(-14) - 16} y={Y(riser / 2) + 4} textAnchor="end" fontSize="12" fontWeight="900">{fmtCm(riser)} CM</text>
    </svg>
  );
}
