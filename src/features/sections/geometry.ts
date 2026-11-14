import { DxfEntity, Point3D, ProfilePoint, Segment2D, EarthworkStats, EarthworkPolygons, GeometryResult, ProcessingStep, BoundingBox, SectionLine, SectionProfilePoint } from './types';

const EPSILON = 1e-9;

// Euclidean distance in 2D
export const dist2D = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Distance from Point p to Line Segment vw
export const distancePointToSegment = (
    p: { x: number; y: number },
    v: { x: number; y: number },
    w: { x: number; y: number }
): number => {
    const l2 = Math.pow(dist2D(v, w), 2);
    if (l2 === 0) return dist2D(p, v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = {
        x: v.x + t * (w.x - v.x),
        y: v.y + t * (w.y - v.y)
    };
    return dist2D(p, projection);
};

// Line Segment Intersection with Tolerance
export const getIntersection = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number }
): { x: number; y: number } | null => {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    
    // Check parallel with epsilon
    if (Math.abs(d) < EPSILON) return null; 

    const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;

    // Check if intersection is within segments with epsilon tolerance
    if (u >= -EPSILON && u <= 1 + EPSILON && v >= -EPSILON && v <= 1 + EPSILON) {
        return {
            x: p1.x + u * (p2.x - p1.x),
            y: p1.y + u * (p2.y - p1.y)
        };
    }
    return null;
};

// --- Visualization Helper: Continuous Polylines ---
export const getRenderablePolylines = (entities: DxfEntity[]): Point3D[][] => {
    const polylines: Point3D[][] = [];

    for (const entity of entities) {
        const type = entity.type.toUpperCase();

        if (type === 'LWPOLYLINE' || type === 'POLYLINE') {
            if (entity.vertices && entity.vertices.length > 1) {
                const pts = entity.vertices.map(v => ({ x: v.x, y: v.y, z: v.z || entity.elevation || 0 }));
                
                // Ensure closure if flag is set, avoid duplicate points if already geometrically closed
                const first = pts[0];
                const last = pts[pts.length - 1];
                const isGeometricallyClosed = dist2D(first, last) < EPSILON;

                if (entity.closed && !isGeometricallyClosed) {
                    pts.push({ ...pts[0] });
                }
                polylines.push(pts);
            }
        } else if (type === 'LINE') {
            if (entity.startPoint && entity.endPoint) {
                polylines.push([entity.startPoint, entity.endPoint]);
            }
        } else if (type === 'ARC' || type === 'CIRCLE') {
            // Sampling logic similar to flattenEntities
            if (entity.center && entity.radius) {
                const cx = entity.center.x;
                const cy = entity.center.y;
                const r = entity.radius;
                const z = entity.center.z ?? (entity.elevation ?? 0);
                
                let startRad = 0;
                let sweepRad = Math.PI * 2;

                if (type === 'ARC' && entity.startAngle !== undefined && entity.endAngle !== undefined) {
                    startRad = (entity.startAngle * Math.PI) / 180;
                    let endRad = (entity.endAngle * Math.PI) / 180;
                    if (endRad < startRad) endRad += Math.PI * 2;
                    sweepRad = endRad - startRad;
                }

                const segs = Math.max(12, Math.ceil(Math.abs(sweepRad) * r / 2));
                const pts: Point3D[] = [];
                for (let i = 0; i <= segs; i++) {
                    const theta = startRad + (sweepRad * i) / segs;
                    pts.push({ 
                        x: cx + r * Math.cos(theta), 
                        y: cy + r * Math.sin(theta),
                        z 
                    });
                }
                polylines.push(pts);
            }
        } else if (type === 'SPLINE') {
             // Basic fallback to vertices/control points
             const raw = entity.vertices || entity.controlPoints;
             if (raw && raw.length > 1) {
                 const pts = raw.map(p => ({ x: p.x, y: p.y, z: p.z || 0 }));
                 
                 // Handle Spline Closure
                 const first = pts[0];
                 const last = pts[pts.length - 1];
                 const isGeometricallyClosed = dist2D(first, last) < EPSILON;
                 
                 // Check entity.closed or flag 70 bit 1 (if available in parsing, usually parser resolves to closed boolean)
                 if (entity.closed && !isGeometricallyClosed) {
                     pts.push({ ...pts[0] });
                 }
                 polylines.push(pts);
             }
        }
        // Add Ellipse logic if needed, but keeping it simple for now
    }
    return polylines;
};

