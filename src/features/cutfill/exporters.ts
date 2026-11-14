import { NodeData, GridSize, Point, VisualConfig } from './types';
import { MathEngine } from './math';

// Helper to match App.tsx labelling
const getNodeLabel = (r: number, c: number, totalCols: number) => {
    const colIndexFromLeft = totalCols - c;
    const colChar = String.fromCharCode(65 + colIndexFromLeft); // A, B, C...
    const rowNum = r + 1; // 1, 2, 3...
    return `${colChar}${rowNum}`;
};

export const Exporters = {
  // --- DXF Generator (R12 Compatible) ---
  generateDXF: (nodeData: NodeData[][], gridSize: GridSize, cellWidth: number) => {
    let dxf = "";
    const nl = "\r\n";
    
    // Header Section - R12
    dxf += `0${nl}SECTION${nl}2${nl}HEADER${nl}`;
    dxf += `9${nl}$ACADVER${nl}1${nl}AC1009${nl}`;
    dxf += `0${nl}ENDSEC${nl}`;
    
    // Tables Section (Layers)
    dxf += `0${nl}SECTION${nl}2${nl}TABLES${nl}`;
    dxf += `0${nl}TABLE${nl}2${nl}LAYER${nl}`;
    
    const layers = [
      { name: "0", color: 7 },
      { name: "GRID", color: 8 },
      { name: "CUT", color: 1 }, // Red
      { name: "FILL", color: 5 }, // Blue
      { name: "TEXT", color: 7 },
      { name: "TEXT_CUT", color: 1 },
      { name: "TEXT_FILL", color: 5 }
    ];

    layers.forEach(l => {
        // Layer Name, Flag (0), Color
        dxf += `0${nl}LAYER${nl}2${nl}${l.name}${nl}70${nl}0${nl}62${nl}${l.color}${nl}6${nl}CONTINUOUS${nl}`;
    });
    
    dxf += `0${nl}ENDTAB${nl}0${nl}ENDSEC${nl}`;

    // Entities Section
    dxf += `0${nl}SECTION${nl}2${nl}ENTITIES${nl}`;

    const addPolyline = (points: Point[], layer: string, closed = true) => {
        if (points.length < 2) return;
        dxf += `0${nl}POLYLINE${nl}`;
        dxf += `8${nl}${layer}${nl}`;
        dxf += `66${nl}1${nl}`; // Vertices follow flag
        dxf += `70${nl}${closed ? 1 : 0}${nl}`; // 1 = Closed
        dxf += `10${nl}0.0${nl}20${nl}0.0${nl}30${nl}0.0${nl}`; // Origin

        points.forEach(p => {
            dxf += `0${nl}VERTEX${nl}`;
            dxf += `8${nl}${layer}${nl}`;
            dxf += `10${nl}${p.x.toFixed(3)}${nl}`;
            dxf += `20${nl}${p.y.toFixed(3)}${nl}`;
            dxf += `30${nl}0.0${nl}`; // Z
        });
        
        dxf += `0${nl}SEQEND${nl}`;
        dxf += `8${nl}${layer}${nl}`;
    };

    // Enhanced addText with Alignment and Color support
    const addText = (x: number, y: number, text: string, height: number, layer: string, align: number = 0, color: number = 7) => {
        dxf += `0${nl}TEXT${nl}`;
        dxf += `8${nl}${layer}${nl}`;
        
        // Color
        dxf += `62${nl}${color}${nl}`;
        
        // Height and Text
        dxf += `40${nl}${height.toFixed(3)}${nl}`;
        dxf += `1${nl}${text}${nl}`;
        
        // Alignment
        if (align === 0) {
             // Left aligned: Use 10, 20
             dxf += `10${nl}${x.toFixed(3)}${nl}`;
             dxf += `20${nl}${y.toFixed(3)}${nl}`;
             dxf += `30${nl}0.0${nl}`;
        } else {
             // Right (2) or Center (1) or Middle (4): Use 11, 21 and set 72
             // Standard 10,20 usually 0,0 or same as 11,21 depending on parser, safer to zero or duplicate
             dxf += `10${nl}0.0${nl}20${nl}0.0${nl}30${nl}0.0${nl}`;
             dxf += `11${nl}${x.toFixed(3)}${nl}`;
             dxf += `21${nl}${y.toFixed(3)}${nl}`;
             dxf += `31${nl}0.0${nl}`;
             dxf += `72${nl}${align}${nl}`;
        }
    };
    
    // Helper to calculate centroid for text placement
    const getCentroid = (pts: Point[]): Point => {
        let sx = 0, sy = 0;
        pts.forEach(p => { sx += p.x; sy += p.y; });
        return { x: sx / pts.length, y: sy / pts.length, val: 0 };
    };

    // Iterate Cells
    for (let r = 0; r < gridSize.rows; r++) {
      for (let c = 0; c < gridSize.cols; c++) {
        const tl = nodeData[r][c+1];
        const tr = nodeData[r][c];
        const br = nodeData[r+1][c];
        const bl = nodeData[r+1][c+1];
        
        if (!tl || !tr || !br || !bl) continue;

        // Pass cellWidth to MathEngine (even if we transform manually later, MathEngine now needs it)
        const { polygons } = MathEngine.getCellPolygons({ tl, tr, br, bl }, cellWidth);

        // Global Offsets
        const offsetX = (gridSize.cols - 1 - c) * cellWidth;
        const offsetY = -r * cellWidth; 
        
        // Area scale factor (100x100 grid -> cellWidth x cellWidth)
        const areaScale = (cellWidth * cellWidth) / 10000;
        const volTextHeight = cellWidth * 0.05;

        // Transform Points
        const transform = (pts: Point[]) => pts.map(p => ({
            x: offsetX + (p.x / 100) * cellWidth,
            y: offsetY - (p.y / 100) * cellWidth,
            val: 0
        }));

        // Draw Cell Border (Grid)
        const cellRect = [
            { x: offsetX, y: offsetY, val: 0 },
            { x: offsetX + cellWidth, y: offsetY, val: 0 },
            { x: offsetX + cellWidth, y: offsetY - cellWidth, val: 0 },
            { x: offsetX, y: offsetY - cellWidth, val: 0 }
        ];
        addPolyline(cellRect, "GRID");

        // Draw Cut/Fill
        polygons.cut.forEach(poly => {
             if (poly.length > 2) {
                 addPolyline(transform(poly), "CUT");
                 
                 // Calculate Volume for this polygon
                 const rawArea = MathEngine.calculatePolygonArea(poly);
                 const avgH = MathEngine.calculatePolygonAvgHeight(poly);
                 const vol = rawArea * areaScale * avgH;
                 
                 // Add Volume Label
                 if (vol > 0.005) {
                    const center = transform([getCentroid(poly)])[0];
                    // Align 4 (Middle), Color 1 (Red)
                    addText(center.x, center.y, `-${vol.toFixed(2)}`, volTextHeight, "TEXT_CUT", 4, 1);
                 }
             }
        });
        polygons.fill.forEach(poly => {
             if (poly.length > 2) {
                 addPolyline(transform(poly), "FILL");
                 
                 // Calculate Volume for this polygon
                 const rawArea = MathEngine.calculatePolygonArea(poly);
                 const avgH = MathEngine.calculatePolygonAvgHeight(poly);
                 const vol = rawArea * areaScale * avgH;
                 
                 // Add Volume Label
                 if (vol > 0.005) {
                    const center = transform([getCentroid(poly)])[0];
                    // Align 4 (Middle), Color 5 (Blue)
                    addText(center.x, center.y, `+${vol.toFixed(2)}`, volTextHeight, "TEXT_FILL", 4, 5);
                 }
             }
        });
      }
    }

    // Add Nodes (Points)
    for (let r = 0; r <= gridSize.rows; r++) {
        for (let c = 0; c <= gridSize.cols; c++) {
             const x = (gridSize.cols - c) * cellWidth;
             const y = -r * cellWidth;
             
             const node = nodeData[r][c];
             if (node) {
                 const label = getNodeLabel(r, c, gridSize.cols);
                 const diff = node.planned - node.existing;
                 const diffStr = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
                 const existingStr = `(${node.existing.toFixed(2)})`; // Added parentheses
                 const plannedStr = node.planned.toFixed(2);
                 
                 // Reduced text height (was 0.15, now 0.08 for smaller text)
                 const textHeight = cellWidth * 0.08; 
                 const gap = textHeight * 0.8;

                 // --- DXF Layout (Cartesian) ---
                 // Top Right (Quad 1) -> Existing -> Left Aligned
                 addText(x + gap, y + gap, existingStr, textHeight, "TEXT", 0, 7);
                 
                 // Top Left (Quad 2) -> Label -> Right Aligned
                 addText(x - gap, y + gap, label, textHeight, "TEXT", 2, 7);

                 // Bottom Right (Quad 4) -> Planned -> Left Aligned
                 addText(x + gap, y - gap - textHeight, plannedStr, textHeight, "TEXT", 0, 7);

                 // Bottom Left (Quad 3) -> Diff -> Right Aligned
                 const diffColor = diff > 0 ? 5 : (diff < 0 ? 1 : 7); 
                 addText(x - gap, y - gap - textHeight, diffStr, textHeight, "TEXT", 2, diffColor);
                 
                 // Cross marker
                 const markerSize = textHeight * 0.3;
                 addPolyline([{x: x-markerSize, y, val:0}, {x: x+markerSize, y, val:0}], "GRID", false);
                 addPolyline([{x, y: y-markerSize, val:0}, {x, y: y+markerSize, val:0}], "GRID", false);
             }
        }
    }

    dxf += `0${nl}ENDSEC${nl}0${nl}EOF${nl}`;
    return dxf;
  },

  // --- SVG Generator ---
  generateSVG: (nodeData: NodeData[][], gridSize: GridSize, cellWidth: number, visualConfig: VisualConfig) => {
    const totalWidth = gridSize.cols * cellWidth;
    const totalHeight = gridSize.rows * cellWidth;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}">`;
    svg += `<defs><style>.grid{fill:none;stroke:${visualConfig.gridColor};stroke-width:${cellWidth/100}} .cut{fill:${visualConfig.cutColor};fill-opacity:${visualConfig.cutOpacity};stroke:${visualConfig.cutColor};stroke-width:${cellWidth/200}} .fill{fill:${visualConfig.fillColor};fill-opacity:${visualConfig.fillOpacity};stroke:${visualConfig.fillColor};stroke-width:${cellWidth/200}} .txt{font-family:sans-serif;font-size:${cellWidth/10}px}</style></defs>`;
    
    // Background rect
    svg += `<rect width="100%" height="100%" fill="white"/>`;

    // Iterate Cells
    for (let r = 0; r < gridSize.rows; r++) {
      for (let c = 0; c < gridSize.cols; c++) {
        const tl = nodeData[r][c+1];
        const tr = nodeData[r][c];
        const br = nodeData[r+1][c];
        const bl = nodeData[r+1][c+1];
        
        if (!tl || !tr || !br || !bl) continue;

        // Pass cellWidth to MathEngine
        const { polygons } = MathEngine.getCellPolygons({ tl, tr, br, bl }, cellWidth);

        // Global Coords (SVG Y Down)
        const offsetX = (gridSize.cols - 1 - c) * cellWidth;
        const offsetY = r * cellWidth;

        const transformStr = (pts: Point[]) => 
            pts.map(p => `${(offsetX + (p.x / 100) * cellWidth).toFixed(2)},${(offsetY + (p.y / 100) * cellWidth).toFixed(2)}`).join(" ");

        // Grid Box
        svg += `<rect x="${offsetX}" y="${offsetY}" width="${cellWidth}" height="${cellWidth}" class="grid" />`;

        polygons.fill.forEach(poly => {
            if (poly.length > 2) {
                 svg += `<polygon points="${transformStr(poly)}" class="fill" />`;
            }
        });
        
        polygons.cut.forEach(poly => {
            if (poly.length > 2) {
                 svg += `<polygon points="${transformStr(poly)}" class="cut" />`;
            }
        });
      }
    }

    // Nodes Text - Updated positions to match request
    for (let r = 0; r <= gridSize.rows; r++) {
        for (let c = 0; c <= gridSize.cols; c++) {
             const x = (gridSize.cols - c) * cellWidth;
             const y = r * cellWidth;
             const node = nodeData[r][c];
             if (node) {
                 const label = getNodeLabel(r, c, gridSize.cols);
                 const diff = node.planned - node.existing;
                 const diffStr = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
                 const existingStr = `(${node.existing.toFixed(2)})`; // Added parentheses

                 // SVG Y is down.
                 
                 // Top-Right: Existing (x + gap)
                 svg += `<text x="${x}" y="${y}" class="txt" text-anchor="start" dx="0.2em" dy="-0.2em" fill="black">${existingStr}</text>`;

                 // Top-Left: Label (x - gap)
                 svg += `<text x="${x}" y="${y}" class="txt" text-anchor="end" dx="-0.2em" dy="-0.2em" fill="black" font-weight="bold">${label}</text>`;

                 // Bottom-Right: Planned (x + gap)
                 svg += `<text x="${x}" y="${y}" class="txt" text-anchor="start" dx="0.2em" dy="0.9em" fill="#666" font-size="0.8em">${node.planned.toFixed(2)}</text>`;

                 // Bottom-Left: Diff (x - gap)
                 const diffColor = diff > 0 ? '#2563eb' : (diff < 0 ? '#dc2626' : '#9ca3af');
                 svg += `<text x="${x}" y="${y}" class="txt" text-anchor="end" dx="-0.2em" dy="0.9em" fill="${diffColor}" font-size="0.8em">${diffStr}</text>`;

                 // Dot
                 svg += `<circle cx="${x}" cy="${y}" r="${cellWidth/40}" fill="black" />`;
             }
        }
    }

    svg += `</svg>`;
    return svg;
  }
};