import React from "react";

export default function TopographyBackground() {
  return (
    <div className="fixed inset-0 z-0 opacity-30">
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 1000"
      >
        <defs>
          <pattern
            id="contour-pattern"
            width="200"
            height="200"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(5)"
          >
            {/* Contour lines with pixelated style */}
            <path
              d="M0,50 L200,50"
              fill="none"
              stroke="#006400"
              strokeWidth="2"
              strokeLinecap="square"
              shapeRendering="crispEdges"
            />
            <path
              d="M0,100 L200,100"
              fill="none"
              stroke="#008000"
              strokeWidth="3"
              strokeLinecap="square"
              shapeRendering="crispEdges"
              strokeDasharray="8 4"
            />
            <path
              d="M0,150 L200,150"
              fill="none"
              stroke="#228B22"
              strokeWidth="2"
              strokeLinecap="square"
              shapeRendering="crispEdges"
            />

            {/* Pixelated squares */}
            <rect x="40" y="40" width="10" height="10" fill="#0B6E0B" shapeRendering="crispEdges" />
            <rect x="150" y="70" width="15" height="15" fill="#0B6E0B" shapeRendering="crispEdges" />
            <rect x="70" y="120" width="8" height="8" fill="#0B6E0B" shapeRendering="crispEdges" />
            <rect x="180" y="140" width="12" height="12" fill="#0B6E0B" shapeRendering="crispEdges" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#contour-pattern)" />
      </svg>
    </div>
  );
}