// Convert DXF Entities to processable Segments
export const flattenEntities = (entities: DxfEntity[], isPath: boolean): Segment2D[] => {
    const segments: Segment2D[] = [];
    let cumulativeDist = 0;

    for (const entity of entities) {
        const type = entity.type.toUpperCase();

        // 1. Polylines (LWPOLYLINE, POLYLINE)
        if (type === 'LWPOLYLINE' || type === 'POLYLINE') {
            if (entity.vertices && entity.vertices.length > 1) {
                for (let i = 0; i < entity.vertices.length - 1; i++) {
                    const p1 = entity.vertices[i];
                    const p2 = entity.vertices[i + 1];
                    const len = dist2D(p1, p2);

                    const z = entity.elevation ?? 0;

                    segments.push({
                        p1: { x: p1.x, y: p1.y },
                        p2: { x: p2.x, y: p2.y },
                        cumulativeLengthStart: cumulativeDist,
                        z1: type === 'LWPOLYLINE' ? z : (p1.z ?? z),
                        z2: type === 'LWPOLYLINE' ? z : (p2.z ?? z),
                        isConstantZ: type === 'LWPOLYLINE'
                    });

                    if (isPath) cumulativeDist += len;
                }
                // Handle closed polylines
                if (entity.closed) {
                     const p1 = entity.vertices[entity.vertices.length - 1];
                     const p2 = entity.vertices[0];
                     const len = dist2D(p1, p2);
                     const z = entity.elevation ?? 0;
                     segments.push({
                        p1: { x: p1.x, y: p1.y },
                        p2: { x: p2.x, y: p2.y },
                        cumulativeLengthStart: cumulativeDist,
                         z1: type === 'LWPOLYLINE' ? z : (p1.z ?? z),
                         z2: type === 'LWPOLYLINE' ? z : (p2.z ?? z),
                         isConstantZ: type === 'LWPOLYLINE'
                     });
                     if (isPath) cumulativeDist += len;
                }
            }
        
        // 2. Lines
        } else if (type === 'LINE') {
            if (entity.startPoint && entity.endPoint) {
                const p1 = entity.startPoint;
                const p2 = entity.endPoint;
                const len = dist2D(p1, p2);

                segments.push({
                    p1: { x: p1.x, y: p1.y },
                    p2: { x: p2.x, y: p2.y },
                    cumulativeLengthStart: cumulativeDist,
                    z1: p1.z ?? 0,
                    z2: p2.z ?? 0,
                    isConstantZ: false
                });

                if (isPath) cumulativeDist += len;
            }

        // 3. Splines (Approximated by Control Points)
        } else if (type === 'SPLINE') {
            const points = entity.controlPoints || entity.vertices;
            if (points && points.length > 1) {
                 for (let i = 0; i < points.length - 1; i++) {
                     const p1 = points[i];
                     const p2 = points[i+1];
                     const len = dist2D(p1, p2);
                     
                     segments.push({
                         p1: { x: p1.x, y: p1.y },
                         p2: { x: p2.x, y: p2.y },
                         cumulativeLengthStart: cumulativeDist,
                         z1: p1.z ?? 0,
                         z2: p2.z ?? 0,
                         isConstantZ: false
                     });
                     
                     if (isPath) cumulativeDist += len;
                 }
                 // Handle closed Splines for processing if necessary, though flattening control points usually suffices for intersection if resolution is high. 
                 // Note: true spline interpolation is not implemented, just linear control polygon.
                 if (entity.closed) {
                     const p1 = points[points.length - 1];
                     const p2 = points[0];
                     const len = dist2D(p1, p2);
                     segments.push({
                         p1: { x: p1.x, y: p1.y },
                         p2: { x: p2.x, y: p2.y },
                         cumulativeLengthStart: cumulativeDist,
                         z1: p1.z ?? 0,
                         z2: p2.z ?? 0,
                         isConstantZ: false
                     });
                     if (isPath) cumulativeDist += len;
                 }
            }

        // 4. Arcs and Circles
        } else if (type === 'ARC' || type === 'CIRCLE') {
            if (entity.center && entity.radius) {
                const cx = entity.center.x;
                const cy = entity.center.y;
                const r = entity.radius;
                const z = entity.center.z ?? (entity.elevation ?? 0);
                
                let startRad = 0;
                let sweepRad = Math.PI * 2;

                // DXF Arcs use degrees (Group 50/51)
                if (type === 'ARC' && entity.startAngle !== undefined && entity.endAngle !== undefined) {
                    startRad = (entity.startAngle * Math.PI) / 180;
                    let endRad = (entity.endAngle * Math.PI) / 180;
                    
                    if (endRad < startRad) endRad += Math.PI * 2;
                    sweepRad = endRad - startRad;
                }

                // Discretize
                const segs = Math.max(12, Math.ceil(Math.abs(sweepRad) * r / 2)); // Adaptive resolution
                
                for (let i = 0; i < segs; i++) {
                    const theta1 = startRad + (sweepRad * i) / segs;
                    const theta2 = startRad + (sweepRad * (i + 1)) / segs;
                    
                    const p1 = { x: cx + r * Math.cos(theta1), y: cy + r * Math.sin(theta1) };
                    const p2 = { x: cx + r * Math.cos(theta2), y: cy + r * Math.sin(theta2) };
                    const len = dist2D(p1, p2);

                    segments.push({
                        p1, p2,
                        cumulativeLengthStart: cumulativeDist,
                        z1: z,
                        z2: z,
                        isConstantZ: true
                    });
                    if (isPath) cumulativeDist += len;
                }
            }

        // 5. Ellipses
        } else if (type === 'ELLIPSE') {
            if (entity.center && entity.majorAxisEndPoint && entity.axisRatio) {
                const cx = entity.center.x;
                const cy = entity.center.y;
                const mx = entity.majorAxisEndPoint.x;
                const my = entity.majorAxisEndPoint.y;
                const ratio = entity.axisRatio;
                
                // Minor axis vector (assuming 2D plane Z-normal)
                const nx = -my * ratio;
                const ny = mx * ratio;
                
                // DXF Ellipse parameters are in Radians (Group 41/42)
                let tStart = entity.startAngle ?? 0; 
                let tEnd = entity.endAngle ?? Math.PI * 2;
                if (tEnd < tStart) tEnd += Math.PI * 2;
                
                const dt = tEnd - tStart;
                const segs = Math.max(16, Math.ceil(dt * 10));

                const z = entity.center.z ?? 0;

                for(let i=0; i<segs; i++) {
                    const t1 = tStart + (dt * i)/segs;
                    const t2 = tStart + (dt * (i+1))/segs;
                    
                    const getP = (t: number) => ({
                        x: cx + mx * Math.cos(t) + nx * Math.sin(t),
                        y: cy + my * Math.cos(t) + ny * Math.sin(t)
                    });
                    
                    const p1 = getP(t1);
                    const p2 = getP(t2);
                    const len = dist2D(p1, p2);

                    segments.push({
                        p1, p2,
                        cumulativeLengthStart: cumulativeDist,
                        z1: z, z2: z,
                        isConstantZ: true
                    });
                    if (isPath) cumulativeDist += len;
                }
            }
        }
    }
    return segments;
};

