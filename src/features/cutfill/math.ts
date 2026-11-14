import { Point, NodeData, DetailedResults, CellPolygons, CalculationStep } from './types';

interface CellCorners {
  tl: NodeData;
  tr: NodeData;
  br: NodeData;
  bl: NodeData;
}

export const MathEngine = {
  // Shoelace Formula for Area
  calculatePolygonArea: (vertices: Point[]): number => {
    if (vertices.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }
    return Math.abs(area) / 2;
  },

  // Calculate Average Height of a polygon based on the 'val' (diff) of its vertices
  calculatePolygonAvgHeight: (vertices: Point[]): number => {
    if (vertices.length === 0) return 0;
    const sum = vertices.reduce((acc, p) => acc + Math.abs(p.val), 0);
    return sum / vertices.length;
  },

  // Interpolate between two points to find where value is 0
  interpolate: (p1: Point, p2: Point, label: string): Point => {
    const v1 = p1.val;
    const v2 = p2.val;
    
    // Avoid division by zero if values are equal (shouldn't happen if signs differ)
    let t = 0.5;
    if (Math.abs(v1 - v2) > 1e-9) {
        t = Math.abs(v1) / (Math.abs(v1) + Math.abs(v2));
    }
    
    return {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t,
        val: 0,
        label
    };
  },

  // Main function: Marching Squares
  // Updated to accept cellWidth for real-world scaling and step generation
  getCellPolygons: (corners: CellCorners, cellWidth: number): { polygons: CellPolygons, nodes: Point[], results: DetailedResults } => {
    // 1. Define corners (0-100 normalized coordinates)
    const tl: Point = { x: 0, y: 0, val: corners.tl.planned - corners.tl.existing, label: "TL" };
    const tr: Point = { x: 100, y: 0, val: corners.tr.planned - corners.tr.existing, label: "TR" };
    const br: Point = { x: 100, y: 100, val: corners.br.planned - corners.br.existing, label: "BR" };
    const bl: Point = { x: 0, y: 100, val: corners.bl.planned - corners.bl.existing, label: "BL" };

    const nodes = [tl, tr, br, bl];
    const steps: CalculationStep[] = [];
    const zeroLines: Point[][] = []; 
    
    // Calculate scaling factor from 100x100 grid to real meters
    // Area scale: (cellWidth * cellWidth) / (100 * 100)
    const areaScale = (cellWidth * cellWidth) / 10000;

    // 2. Check for empty/zero cell
    const allZero = nodes.every(n => Math.abs(n.val) < 0.0001);
    if (allZero) {
        return {
            polygons: { cut: [], fill: [] },
            nodes,
            results: {
                realCutArea: 0, realFillArea: 0, cutAvgH: 0, fillAvgH: 0, cutVol: 0, fillVol: 0, steps: [], zeroLines: []
            }
        };
    }

    // 3. Determine Case ID (Bitmask)
    const threshold = 0;
    const bTL = tl.val >= threshold ? 1 : 0;
    const bTR = tr.val >= threshold ? 2 : 0;
    const bBR = br.val >= threshold ? 4 : 0;
    const bBL = bl.val >= threshold ? 8 : 0;
    const caseId = bTL | bTR | bBR | bBL;

    // 4. Calculate Zero Points on Edges
    const zTop = MathEngine.interpolate(tl, tr, "zTop");
    const zRight = MathEngine.interpolate(tr, br, "zRight");
    const zBottom = MathEngine.interpolate(br, bl, "zBottom");
    const zLeft = MathEngine.interpolate(bl, tl, "zLeft");

    const cutPolys: Point[][] = [];
    const fillPolys: Point[][] = [];

    const addFill = (pts: Point[]) => fillPolys.push(pts);
    const addCut = (pts: Point[]) => cutPolys.push(pts);

    // Logging helper
    const logZero = (p: Point, edge: string) => {
        steps.push({
            type: 'Interpolation',
            category: 'geometry',
            description: `Zero point on the ${edge} edge`,
            formula: `At ${p.x.toFixed(0)}%, ${p.y.toFixed(0)}% of the cell`,
            result: `${((p.x/100)*cellWidth).toFixed(2)} m, ${((p.y/100)*cellWidth).toFixed(2)} m`
        });
    };

    if ((bTL > 0) !== (bTR > 0)) logZero(zTop, "top");
    if ((bTR > 0) !== (bBR > 0)) logZero(zRight, "right");
    if ((bBR > 0) !== (bBL > 0)) logZero(zBottom, "bottom");
    if ((bBL > 0) !== (bTL > 0)) logZero(zLeft, "left");


    // 5. Generate Polygons based on Case ID
    switch (caseId) {
        case 0: addCut([tl, tr, br, bl]); break;
        case 1: addFill([tl, zTop, zLeft]); addCut([zLeft, zTop, tr, br, bl]); zeroLines.push([zLeft, zTop]); break;
        case 2: addFill([tr, zRight, zTop]); addCut([tl, zTop, zRight, br, bl]); zeroLines.push([zTop, zRight]); break;
        case 4: addFill([br, zBottom, zRight]); addCut([tl, tr, zRight, zBottom, bl]); zeroLines.push([zRight, zBottom]); break;
        case 8: addFill([bl, zLeft, zBottom]); addCut([tl, tr, br, zBottom, zLeft]); zeroLines.push([zBottom, zLeft]); break;
        case 3: addFill([tl, tr, zRight, zLeft]); addCut([zLeft, zRight, br, bl]); zeroLines.push([zLeft, zRight]); break;
        case 6: addFill([tr, br, zBottom, zTop]); addCut([tl, zTop, zBottom, bl]); zeroLines.push([zTop, zBottom]); break;
        case 12: addFill([br, bl, zLeft, zRight]); addCut([tl, tr, zRight, zLeft]); zeroLines.push([zRight, zLeft]); break;
        case 9: addFill([bl, tl, zTop, zBottom]); addCut([zTop, tr, br, zBottom]); zeroLines.push([zBottom, zTop]); break;
        case 5:
        {
            const avg = (tl.val + tr.val + br.val + bl.val) / 4;
            if (avg >= 0) {
                addFill([tl, zTop, zRight, br, zBottom, zLeft]); addCut([tr, zRight, zTop]); addCut([bl, zLeft, zBottom]);
                zeroLines.push([zTop, zRight], [zBottom, zLeft]);
            } else {
                addFill([tl, zTop, zLeft]); addFill([br, zBottom, zRight]); addCut([tr, zRight, zBottom, bl, zLeft, zTop]);
                zeroLines.push([zLeft, zTop], [zRight, zBottom]);
            }
            break;
        }
        case 10:
        {
            const avg = (tl.val + tr.val + br.val + bl.val) / 4;
            if (avg >= 0) {
                addFill([tr, zRight, zBottom, bl, zLeft, zTop]); addCut([tl, zTop, zLeft]); addCut([br, zBottom, zRight]);
                zeroLines.push([zTop, zLeft], [zBottom, zRight]);
            } else {
                addFill([tr, zRight, zTop]); addFill([bl, zLeft, zBottom]); addCut([tl, zTop, zRight, br, zBottom, zLeft]);
                zeroLines.push([zRight, zTop], [zLeft, zBottom]);
            }
            break;
        }
        case 7: addFill([tl, tr, br, zBottom, zLeft]); addCut([bl, zLeft, zBottom]); zeroLines.push([zLeft, zBottom]); break;
        case 11: addFill([tl, tr, zRight, zBottom, bl]); addCut([br, zBottom, zRight]); zeroLines.push([zBottom, zRight]); break;
        case 13: addFill([tl, zTop, zRight, br, bl]); addCut([tr, zRight, zTop]); zeroLines.push([zRight, zTop]); break;
        case 14: addFill([tr, br, bl, zLeft, zTop]); addCut([tl, zTop, zLeft]); zeroLines.push([zTop, zLeft]); break;
        case 15: addFill([tl, tr, br, bl]); break;
    }

    // 6. Calculate Results
    const results = {
        realCutArea: 0, realFillArea: 0, cutAvgH: 0, fillAvgH: 0, cutVol: 0, fillVol: 0, steps, zeroLines
    };

    // Helper to process polygon list
    const processPoly = (list: Point[][], isCut: boolean) => {
        list.forEach((poly, i) => {
            const rawArea = MathEngine.calculatePolygonArea(poly);
            const avgH = MathEngine.calculatePolygonAvgHeight(poly);
            const realArea = rawArea * areaScale;
            const vol = realArea * avgH;
            
            if (isCut) {
                results.realCutArea += realArea;
                results.cutVol += vol;
            } else {
                results.realFillArea += realArea;
                results.fillVol += vol;
            }

            // Detailed Steps Explanation
            const typeStr = isCut ? 'Cut' : 'Fill';
            
            results.steps.push({
                type: 'Triangle',
                category: isCut ? 'cut' : 'fill',
                description: `${typeStr} polygon ${i+1}`,
                formula: `${realArea.toFixed(4)} m² × ${avgH.toFixed(4)} m`,
                result: `${vol.toFixed(4)} m³`,
                area: realArea,
                avgH,
                vol
            });
        });
    };

    processPoly(cutPolys, true);
    processPoly(fillPolys, false);

    // Final weighted averages
    results.cutAvgH = results.realCutArea > 0 ? results.cutVol / results.realCutArea : 0;
    results.fillAvgH = results.realFillArea > 0 ? results.fillVol / results.realFillArea : 0;

    return {
        polygons: { cut: cutPolys, fill: fillPolys },
        nodes,
        results
    };
  }
};