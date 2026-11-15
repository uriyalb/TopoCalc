import React, { useState } from "react";
import ContourBackground from "../components/ContourBackground";

// Mockup page for trying the animated contour background (stage only).
export default function BackgroundMockup() {
  const [showContent, setShowContent] = useState(true);

  return (
    <div className="min-h-screen bg-lime-100 relative overflow-hidden">
      <ContourBackground />

      <div className="relative z-10 container mx-auto px-4 py-10 md:py-16 pointer-events-none">
        {showContent && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-6xl font-black text-lime-800 mb-2 tracking-tight leading-none">
                TOPO CALCULATOR
              </h1>
              <p className="text-lime-700 text-base md:text-xl font-bold uppercase tracking-wide">
                Background mockup
              </p>
            </div>

            <div className="max-w-md mx-auto bg-lime-200 border-4 border-black rounded-lg shadow-[8px_8px_0px_#000] p-6 pointer-events-auto">
              <h2 className="text-xl font-black uppercase text-black mb-3">Sample card</h2>
              <p className="font-bold text-lime-900 mb-4">
                Move the mouse around the page: a hill rises behind the cursor and settles back
                a few seconds later. The terrain drifts on its own very slowly.
              </p>
              <label className="block text-sm font-black uppercase text-black mb-1">Slope (%)</label>
              <input
                className="w-full border-4 border-black rounded-md px-3 py-2 font-bold bg-white"
                placeholder="e.g. 5"
              />
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => setShowContent((v) => !v)}
        className="fixed bottom-4 left-4 z-20 bg-lime-500 hover:bg-lime-600 text-black font-black uppercase text-sm border-4 border-black rounded-lg shadow-[4px_4px_0px_#000] px-4 py-2"
      >
        {showContent ? "Hide sample content" : "Show sample content"}
      </button>
    </div>
  );
}