// --- Offsetting Logic for Visuals ---
export const calculateOffsetSegments = (segments: Segment2D[], offset: number): Segment2D[] => {
    return segments.map(seg => {
        let dx = seg.p2.x - seg.p1.x;
        let dy = seg.p2.y - seg.p1.y;
        const mag = Math.sqrt(dx*dx + dy*dy);
        if (mag > EPSILON) {
            dx /= mag;
            dy /= mag;
        }
        // Perpendicular (Left)
        const nx = -dy;
        const ny = dx;
        
        return {
            ...seg,
            p1: { x: seg.p1.x + nx * offset, y: seg.p1.y + ny * offset },
            p2: { x: seg.p2.x + nx * offset, y: seg.p2.y + ny * offset }
        };
    });
};

// --- Local Sections Geometry ---
export const generateSectionLines = (
    pathSegments: Segment2D[],
    interval: number,
    width: number
): SectionLine[] => {
    const lines: SectionLine[] = [];
    if (pathSegments.length === 0 || interval <= 0) return lines;

    let currentDist = 0; // Cumulative distance at start of current segment
    
    // According to prompt: numbering starts from 1, i.e., 1*dist, 2*dist...
    // So the first line is at 'interval', not at 0.
    let nextTarget = interval;
    let n = 1;

    for (const seg of pathSegments) {
        const segLen = dist2D(seg.p1, seg.p2);
        
        // While the next target distance falls within this segment
        // Using EPSILON to handle floating point imprecision
        while (nextTarget <= currentDist + segLen + EPSILON) {
            // Calculate progress along segment (0 to 1)
            const distOnSeg = nextTarget - currentDist;
            
            // Clamp t to 0-1 range to handle epsilon errors at boundaries
            const t = Math.max(0, Math.min(1, distOnSeg / segLen));
            
            // Interpolate center position
            const cx = seg.p1.x + t * (seg.p2.x - seg.p1.x);
            const cy = seg.p1.y + t * (seg.p2.y - seg.p1.y);

            // Calculate segment direction vector (dx, dy)
            let dx = seg.p2.x - seg.p1.x;
            let dy = seg.p2.y - seg.p1.y;
            
            // Normalize
            const mag = Math.sqrt(dx*dx + dy*dy);
            if (mag > EPSILON) {
                dx /= mag;
                dy /= mag;
            }

            // Calculate Perpendicular vector (-dy, dx) for 2D
            // This rotates the vector 90 degrees counter-clockwise
            // Corresponds to LEFT side when facing the path direction
            const nx = -dy;
            const ny = dx;

            // Calculate endpoints based on width
            // P1 = Center + Left Vector (Left side)
            // P2 = Center - Left Vector (Right side)
            const w2 = width / 2;
            const px = nx * w2;
            const py = ny * w2;

            lines.push({
                id: lines.length,
                n: n,
                distance: nextTarget,
                center: { x: cx, y: cy },
                p1: { x: cx + px, y: cy + py },
                p2: { x: cx - px, y: cy - py },
                width: width
            });

            nextTarget += interval;
            n++;
        }

        currentDist += segLen;
    }

    return lines;
};

