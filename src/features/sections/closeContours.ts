import { DxfEntity } from './types';

// Rings (a hilltop, a pond, a loop trail) are closed shapes: the last point joins the first.
// The engine adds that closing segment only when an entity says `closed`, but the DXF reader
// reports a polyline's "closed" flag as `shape` — so on its own the engine never closed one.
//
// Two rules put that right before the engine sees the drawing:
//   1. A line the DXF flags as closed is closed. Always, on every layer.
//   2. A whole group of contour layers can be forced closed, for rings that were drawn
//      without the flag.

const CLOSABLE = new Set(['LWPOLYLINE', 'POLYLINE', 'SPLINE']);

const isClosable = (e: DxfEntity) => CLOSABLE.has(e.type.toUpperCase());

/** Does the DXF itself say this line is closed? */
export const isClosedInDxf = (e: DxfEntity) => isClosable(e) && Boolean(e.shape || e.closed);

/** Rule 1: carry the DXF's own closed flag over to the mark the engine reads. */
export const honorDxfClosed = (entities: DxfEntity[]): DxfEntity[] =>
    entities.map(e => (isClosedInDxf(e) && !e.closed ? { ...e, closed: true } : e));

/** Rule 2: close every polyline / spline on `layers`. Other entities are returned untouched. */
export const closeContours = (entities: DxfEntity[], layers: string[]): DxfEntity[] => {
    if (layers.length === 0) return entities;
    return entities.map(e => (layers.includes(e.layer) && isClosable(e) && !e.closed ? { ...e, closed: true } : e));
};

/** How the DXF describes the lines on `layers`: how many there are, and how many it flags as closed. */
export const describeContours = (entities: DxfEntity[], layers: string[]) => {
    let lines = 0;
    let closedInDxf = 0;
    for (const e of entities) {
        if (!layers.includes(e.layer) || !isClosable(e)) continue;
        lines++;
        if (isClosedInDxf(e)) closedInDxf++;
    }
    return { lines, closedInDxf };
};
