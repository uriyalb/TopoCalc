import { DxfEntity } from './types';

// Contours drawn as rings (a hilltop, a pond) are closed shapes: the last point joins
// the first. The engine only adds that closing segment when an entity says `closed`,
// and the DXF reader never sets it for polylines (it reports the DXF flag as `shape`).
// So closing is a choice the user makes per group of contour layers.

const CLOSABLE = new Set(['LWPOLYLINE', 'POLYLINE', 'SPLINE']);

const isClosable = (e: DxfEntity) => CLOSABLE.has(e.type.toUpperCase());

/** Mark every polyline / spline on `layers` as closed. Other entities are returned untouched. */
export const closeContours = (entities: DxfEntity[], layers: string[]): DxfEntity[] => {
    if (layers.length === 0) return entities;
    return entities.map(e => (layers.includes(e.layer) && isClosable(e) && !e.closed ? { ...e, closed: true } : e));
};

/** How the DXF itself describes the lines on `layers`: how many there are, and how many are flagged closed. */
export const describeContours = (entities: DxfEntity[], layers: string[]) => {
    let lines = 0;
    let closedInDxf = 0;
    for (const e of entities) {
        if (!layers.includes(e.layer) || !isClosable(e)) continue;
        lines++;
        if (e.shape || e.closed) closedInDxf++;
    }
    return { lines, closedInDxf };
};