// Calculate profile data for a single section line
export const calculateSectionProfile = (
    section: SectionLine,
    contours: Segment2D[]
): SectionProfilePoint[] => {
    const points: SectionProfilePoint[] = [];
    
    // Section segment is from P1 (Left) to P2 (Right)
    const sP1 = section.p1;
    const sP2 = section.p2;

    for (const cSeg of contours) {
        const intersection = getIntersection(sP1, sP2, cSeg.p1, cSeg.p2);
        
        if (intersection) {
            // Calculate distance from P1 (Left Start)
            const distFromP1 = dist2D(sP1, intersection);
            
            // Convert to Offset from Center
            // Left is negative, Right is positive
            const offset = distFromP1 - (section.width / 2);

            // Calculate Elevation (Z)
            let elevation = 0;
            if (cSeg.isConstantZ) {
                elevation = cSeg.z1 ?? 0;
            } else {
                const segLen = dist2D(cSeg.p1, cSeg.p2);
                if (segLen < EPSILON) {
                    elevation = cSeg.z1 ?? 0;
                } else {
                    const distFromC1 = dist2D(cSeg.p1, intersection);
                    const ratio = distFromC1 / segLen;
                    elevation = (cSeg.z1 ?? 0) + ((cSeg.z2 ?? 0) - (cSeg.z1 ?? 0)) * ratio;
                }
            }

            points.push({ offset, elevation });
        }
    }

    // Sort by offset (Left to Right)
    return points.sort((a, b) => a.offset - b.offset);
};

