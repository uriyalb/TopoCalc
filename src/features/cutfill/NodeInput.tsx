import React from 'react';
import { cn } from '@/lib/utils';
import { NodeData } from './types';

interface NodeInputProps {
  r: number;
  c: number;
  label: string;
  data: NodeData;
  onChange: (r: number, c: number, field: 'existing' | 'planned', val: string) => void;
  isHovered: boolean;
}

// Text gets a paper-coloured halo so it stays readable over fills and a background plan.
const halo = '[text-shadow:0_0_3px_#fff,0_0_3px_#fff,0_0_3px_#fff]';

export const NodeInput: React.FC<NodeInputProps> = ({ r, c, label, data, onChange, isHovered }) => {
  const diff = (data.planned - data.existing).toFixed(2);
  const diffNum = parseFloat(diff);
  const isCut = diffNum < 0;
  const isFill = diffNum > 0;

  // Diff formatting: explicit plus sign for positive numbers
  const formattedDiff = diffNum > 0 ? `+${diffNum.toFixed(2)}` : diffNum.toFixed(2);

  // Dynamic width for existing value
  const valStr = data.existing.toString();
  const inputWidth = `${Math.max(valStr.length, 3)}ch`;

  return (
    <div className="pointer-events-none relative z-50 flex h-0 w-0 select-none items-center justify-center">
      <div className={cn('pointer-events-auto relative h-0 w-0 transition-transform duration-200', isHovered && 'scale-110')}>

        {/* QUADRANT LAYOUT (Absolute Positioning from Center)
            A 0x0 container with one value in each quadrant around the grid point:
              top-left  label      | top-right     (existing)
              bottom-left  ±diff   | bottom-right  planned
        */}

        {/* The grid point itself */}
        <div className="absolute -left-[3px] -top-[3px] h-[6px] w-[6px] bg-black" />

        {/* 1. TOP RIGHT: Existing level (in brackets) */}
        <div className={cn('absolute bottom-1 left-2 flex items-center justify-start whitespace-nowrap font-mono text-sm font-bold text-black', halo)} dir="ltr">
          <span>(</span>
          <input
            type="number"
            step="0.01"
            aria-label={`${label} existing level`}
            className="m-0 rounded-none bg-transparent px-0 text-center outline-none focus:bg-white focus:ring-2 focus:ring-black [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ width: inputWidth, minWidth: '2ch' }}
            value={data.existing}
            onChange={(e) => onChange(r, c, 'existing', e.target.value)}
            onFocus={(e) => e.target.select()}
            title="Existing level"
          />
          <span>)</span>
        </div>

        {/* 2. TOP LEFT: Point name */}
        <div className={cn('absolute bottom-1 right-2 whitespace-nowrap text-right text-sm font-black text-black', halo)}>
          {label}
        </div>

        {/* 3. BOTTOM RIGHT: Planned level */}
        <div className="absolute left-2 top-1 flex items-center justify-start whitespace-nowrap" dir="ltr">
          <input
            type="number"
            step="0.01"
            aria-label={`${label} planned level`}
            className={cn('w-20 rounded-none bg-transparent px-0.5 text-left font-mono text-sm font-black text-fuchsia-700 outline-none focus:bg-white focus:ring-2 focus:ring-black [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none', halo)}
            value={data.planned}
            onChange={(e) => onChange(r, c, 'planned', e.target.value)}
            onFocus={(e) => e.target.select()}
            title="Planned level"
          />
        </div>

        {/* 4. BOTTOM LEFT: Planned − existing */}
        <div className={cn('absolute right-2 top-1 whitespace-nowrap text-right font-mono text-sm font-black leading-tight', halo, isCut ? 'text-red-600' : isFill ? 'text-blue-600' : 'text-stone-400')} dir="ltr">
          {diffNum === 0 ? '0' : formattedDiff}
        </div>

      </div>
    </div>
  );
};
