import DxfParser from 'dxf-parser';
import { DxfParsed, ProfilePoint, Point3D, Segment2D, SectionLine, SectionProfilePoint } from './types';

export interface ExportLayers {
    ground: boolean;
    design: boolean;
    cut: boolean;
    fill: boolean;
}

export class DxfService {
    private parser: DxfParser;

    constructor() {
        this.parser = new DxfParser();
    }

    public async parseString(content: string): Promise<DxfParsed> {
        return new Promise((resolve, reject) => {
            try {
                if (!content) {
                    reject(new Error("File content is empty"));
                    return;
                }
                const parsed = this.parser.parseSync(content);
                if (!parsed) {
                    reject(new Error("Failed to parse DXF content"));
                    return;
                }
                resolve(parsed as unknown as DxfParsed);
            } catch (err) {
                reject(err);
            }
        });
    }

    public async parseFile(file: File): Promise<DxfParsed> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const fileContent = e.target?.result as string;
                    const parsed = await this.parseString(fileContent);
                    resolve(parsed);
                } catch (err) {
                    reject(err);
                }
            };

            reader.onerror = () => {
                reject(new Error("Error reading file"));
            };

            reader.readAsText(file);
        });
    }

    public extractLayers(dxf: DxfParsed): string[] {
        if (!dxf.tables || !dxf.tables.layer || !dxf.tables.layer.layers) {
             const layers = new Set<string>();
             dxf.entities.forEach(e => layers.add(e.layer));
             return Array.from(layers).sort();
        }
        return Object.keys(dxf.tables.layer.layers).sort();
    }

    // --- Profile Export ---
    public generateProfileDxf(
        points: ProfilePoint[], 
        cutPolys: Point3D[][], 
        fillPolys: Point3D[][], 
        designLine: { start: Point3D; end: Point3D },
        xScale: number = 0.1,
        yScale: number = 1.0,
        visibleLayers: ExportLayers = { ground: true, design: true, cut: true, fill: true }
    ): string {
        const lines: string[] = [];

        const add = (code: number, value: string | number) => {
            lines.push(String(code));
            lines.push(String(value));
        };

        const fmt = (val: number) => {
            if (isNaN(val) || !isFinite(val)) return "0.0000";
            return val.toFixed(4);
        };
        
        // Transform coordinates
        const tx = (val: number) => fmt(val * xScale);
        const ty = (val: number) => fmt(val * yScale);

        // --- HEADER SECTION (AC1009) ---
        add(0, 'SECTION');
        add(2, 'HEADER');
        add(9, '$ACADVER'); add(1, 'AC1009');
        add(9, '$INSUNITS'); add(70, 0); // Unitless
        add(0, 'ENDSEC');

        // --- TABLES SECTION ---
        add(0, 'SECTION');
        add(2, 'TABLES');

        // LTYPE Table
        add(0, 'TABLE');
        add(2, 'LTYPE');
        add(70, 2); 
            add(0, 'LTYPE'); add(2, 'CONTINUOUS'); add(70, 0); add(3, 'Solid line'); 
            add(72, 65); add(73, 0); add(40, 0.0);
            
            add(0, 'LTYPE'); add(2, 'DASHED'); add(70, 0); add(3, 'Dashed __ __ __'); 
            add(72, 65); add(73, 2); add(40, 1.0); add(49, 0.5); add(49, -0.5);
        add(0, 'ENDTAB');

        // LAYER Table
        add(0, 'TABLE');
        add(2, 'LAYER');
        add(70, 5);
        
        const addLayer = (name: string, color: number, ltype: string) => {
            add(0, 'LAYER');
            add(2, name);
            add(70, 0);
            add(62, color);
            add(6, ltype);
        };

        addLayer('0', 7, 'CONTINUOUS');
        addLayer('PROFILE_GROUND', 7, 'CONTINUOUS');
        addLayer('PROFILE_DESIGN', 5, 'DASHED');    
        addLayer('PROFILE_CUT', 1, 'CONTINUOUS');   
        addLayer('PROFILE_FILL', 3, 'CONTINUOUS');  
        
        add(0, 'ENDTAB');
        add(0, 'ENDSEC');

        // --- ENTITIES SECTION ---
        add(0, 'SECTION');
        add(2, 'ENTITIES');

        // 1. Solids
        const addSolid = (x1: number, y1_bot: number, y1_top: number, x2: number, y2_bot: number, y2_top: number, layer: string) => {
            add(0, 'SOLID');
            add(8, layer);
            add(10, tx(x1)); add(20, ty(y1_bot)); add(30, 0);
            add(11, tx(x2)); add(21, ty(y2_bot)); add(31, 0);
            add(12, tx(x1)); add(22, ty(y1_top)); add(32, 0);
            add(13, tx(x2)); add(23, ty(y2_top)); add(33, 0);
        };

        if ((visibleLayers.cut || visibleLayers.fill) && points.length > 1) {
            const startP = points[0];
            const endP = points[points.length - 1];
            const slope = (endP.elevation - startP.elevation) / (endP.distance - startP.distance);
            const getDes = (d: number) => startP.elevation + (d - startP.distance) * slope;

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i+1];
                
                const d1 = p1.distance;
                const d2 = p2.distance;
                const g1 = p1.elevation;
                const g2 = p2.elevation;
                const des1 = getDes(d1);
                const des2 = getDes(d2);

                const diff1 = g1 - des1;
                const diff2 = g2 - des2;

                const processTrapezoid = (xStart: number, yBot1: number, yTop1: number, xEnd: number, yBot2: number, yTop2: number, type: 'cut'|'fill') => {
                    if (type === 'cut' && visibleLayers.cut) {
                        addSolid(xStart, yBot1, yTop1, xEnd, yBot2, yTop2, 'PROFILE_CUT');
                    } else if (type === 'fill' && visibleLayers.fill) {
                        addSolid(xStart, yBot1, yTop1, xEnd, yBot2, yTop2, 'PROFILE_FILL');
                    }
                };

                if (Math.sign(diff1) !== Math.sign(diff2) && diff1 !== 0 && diff2 !== 0) {
                    const ratio = Math.abs(diff1) / (Math.abs(diff1) + Math.abs(diff2));
                    const dMid = d1 + ratio * (d2 - d1);
                    const gMid = g1 + ratio * (g2 - g1);
                    
                    processTrapezoid(d1, Math.min(g1, des1), Math.max(g1, des1), dMid, gMid, gMid, diff1 > 0 ? 'cut' : 'fill');
                    processTrapezoid(dMid, gMid, gMid, d2, Math.min(g2, des2), Math.max(g2, des2), diff2 > 0 ? 'cut' : 'fill');
                } else {
                    let type: 'cut'|'fill' = 'cut';
                    if (diff1 > 0 || diff2 > 0) type = 'cut';
                    else if (diff1 < 0 || diff2 < 0) type = 'fill';
                    else continue; 
                    processTrapezoid(d1, Math.min(g1, des1), Math.max(g1, des1), d2, Math.min(g2, des2), Math.max(g2, des2), type);
                }
            }
        }

        // 2. Outlines
        const addPolygon = (polys: Point3D[][], layer: string) => {
            for (const poly of polys) {
                if (poly.length < 3) continue;
                add(0, 'POLYLINE'); add(8, layer); add(66, 1); add(70, 1); add(10, 0); add(20, 0); add(30, 0);
                for (const v of poly) {
                    add(0, 'VERTEX'); add(8, layer); add(10, tx(v.x)); add(20, ty(v.y)); add(30, 0);
                }
                add(0, 'SEQEND'); add(8, layer);
            }
        };

        if (visibleLayers.cut) addPolygon(cutPolys, 'PROFILE_CUT');
        if (visibleLayers.fill) addPolygon(fillPolys, 'PROFILE_FILL');

        // 3. Design Line
        if (visibleLayers.design) {
            add(0, 'LINE'); add(8, 'PROFILE_DESIGN');
            add(10, tx(designLine.start.x)); add(20, ty(designLine.start.y)); add(30, 0);
            add(11, tx(designLine.end.x)); add(21, ty(designLine.end.y)); add(31, 0);
        }

        // 4. Ground
        if (visibleLayers.ground && points.length > 1) {
            add(0, 'POLYLINE'); add(8, 'PROFILE_GROUND'); add(66, 1); add(10, 0); add(20, 0); add(30, 0);
            for (const p of points) {
                add(0, 'VERTEX'); add(8, 'PROFILE_GROUND'); add(10, tx(p.distance)); add(20, ty(p.elevation)); add(30, 0);
            }
            add(0, 'SEQEND'); add(8, 'PROFILE_GROUND');
        }

        add(0, 'ENDSEC');
        add(0, 'EOF');
        return lines.join('\r\n') + '\r\n';
    }

    // --- FULL PROJECT EXPORT ---
    public generateProjectDxf(
        planData: { contours: Segment2D[], planned: Segment2D[], path: Segment2D[], pathLeft: Segment2D[], pathRight: Segment2D[], sections: SectionLine[] },
        profileData: { ground: ProfilePoint[], design: ProfilePoint[] },
        sectionsData: { meta: SectionLine, ground: SectionProfilePoint[], planned: SectionProfilePoint[], paths: { offset: number, elevation: number }[] }[],
        pathWidth: number
    ): string {
        const lines: string[] = [];
        const add = (code: number, value: string | number) => { lines.push(String(code)); lines.push(String(value)); };
        const fmt = (val: number) => (isNaN(val) ? "0.00" : val.toFixed(4));

        // --- HEADER ---
        add(0, 'SECTION'); add(2, 'HEADER');
        add(9, '$ACADVER'); add(1, 'AC1009');
        add(9, '$INSUNITS'); add(70, 0);
        add(0, 'ENDSEC');

        // --- TABLES ---
        add(0, 'SECTION'); add(2, 'TABLES');
        
        // Layers
        add(0, 'TABLE'); add(2, 'LAYER'); add(70, 10);
        const layers = [
            { n: 'PLAN_CONTOURS_EXISTING', c: 252 },
            { n: 'PLAN_CONTOURS_PLANNED', c: 30 },
            { n: 'PLAN_PATH_CENTER', c: 3 },
            { n: 'PLAN_PATH_EDGES', c: 4 },
            { n: 'PLAN_SECTIONS', c: 1 },
            { n: 'PROF_GROUND', c: 2 },
            { n: 'PROF_DESIGN', c: 1 },
            { n: 'XSEC_GROUND', c: 2 },
            { n: 'XSEC_PLANNED', c: 30 },
            { n: 'XSEC_PATH', c: 4 },
            { n: 'XSEC_GRID_MAJOR', c: 252 }, // Darker Gray (approx 105,105,105)
            { n: 'XSEC_GRID_MINOR', c: 254 }, // Lighter Gray (approx 200,200,200)
            { n: 'TEXT_LABELS', c: 7 }
        ];
        layers.forEach(l => {
            add(0, 'LAYER'); add(2, l.n); add(70, 0); add(62, l.c); add(6, 'CONTINUOUS');
        });
        add(0, 'ENDTAB');
        add(0, 'ENDSEC');

        // --- ENTITIES ---
        add(0, 'SECTION'); add(2, 'ENTITIES');

        const addLine = (p1: {x:number, y:number}, p2: {x:number, y:number}, layer: string) => {
            add(0, 'LINE'); add(8, layer);
            add(10, fmt(p1.x)); add(20, fmt(p1.y)); add(30, 0);
            add(11, fmt(p2.x)); add(21, fmt(p2.y)); add(31, 0);
        };

        const addText = (text: string, x: number, y: number, h: number, layer: string, rot: number = 0) => {
            add(0, 'TEXT'); add(8, layer);
            add(10, fmt(x)); add(20, fmt(y)); add(30, 0);
            add(40, fmt(h)); add(1, text); add(50, rot);
        };

        // 1. PLAN VIEW (Original Coords)
        planData.contours.forEach(s => addLine(s.p1, s.p2, 'PLAN_CONTOURS_EXISTING'));
        planData.planned.forEach(s => addLine(s.p1, s.p2, 'PLAN_CONTOURS_PLANNED'));
        planData.path.forEach(s => addLine(s.p1, s.p2, 'PLAN_PATH_CENTER'));
        planData.pathLeft.forEach(s => addLine(s.p1, s.p2, 'PLAN_PATH_EDGES'));
        planData.pathRight.forEach(s => addLine(s.p1, s.p2, 'PLAN_PATH_EDGES'));
        
        planData.sections.forEach(sec => {
            addLine(sec.p1, sec.p2, 'PLAN_SECTIONS');
            // Label - Smaller and closer to the line
            addText(`S-${sec.n}`, sec.p1.x, sec.p1.y + 0.5, 0.4, 'TEXT_LABELS');
        });

        // Calculate Plan Bounds to Offset other views
        let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
        planData.path.forEach(s => {
            minX = Math.min(minX, s.p1.x, s.p2.x); maxX = Math.max(maxX, s.p1.x, s.p2.x);
            minY = Math.min(minY, s.p1.y, s.p2.y); maxY = Math.max(maxY, s.p1.y, s.p2.y);
        });
        if (!isFinite(minX)) { minX=0; maxX=100; minY=0; maxY=100; }
        
        const PROFILE_OFFSET_X = maxX + 50;
        const PROFILE_OFFSET_Y = minY;

        // 2. LONGITUDINAL PROFILE
        addText("LONGITUDINAL PROFILE", PROFILE_OFFSET_X, PROFILE_OFFSET_Y + 50, 3, 'TEXT_LABELS');
        
        const drawProfilePoly = (pts: ProfilePoint[], layer: string) => {
            if(pts.length < 2) return;
            for(let i=0; i<pts.length-1; i++) {
                const p1 = pts[i];
                const p2 = pts[i+1];
                addLine(
                    { x: PROFILE_OFFSET_X + p1.distance, y: PROFILE_OFFSET_Y + p1.elevation },
                    { x: PROFILE_OFFSET_X + p2.distance, y: PROFILE_OFFSET_Y + p2.elevation },
                    layer
                );
            }
        };
        drawProfilePoly(profileData.ground, 'PROF_GROUND');
        drawProfilePoly(profileData.design, 'PROF_DESIGN');

        // 3. CROSS SECTIONS
        // Arrange in a grid below the Plan/Profile
        const GRID_START_Y = minY - 50;
        const GRID_START_X = minX;
        const COL_SPACING = 40;
        const ROW_SPACING = 30;
        const COLS = 5;

        sectionsData.forEach((sec, idx) => {
            const row = Math.floor(idx / COLS);
            const col = idx % COLS;
            
            const baseX = GRID_START_X + (col * COL_SPACING);
            const baseY = GRID_START_Y - (row * ROW_SPACING);

            // Calculate Extents for this section
            const allZ = [...sec.ground, ...sec.planned].map(p => p.elevation);
            
            // Default bounds if no data
            let minZ = 0, maxZ = 10;
            if (allZ.length > 0) {
                minZ = Math.floor(Math.min(...allZ)) - 1;
                maxZ = Math.ceil(Math.max(...allZ)) + 1;
            }

            // --- NORMALIZATION ---
            // Shift the section vertically so its minimum elevation aligns with the grid row base.
            // This prevents high-elevation sections (e.g. Z=500) from being drawn far away from their labels.
            const zDatum = minZ; 
            const transformY = (y: number) => baseY + (y - zDatum);

            const gridBottomY = transformY(minZ); // equals baseY
            const gridTopY = transformY(maxZ);

            // Title & Number - Closer to grid
            addText(`SEC ${sec.meta.n} (${sec.meta.distance.toFixed(1)}m)`, baseX, baseY - 2, 0.8, 'TEXT_LABELS');
            
            // GRID GENERATION
            const width = sec.meta.width;
            const minOffset = -width/2;
            const maxOffset = width/2;

            // Grid Box Border (Uniform Side)
            addLine({x: baseX + minOffset, y: gridBottomY}, {x: baseX + maxOffset, y: gridBottomY}, 'XSEC_GRID_MAJOR'); // Bottom
            addLine({x: baseX + minOffset, y: gridTopY},    {x: baseX + maxOffset, y: gridTopY},    'XSEC_GRID_MAJOR'); // Top
            addLine({x: baseX + minOffset, y: gridBottomY}, {x: baseX + minOffset, y: gridTopY},    'XSEC_GRID_MAJOR'); // Left
            addLine({x: baseX + maxOffset, y: gridBottomY}, {x: baseX + maxOffset, y: gridTopY},    'XSEC_GRID_MAJOR'); // Right

            // Horizontal Grid Lines (Elevation)
            for (let z = minZ; z <= maxZ; z += 0.5) {
                const isMajor = Math.abs(z % 1) < 0.1;
                const layer = isMajor ? 'XSEC_GRID_MAJOR' : 'XSEC_GRID_MINOR';
                const yPos = transformY(z);
                addLine(
                    { x: baseX + minOffset, y: yPos },
                    { x: baseX + maxOffset, y: yPos },
                    layer
                );
            }

            // Vertical Grid Lines (Offsets)
            for (let o = minOffset; o <= maxOffset; o += 0.5) {
                const isMajor = Math.abs(o % 1) < 0.1;
                const layer = isMajor ? 'XSEC_GRID_MAJOR' : 'XSEC_GRID_MINOR';
                addLine(
                    { x: baseX + o, y: gridBottomY },
                    { x: baseX + o, y: gridTopY },
                    layer
                );
            }

            // Ground Line
            for(let i=0; i<sec.ground.length-1; i++) {
                const p1 = sec.ground[i];
                const p2 = sec.ground[i+1];
                addLine(
                    { x: baseX + p1.offset, y: transformY(p1.elevation) },
                    { x: baseX + p2.offset, y: transformY(p2.elevation) },
                    'XSEC_GROUND'
                );
            }

            // Planned Line
            for(let i=0; i<sec.planned.length-1; i++) {
                const p1 = sec.planned[i];
                const p2 = sec.planned[i+1];
                addLine(
                    { x: baseX + p1.offset, y: transformY(p1.elevation) },
                    { x: baseX + p2.offset, y: transformY(p2.elevation) },
                    'XSEC_PLANNED'
                );
            }

            // Path Level Marker (Triangle)
            sec.paths.forEach(path => {
                const px = baseX + path.offset;
                const py = transformY(path.elevation);

                // Path Line (Surface)
                const halfW = pathWidth / 2;
                addLine(
                    { x: px - halfW, y: py },
                    { x: px + halfW, y: py },
                    'XSEC_PATH'
                );

                // Triangle pointing down - SMALLER SIZE
                add(0, 'SOLID'); add(8, 'XSEC_PATH');
                add(10, fmt(px - 0.25)); add(20, fmt(py + 0.5)); add(30, 0); // Top Left
                add(11, fmt(px + 0.25)); add(21, fmt(py + 0.5)); add(31, 0); // Top Right
                add(12, fmt(px));        add(22, fmt(py));       add(33, 0); // Bottom Tip
                add(13, fmt(px));        add(23, fmt(py));       add(33, 0); // Last point repeat
                
                // Text - CLOSER TO MARKER
                addText(path.elevation.toFixed(2), px, py + 0.8, 0.4, 'TEXT_LABELS');
            });
        });

        add(0, 'ENDSEC');
        add(0, 'EOF');
        return lines.join('\r\n') + '\r\n';
    }
}

export const dxfService = new DxfService();