// --- Arbitrary Cross Section (Linear Profile) ---
export const calculateLinearProfile = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    contours: Segment2D[]
): { distance: number; elevation: number }[] => {
    const points: { distance: number; elevation: number }[] = [];

    for (const cSeg of contours) {
        const intersection = getIntersection(p1, p2, cSeg.p1, cSeg.p2);
        
        if (intersection) {
            // Calculate distance from Start (P1)
            const distFromStart = dist2D(p1, intersection);
            
            // Calculate Elevation (Z)
            let elevation = 0;
            if (cSeg.isConstantZ) {
                elevation = cSeg.z1 ?? 0;
            } else {
                const segLen = dist2D(cSeg.p1, cSeg.p2);
                if (segLen < EPSILON) {
                    elevation = cSeg.z1 ?? 0;
                } else {
                    const distFromC1 = dist2D(cSeg.p1, intersection);
                    const ratio = distFromC1 / segLen;
                    elevation = (cSeg.z1 ?? 0) + ((cSeg.z2 ?? 0) - (cSeg.z1 ?? 0)) * ratio;
                }
            }

            points.push({ distance: distFromStart, elevation });
        }
    }

    // Sort by distance from start
    return points.sort((a, b) => a.distance - b.distance);
};

// Interpolation Helper for Merging Profiles
export const interpolateElevation = (points: SectionProfilePoint[], targetOffset: number): number | null => {
    if (points.length < 2) return null;

    // Extrapolation guard: only interpolate within range
    if (targetOffset < points[0].offset || targetOffset > points[points.length - 1].offset) return null;

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        if (targetOffset >= p1.offset && targetOffset <= p2.offset) {
            const range = p2.offset - p1.offset;
            if (range < EPSILON) return p1.elevation;
            const t = (targetOffset - p1.offset) / range;
            return p1.elevation + t * (p2.elevation - p1.elevation);
        }
    }
    return null;
};

// --- Longitudinal Design Helper ---
export const calculateDesignElevation = (
    distance: number,
    startDist: number,
    startElev: number,
    endDist: number,
    endElev: number
): number => {
    if (Math.abs(endDist - startDist) < EPSILON) return startElev;
    const slope = (endElev - startElev) / (endDist - startDist);
    return startElev + (distance - startDist) * slope;
};

export const getPathIntersections = (
    section: SectionLine,
    pathSegments: Segment2D[],
    designStart: { dist: number, elev: number },
    designEnd: { dist: number, elev: number }
): { offset: number, elevation: number, slope: number }[] => {
    const intersections: { offset: number, elevation: number, slope: number }[] = [];
    
    // Calculate path longitudinal slope for annotations
    const pathSlope = (designEnd.elev - designStart.elev) / (designEnd.dist - designStart.dist);

    for (const seg of pathSegments) {
        const pt = getIntersection(section.p1, section.p2, seg.p1, seg.p2);
        if (pt) {
            // Distance along path for Design Z
            const distOnSeg = dist2D(seg.p1, pt);
            const totalDist = seg.cumulativeLengthStart + distOnSeg;
            const elevation = calculateDesignElevation(totalDist, designStart.dist, designStart.elev, designEnd.dist, designEnd.elev);

            // Offset on section line (Distance from Center)
            const distFromP1 = dist2D(section.p1, pt);
            const offset = distFromP1 - (section.width / 2);
            
            intersections.push({ offset, elevation, slope: pathSlope });
        }
    }
    return intersections;
};


// --- Debugging Helpers ---

