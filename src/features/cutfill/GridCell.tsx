import React, { useMemo } from 'react';
import { NodeData, Point, ModalData, VisualConfig } from './types';
import { MathEngine } from './math';
import { COLORS } from '../shared/palette';

interface Corners {
  tl: NodeData;
  tr: NodeData;
  br: NodeData;
  bl: NodeData;
}

interface GridCellProps {
  r: number;
  c: number;
  corners: Corners;
  cellWidth: number;
  onShowDetails: (data: ModalData) => void;
  hasBackground: boolean;
  visualConfig: VisualConfig;
}

export const GridCell: React.FC<GridCellProps> = ({ r, c, corners, cellWidth, onShowDetails, hasBackground, visualConfig }) => {
  // Process Geometry with real-world scaling
  const { polygons, nodes, results } = useMemo(() => {
    return MathEngine.getCellPolygons(corners, cellWidth);
  }, [corners, cellWidth]);

  const getPath = (pts: Point[]) => {
    if (pts.length < 3) return '';
    return `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')} Z`;
  };

  const getLinePath = (pts: Point[]) => {
    if (pts.length < 2) return '';
    return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
  };

  const handleDetailsClick = () => {
    onShowDetails({
      id: `${r}-${c}`,
      r, c,
      polygons,
      nodes,
      results
    });
  };

  const hasData = results.cutVol > 0.0001 || results.fillVol > 0.0001;

  return (
    <div
      className="group relative h-full w-full overflow-visible"
      style={{
        borderColor: visualConfig.gridColor,
        borderWidth: '1px',
        borderStyle: 'solid',
        backgroundColor: hasBackground ? 'rgba(255,255,255,0.05)' : '#fbfef4'
      }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 z-10 h-full w-full" preserveAspectRatio="none">
        {/* Render Fill Polygons */}
        {polygons.fill.map((poly, i) => (
          <path
            key={`fill-${i}`}
            d={getPath(poly)}
            fill={visualConfig.fillColor}
            fillOpacity={visualConfig.fillOpacity}
            stroke="none"
          />
        ))}

        {/* Render Cut Polygons */}
        {polygons.cut.map((poly, i) => (
          <path
            key={`cut-${i}`}
            d={getPath(poly)}
            fill={visualConfig.cutColor}
            fillOpacity={visualConfig.cutOpacity}
            stroke="none"
          />
        ))}

        {/* Zero lines on top: where cut turns into fill */}
        {results.zeroLines.map((line, i) => (
          <path
            key={`zero-${i}`}
            d={getLinePath(line)}
            stroke={COLORS.ink}
            strokeWidth="1.5"
            strokeDasharray="5 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* Volumes in the middle of the cell; click for the working */}
      {hasData && (
        <button
          type="button"
          onClick={handleDetailsClick}
          title="Show the working"
          className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center border-2 border-black bg-white px-1.5 py-0.5 font-mono text-xs font-black leading-tight shadow-[2px_2px_0px_#000] group-hover:bg-lime-200"
        >
          {results.cutVol > 0.0001 && <span className="whitespace-nowrap" style={{ color: COLORS.cut }}>-{results.cutVol.toFixed(3)}</span>}
          {results.fillVol > 0.0001 && <span className="whitespace-nowrap" style={{ color: COLORS.fill }}>+{results.fillVol.toFixed(3)}</span>}
        </button>
      )}
    </div>
  );
};
