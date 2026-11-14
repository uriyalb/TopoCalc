// Pan / zoom maths shared by the two plan drawings (Cross Sections, Free Section).
// World Y points up, SVG Y points down; the drawing is flipped around the bounds.

export interface PlanBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
}

export interface PlanViewState {
    zoom: number;
    pan: { x: number; y: number };
}

export interface ViewBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

export const EMPTY_BOUNDS: PlanBounds = { minX: 0, maxX: 100, minY: 0, maxY: 100, width: 100, height: 100 };

export const padBounds = (b: { minX: number; maxX: number; minY: number; maxY: number } | null): PlanBounds => {
    if (!b) return EMPTY_BOUNDS;
    const padding = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.1;
    return {
        minX: b.minX - padding,
        maxX: b.maxX + padding,
        minY: b.minY - padding,
        maxY: b.maxY + padding,
        width: (b.maxX - b.minX) + 2 * padding,
        height: (b.maxY - b.minY) + 2 * padding
    };
};

export const getViewBox = (bounds: PlanBounds, view: PlanViewState): ViewBox => {
    const w = bounds.width / view.zoom;
    const h = bounds.height / view.zoom;
    const cx = bounds.minX + bounds.width / 2;
    const cy = bounds.minY + bounds.height / 2;
    return { x: cx - (w / 2) - view.pan.x, y: cy - (h / 2) + view.pan.y, w, h };
};

export const viewBoxAttr = (vb: ViewBox) => `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

/** Drawing units per screen pixel. The SVG uses "xMidYMid meet", so the tighter axis wins. */
export const unitsPerPixel = (el: Element | null, vb: ViewBox): number => {
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return 1;
    return Math.max(vb.w / rect.width, vb.h / rect.height);
};

/** Screen position -> world coordinates, allowing for the letterboxing of "meet". */
export const clientToWorld = (el: Element | null, vb: ViewBox, bounds: PlanBounds, clientX: number, clientY: number) => {
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const k = unitsPerPixel(el, vb);
    const offsetX = (rect.width - vb.w / k) / 2;
    const offsetY = (rect.height - vb.h / k) / 2;
    const svgX = vb.x + (clientX - rect.left - offsetX) * k;
    const svgY = vb.y + (clientY - rect.top - offsetY) * k;
    return { x: svgX, y: (bounds.maxY + bounds.minY) - svgY };
};