export const getEntitySummary = (entities: DxfEntity[]): string[] => {
    const counts: Record<string, number> = {};
    entities.forEach(e => {
        const type = e.type || 'UNKNOWN';
        counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => `${count} ${type}(s)`);
};

export const getBounds = (segments: Segment2D[]): BoundingBox | null => {
    if (segments.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    segments.forEach(seg => {
        minX = Math.min(minX, seg.p1.x, seg.p2.x);
        maxX = Math.max(maxX, seg.p1.x, seg.p2.x);
        minY = Math.min(minY, seg.p1.y, seg.p2.y);
        maxY = Math.max(maxY, seg.p1.y, seg.p2.y);
    });
    
    return { minX, maxX, minY, maxY };
};

const areBoundsOverlapping = (b1: BoundingBox, b2: BoundingBox): boolean => {
    return !(b1.maxX < b2.minX || b1.minX > b2.maxX || b1.maxY < b2.minY || b1.minY > b2.maxY);
};

// --- Main Generation Function ---

export const generateProfileData = (
    pathLayerName: string,
    contourLayerNames: string[],
    allEntities: DxfEntity[]
): GeometryResult => {
    const logs: ProcessingStep[] = [];
    const points: ProfilePoint[] = [];

    // 1. Entity Extraction
    const pathEntities = allEntities.filter(e => e.layer === pathLayerName);
    const contourEntities = allEntities.filter(e => contourLayerNames.includes(e.layer));

    logs.push({
        step: "Entity Extraction",
        status: pathEntities.length > 0 && contourEntities.length > 0 ? 'success' : 'error',
        message: `Found ${pathEntities.length} Path entities and ${contourEntities.length} Contour entities.`,
        details: [
            `Path Layer ('${pathLayerName}'): ${getEntitySummary(pathEntities).join(', ') || 'None'}`,
            `Contour Layers: ${getEntitySummary(contourEntities).join(', ') || 'None'}`
        ]
    });

    if (pathEntities.length === 0 || contourEntities.length === 0) {
        return { points: [], logs, success: false, error: 'Missing entities on selected layers.' };
    }

    // 2. Geometry Flattening
    const pathSegments = flattenEntities(pathEntities, true);
    const contourSegments = flattenEntities(contourEntities, false);

    logs.push({
        step: "Geometry Conversion",
        status: pathSegments.length > 0 && contourSegments.length > 0 ? 'success' : 'warning',
        message: `Converted to ${pathSegments.length} Path segments and ${contourSegments.length} Contour segments.`,
        details: [
            'Entities like Arcs, Circles, and Polylines are tessellated into linear segments for intersection.'
        ]
    });

    if (pathSegments.length === 0) {
        return { points: [], logs, success: false, error: 'Path resulted in 0 geometry segments.' };
    }

    // 3. Spatial Analysis (Bounds Check)
    const pathBounds = getBounds(pathSegments);
    const contourBounds = getBounds(contourSegments);

    if (pathBounds && contourBounds) {
        const overlapping = areBoundsOverlapping(pathBounds, contourBounds);
        logs.push({
            step: "Spatial Analysis",
            status: overlapping ? 'success' : 'error',
            message: overlapping ? "Path and Contour bounding boxes overlap." : "CRITICAL: Path and Contours do not overlap spatially.",
            details: [
                `Path Bounds: [${pathBounds.minX.toFixed(2)}, ${pathBounds.minY.toFixed(2)}] to [${pathBounds.maxX.toFixed(2)}, ${pathBounds.maxY.toFixed(2)}]`,
                `Contour Bounds: [${contourBounds.minX.toFixed(2)}, ${contourBounds.minY.toFixed(2)}] to [${contourBounds.maxX.toFixed(2)}, ${contourBounds.maxY.toFixed(2)}]`
            ]
        });

        if (!overlapping) {
            return { points: [], logs, success: false, error: 'Geometry does not overlap in 2D space.' };
        }
    }

    // 4. Intersect
    for (const pSeg of pathSegments) {
        for (const cSeg of contourSegments) {
            const intersection = getIntersection(pSeg.p1, pSeg.p2, cSeg.p1, cSeg.p2);

            if (intersection) {
                // Calculate Distance along path
                const distOnSegment = dist2D(pSeg.p1, intersection);
                const totalDist = pSeg.cumulativeLengthStart + distOnSegment;

                // Calculate Elevation (Z)
                let elevation = 0;
                if (cSeg.isConstantZ) {
                    elevation = cSeg.z1 ?? 0;
                } else {
                    // Interpolate Z
                    const segLen = dist2D(cSeg.p1, cSeg.p2);
                    if (segLen < EPSILON) {
                        elevation = cSeg.z1 ?? 0;
                    } else {
                        const distFromC1 = dist2D(cSeg.p1, intersection);
                        const ratio = distFromC1 / segLen;
                        elevation = (cSeg.z1 ?? 0) + ((cSeg.z2 ?? 0) - (cSeg.z1 ?? 0)) * ratio;
                    }
                }

                points.push({
                    distance: totalDist,
                    elevation: elevation,
                    layer: 'Computed'
                });
            }
        }
    }

    logs.push({
        step: "Intersection Calculation",
        status: points.length > 0 ? 'success' : 'error',
        message: `Calculated ${points.length} intersection points.`,
        details: points.length === 0 ? ["No valid intersections found despite spatial overlap. Check if lines cross exactly."] : []
    });

    if (points.length === 0) {
        return { points: [], logs, success: false, error: 'No intersections found between Path and Contours.' };
    }

    // 5. Sort and Deduplicate
    points.sort((a, b) => a.distance - b.distance);

    const uniquePoints: ProfilePoint[] = [];
    if (points.length > 0) {
        uniquePoints.push(points[0]);
        for (let i = 1; i < points.length; i++) {
            const prev = uniquePoints[uniquePoints.length - 1];
            const curr = points[i];
            if (curr.distance - prev.distance > EPSILON) {
                uniquePoints.push(curr);
            }
        }
    }

    return { points: uniquePoints, logs, success: true };
};

export const calculateEarthworkStats = (points: ProfilePoint[]): EarthworkStats => {
    if (points.length < 2) {
        return { cutArea: 0, fillArea: 0, netArea: 0, slopePercentage: 0, startElevation: 0, endElevation: 0 };
    }

    const startP = points[0];
    const endP = points[points.length - 1];
    
    // Design Line: Connects Start to End
    const totalDist = endP.distance - startP.distance;
    const elevDiff = endP.elevation - startP.elevation;
    const slope = totalDist !== 0 ? elevDiff / totalDist : 0;
    
    let cutArea = 0;
    let fillArea = 0;

    const getDesignElev = (d: number) => startP.elevation + (d - startP.distance) * slope;

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];

        const d1 = p1.distance;
        const d2 = p2.distance;
        const g1 = p1.elevation; // Ground 1
        const g2 = p2.elevation; // Ground 2
        
        const des1 = getDesignElev(d1);
        const des2 = getDesignElev(d2);

        // Diff at start and end of segment
        // diff = ground - design
        const diff1 = g1 - des1;
        const diff2 = g2 - des2;

        const width = d2 - d1;

        // Check if they cross
        if ((diff1 > 0 && diff2 < 0) || (diff1 < 0 && diff2 > 0)) {
            const ratio = Math.abs(diff1) / (Math.abs(diff1) + Math.abs(diff2));
            const w1 = width * ratio; // Width of first part
            const w2 = width * (1 - ratio); // Width of second part
            
            const a1 = 0.5 * w1 * Math.abs(diff1);
            const a2 = 0.5 * w2 * Math.abs(diff2);

            if (diff1 > 0) {
                cutArea += a1;
                fillArea += a2;
            } else {
                fillArea += a1;
                cutArea += a2;
            }
        } else {
            // Trapezoid
            const avgDiff = (diff1 + diff2) / 2;
            const area = Math.abs(avgDiff) * width;
            
            if (avgDiff > 0) {
                cutArea += area;
            } else {
                fillArea += area;
            }
        }
    }

    return {
        cutArea,
        fillArea,
        netArea: cutArea - fillArea,
        slopePercentage: (slope * 100),
        startElevation: startP.elevation,
        endElevation: endP.elevation
    };
};

