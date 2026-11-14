import React from "react";

/** Small black tag that marks a tool as beta on its tab and in the menu. */
export function BetaTag({ className = "" }) {
  return (
    <span className={`shrink-0 bg-black px-1.5 py-0.5 text-[10px] font-black uppercase leading-none tracking-widest text-lime-300 ${className}`}>
      Beta
    </span>
  );
}