export const generateEarthworkPolygons = (points: ProfilePoint[]): EarthworkPolygons => {
    if (points.length < 2) return { cutPolygons: [], fillPolygons: [], designLine: { start: {x:0, y:0, z:0}, end: {x:0, y:0, z:0} } };

    const start = points[0];
    const end = points[points.length-1];
    const slope = (end.elevation - start.elevation) / (end.distance - start.distance);
    const getDesignZ = (d: number) => start.elevation + (d - start.distance) * slope;

    const cutPolys: Point3D[][] = [];
    const fillPolys: Point3D[][] = [];

    // Augment points with intersection points
    let currentPoly: Point3D[] = [];
    let currentMode: 'cut' | 'fill' | null = null;

    const processSegment = (p1: {distance: number, elevation: number}, p2: {distance: number, elevation: number}) => {
        const z1_des = getDesignZ(p1.distance);
        const z2_des = getDesignZ(p2.distance);
        const diff1 = p1.elevation - z1_des;
        const diff2 = p2.elevation - z2_des;

        // Check for crossing
        let crossingPoint: {distance: number, elevation: number} | null = null;
        if ((diff1 > 0 && diff2 < 0) || (diff1 < 0 && diff2 > 0)) {
            const ratio = Math.abs(diff1) / (Math.abs(diff1) + Math.abs(diff2));
            const dist = p1.distance + ratio * (p2.distance - p1.distance);
            const elev = p1.elevation + ratio * (p2.elevation - p1.elevation); // Ground Z at crossing
            crossingPoint = { distance: dist, elevation: elev };
        }

        const segments = crossingPoint 
            ? [{pStart: p1, pEnd: crossingPoint}, {pStart: crossingPoint, pEnd: p2}]
            : [{pStart: p1, pEnd: p2}];

        for (const seg of segments) {
            const midDist = (seg.pStart.distance + seg.pEnd.distance) / 2;
            const midElev = (seg.pStart.elevation + seg.pEnd.elevation) / 2;
            const midDesign = getDesignZ(midDist);
            const mode = midElev > midDesign ? 'cut' : 'fill';

            if (mode !== currentMode) {
                // Finish current polygon
                if (currentPoly.length > 0 && currentMode) {
                    // Close the polygon by tracing back along design line
                    const lastG = currentPoly[currentPoly.length - 1];
                    const firstG = currentPoly[0];
                    currentPoly.push({ x: lastG.x, y: getDesignZ(lastG.x), z: 0 }); // Drop to design
                    currentPoly.push({ x: firstG.x, y: getDesignZ(firstG.x), z: 0 }); // Back to start design
                    
                    if (currentMode === 'cut') cutPolys.push([...currentPoly]);
                    else fillPolys.push([...currentPoly]);
                }
                // Start new
                currentPoly = [{x: seg.pStart.distance, y: seg.pStart.elevation, z: 0}];
                currentMode = mode;
            }

            // Add end point of segment
            currentPoly.push({x: seg.pEnd.distance, y: seg.pEnd.elevation, z: 0});
        }
    };

    for(let i=0; i<points.length-1; i++) {
        processSegment(points[i], points[i+1]);
    }

    // Close last
    if (currentPoly.length > 0 && currentMode) {
        const lastG = currentPoly[currentPoly.length - 1];
        const firstG = currentPoly[0];
        currentPoly.push({ x: lastG.x, y: getDesignZ(lastG.x), z: 0 });
        currentPoly.push({ x: firstG.x, y: getDesignZ(firstG.x), z: 0 });
        
        if (currentMode === 'cut') cutPolys.push([...currentPoly]);
        else fillPolys.push([...currentPoly]);
    }

    return {
        cutPolygons: cutPolys,
        fillPolygons: fillPolys,
        designLine: {
            start: { x: start.distance, y: start.elevation, z: 0 },
            end: { x: end.distance, y: end.elevation, z: 0 }
        }
    };
};