import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowLeftRight, ArrowUpDown, Check, Lock, Maximize, MousePointer2, ScanLine, Unlock, X, ZoomIn, ZoomOut } from 'lucide-react';
import { GridSize, BackgroundConfig, SelectionState } from './types';
import { Btn, Field, Hint, ZoomButtons, labelClass } from '../shared/ui';

export const MAX_GRID = 30; // rows / columns the grid accepts

interface CalibrationDialogProps {
  isOpen: boolean;
  imageUrl: string | null;
  initialGridSize: GridSize;
  initialCellWidth: number;
  initialSelection?: SelectionState; // Restore previous state
  cellDisplaySize: number;
  onClose: () => void;
  onConfirm: (gridSize: GridSize, cellWidth: number, bgConfig: BackgroundConfig, selection: SelectionState) => void;
}

/** Place the calculation grid on an uploaded plan: the box you frame becomes the grid. */
export const CalibrationDialog: React.FC<CalibrationDialogProps> = ({
  isOpen, imageUrl, initialGridSize, initialCellWidth, initialSelection, cellDisplaySize, onClose, onConfirm
}) => {
  // Data State
  const [gridSize, setGridSize] = useState<GridSize>(initialGridSize);
  const [cellWidth, setCellWidth] = useState(initialCellWidth);
  const [lockRatio, setLockRatio] = useState(true);

  // View State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.1 });
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Selection Box State (Percentage relative to image)
  // Default to 10/10/80/80, but will be overwritten by calculateSmartSelection
  const [selection, setSelection] = useState<SelectionState>({ x: 10, y: 10, w: 80, h: 80 });

  // Drag State
  const dragRef = useRef<{
    type: string | null;
    startX: number;
    startY: number;
    startTransform: { x: number, y: number, scale: number };
    startSelection: { x: number, y: number, w: number, h: number };
    containerWidth: number;
    containerHeight: number;
  }>({
    type: null, startX: 0, startY: 0,
    startTransform: { x: 0, y: 0, scale: 1 },
    startSelection: { x: 0, y: 0, w: 0, h: 0 },
    containerWidth: 1, containerHeight: 1
  });

  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // --- Initialization Logic ---

  // 1. Calculate the perfect selection box that matches the Grid Aspect Ratio
  const calculateSmartSelection = useCallback(() => {
    if (!imageRef.current) return;
    const nw = imageRef.current.naturalWidth;
    const nh = imageRef.current.naturalHeight;
    if (nw === 0 || nh === 0) return;

    // Use preserved selection if available (Editing mode)
    if (initialSelection && initialSelection.w > 0) {
      setSelection(initialSelection);
      return;
    }

    // New Import Mode: Calculate Ratio
    const imgRatio = nw / nh;
    // Grid Ratio (Cols / Rows) - assuming square cells.
    // Width of Grid = Cols * CellSize, Height = Rows * CellSize
    const gridRatio = gridSize.cols / gridSize.rows;

    // We want a selection box (in pixels) such that selW_px / selH_px = gridRatio
    // Converting to percentages: (selW% * nw) / (selH% * nh) = gridRatio
    // (selW% / selH%) * imgRatio = gridRatio
    // selW% / selH% = gridRatio / imgRatio

    // Let's start with a target Width of 70% of the image
    let w = 70;
    let h = w * (imgRatio / gridRatio);

    // If height exceeds 80%, scale down based on height instead
    if (h > 80) {
      h = 70;
      w = h * (gridRatio / imgRatio);
    }

    // Center it
    const x = 50 - (w / 2);
    const y = 50 - (h / 2);

    setSelection({ x, y, w, h });
  }, [gridSize, initialSelection]);

  // 2. Fit Image to Screen
  const fitToScreen = useCallback(() => {
    if (!wrapper || !imageRef.current) return;
    const wrapRect = wrapper.getBoundingClientRect();
    const naturalW = imageRef.current.naturalWidth;
    const naturalH = imageRef.current.naturalHeight;

    if (naturalW === 0 || naturalH === 0) return;

    const padding = 80;
    const availW = wrapRect.width - padding;
    const availH = wrapRect.height - padding;

    const scaleX = availW / naturalW;
    const scaleY = availH / naturalH;
    const scale = Math.min(scaleX, scaleY, 0.9);

    const x = (wrapRect.width - (naturalW * scale)) / 2;
    const y = (wrapRect.height - (naturalH * scale)) / 2;

    setTransform({ x, y, scale });
  }, [wrapper]);

  const handleImageLoad = () => {
    setIsImageLoaded(true);
    // Run calculations
    calculateSmartSelection();
    fitToScreen();
  };

  // 3. Main Init Effect
  useEffect(() => {
    if (isOpen && imageUrl) {
      setIsImageLoaded(false);
      setGridSize(initialGridSize);
      setCellWidth(initialCellWidth);
      // Do NOT set hardcoded selection here, wait for image load

      // Immediate check if already cached
      if (imageRef.current?.complete && imageRef.current?.naturalWidth > 0) {
        handleImageLoad();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, imageUrl, wrapper]); // initialSelection left out on purpose: a prop change must not reset the box

  // --- Zoom & Pan Logic ---

  const transformRef = useRef(transform);
  transformRef.current = transform;

  useEffect(() => {
    if (!wrapper) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const current = transformRef.current;
      const rect = wrapper.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const pointX = (mouseX - current.x) / current.scale;
      const pointY = (mouseY - current.y) / current.scale;

      const delta = -e.deltaY * 0.001;
      const zoomFactor = Math.exp(delta);
      const newScale = Math.min(Math.max(0.01, current.scale * zoomFactor), 200);

      const newX = mouseX - (pointX * newScale);
      const newY = mouseY - (pointY * newScale);

      setTransform({ x: newX, y: newY, scale: newScale });
    };
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, [wrapper]);

  if (!isOpen || !imageUrl) return null;

  const handleZoomBtn = (direction: 'in' | 'out' | 'fit') => {
    if (direction === 'fit') {
      fitToScreen();
      return;
    }

    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const pointX = (centerX - transform.x) / transform.scale;
    const pointY = (centerY - transform.y) / transform.scale;

    const factor = direction === 'in' ? 1.2 : 0.8;
    const newScale = Math.min(Math.max(0.01, transform.scale * factor), 200);

    const newX = centerX - (pointX * newScale);
    const newY = centerY - (pointY * newScale);

    setTransform({ x: newX, y: newY, scale: newScale });
  };

  // --- Dragging Logic ---

  const handleMouseDown = (e: React.MouseEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();

    const isPan = e.button === 1 || e.altKey || type === 'bg';

    let containerW = 1;
    let containerH = 1;

    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      containerW = rect.width;
      containerH = rect.height;
    }

    dragRef.current = {
      type: isPan ? 'pan' : type,
      startX: e.clientX,
      startY: e.clientY,
      startTransform: { ...transform },
      startSelection: { ...selection },
      containerWidth: containerW,
      containerHeight: containerH
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.type) return;

    const { type, startX, startY, startTransform, startSelection, containerWidth, containerHeight } = dragRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    if (type === 'pan') {
      setTransform({
        ...transform,
        x: startTransform.x + deltaX,
        y: startTransform.y + deltaY
      });
      return;
    }

    // Calculate delta in Percentages
    const deltaXPct = (deltaX / containerWidth) * 100;
    const deltaYPct = (deltaY / containerHeight) * 100;

    const newSel = { ...startSelection };
    const minSize = 0.5;

    // Aspect Ratio Helpers
    const imgAspect = containerWidth / containerHeight; // W/H
    // Grid Ratio (W/H) = cols / rows
    const gridAspect = gridSize.cols / gridSize.rows;

    const hFromW = (w: number) => w * imgAspect / gridAspect;
    const wFromH = (h: number) => h * gridAspect / imgAspect;

    if (type === 'body') {
      newSel.x = startSelection.x + deltaXPct;
      newSel.y = startSelection.y + deltaYPct;
    }
    else {
      // --- Resize Logic ---
      // X Axis
      if (type.includes('l')) {
        const maxW = startSelection.x + startSelection.w - minSize;
        const newX = Math.min(startSelection.x + deltaXPct, maxW);
        newSel.w = startSelection.w + (startSelection.x - newX);
        newSel.x = newX;
      } else if (type.includes('r')) {
        newSel.w = Math.max(minSize, startSelection.w + deltaXPct);
      }

      // Y Axis
      if (type.includes('t')) {
        const maxH = startSelection.y + startSelection.h - minSize;
        const newY = Math.min(startSelection.y + deltaYPct, maxH);
        newSel.h = startSelection.h + (startSelection.y - newY);
        newSel.y = newY;
      } else if (type.includes('b')) {
        newSel.h = Math.max(minSize, startSelection.h + deltaYPct);
      }

      // --- Aspect Ratio Lock ---
      if (lockRatio) {
        if (['tl', 'tr', 'bl', 'br'].includes(type)) {
          newSel.h = hFromW(newSel.w);
          if (type.includes('t')) {
            newSel.y = (startSelection.y + startSelection.h) - newSel.h;
          }
        }
        else if (type === 'l' || type === 'r') {
          newSel.h = hFromW(newSel.w);
          newSel.y = startSelection.y + (startSelection.h - newSel.h) / 2;
        }
        else if (type === 't' || type === 'b') {
          newSel.w = wFromH(newSel.h);
          newSel.x = startSelection.x + (startSelection.w - newSel.w) / 2;
        }
      }
    }

    setSelection(newSel);
  };

  const handleMouseUp = () => {
    dragRef.current.type = null;
  };

  const handleSmartGridChange = (field: 'rows' | 'cols', val: number) => {
    const safeVal = Math.max(1, Math.min(MAX_GRID, val));
    if (safeVal === gridSize[field]) return;

    const ratio = safeVal / gridSize[field];
    const newSel = { ...selection };

    if (field === 'rows') {
      // Expand Bottom
      newSel.h = selection.h * ratio;
    }

    if (field === 'cols') {
      // Expand Left (Anchor Right)
      const rightEdge = selection.x + selection.w;
      newSel.w = selection.w * ratio;
      newSel.x = rightEdge - newSel.w;
    }

    setSelection(newSel);
    setGridSize(prev => ({ ...prev, [field]: safeVal }));
  };

  const handleConfirm = () => {
    if (!imageRef.current) return;
    const nw = imageRef.current.naturalWidth;
    const nh = imageRef.current.naturalHeight;
    const selPxX = (selection.x / 100) * nw;
    const selPxY = (selection.y / 100) * nh;
    const selPxW = (selection.w / 100) * nw;
    const selPxH = (selection.h / 100) * nh;
    const targetW = gridSize.cols * cellDisplaySize;
    const targetH = gridSize.rows * cellDisplaySize;
    const scaleX = targetW / selPxW;
    const scaleY = targetH / selPxH;

    // The plan is anchored to the grid's top-right corner
    const finalTransX = (nw - (selPxX + selPxW)) * scaleX;
    const finalTransY = -selPxY * scaleY;

    onConfirm(gridSize, cellWidth, {
      x: finalTransX, y: finalTransY, scaleX, scaleY, rotation: 0, opacity: 0.5, lockAspectRatio: lockRatio
    }, selection); // Pass selection back for saving
  };

  // Visual Helpers
  const inverseScale = 1 / Math.max(transform.scale, 0.001);
  const strokeWidth = 2 * inverseScale;

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/70" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="fixed inset-2 z-[100] flex flex-col border-4 border-black bg-lime-200 shadow-[8px_8px_0px_#000] outline-none md:inset-4"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b-4 border-black bg-lime-400 px-4 py-3">
            <DialogPrimitive.Title className="flex items-center gap-2 text-lg font-black uppercase tracking-tight text-black">
              <ScanLine className="h-5 w-5" /> Place the grid on the plan
            </DialogPrimitive.Title>
            <Btn size="icon-sm" variant="plain" onClick={onClose} aria-label="Close"><X /></Btn>
          </div>

          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* Controls */}
            <div className="flex shrink-0 flex-col border-b-4 border-black bg-lime-100 md:w-72 md:border-b-0 md:border-r-4">
              <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Rows" type="number" min="1" max={MAX_GRID} value={gridSize.rows} onChange={e => handleSmartGridChange('rows', Number(e.target.value))} />
                  <Field label="Columns" type="number" min="1" max={MAX_GRID} value={gridSize.cols} onChange={e => handleSmartGridChange('cols', Number(e.target.value))} />
                </div>
                <Field label="Cell size" unit="m" type="number" step="0.1" value={cellWidth} onChange={e => setCellWidth(Number(e.target.value))} />

                <div className="grid gap-1 border-4 border-black bg-white p-2 font-mono text-sm font-bold">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-sans text-xs font-black uppercase text-lime-800"><ArrowLeftRight className="h-3.5 w-3.5" /> Grid width</span>
                    {(gridSize.cols * cellWidth).toFixed(1)} m
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-sans text-xs font-black uppercase text-lime-800"><ArrowUpDown className="h-3.5 w-3.5" /> Grid height</span>
                    {(gridSize.rows * cellWidth).toFixed(1)} m
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className={labelClass}>Keep cells square</span>
                  <Btn size="icon-sm" variant={lockRatio ? 'dark' : 'plain'} onClick={() => setLockRatio(!lockRatio)} aria-pressed={lockRatio} aria-label="Keep cells square">
                    {lockRatio ? <Lock /> : <Unlock />}
                  </Btn>
                </div>

                <Hint className="items-start"><MousePointer2 className="mt-0.5" /> Drag the black frame onto the same area of the plan. Scroll to zoom, drag the plan to move it.</Hint>
              </div>

              <div className="border-t-4 border-black p-4">
                <Btn variant="primary" className="w-full" onClick={handleConfirm}>
                  <Check /> Use this grid
                </Btn>
              </div>
            </div>

            {/* Canvas Area */}
            <div className="relative min-h-0 flex-1 select-none overflow-hidden bg-stone-300">
              <ZoomButtons
                vertical
                className="absolute left-3 top-3 z-50"
                onIn={() => handleZoomBtn('in')}
                onFit={() => handleZoomBtn('fit')}
                onOut={() => handleZoomBtn('out')}
                icons={{ in: <ZoomIn />, fit: <Maximize />, out: <ZoomOut /> }}
              />

              <div
                ref={setWrapper}
                className="relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing"
                onMouseDown={(e) => handleMouseDown(e, 'bg')}
              >
                {/* The transform container. We anchor it to top-left to ensure simpler translation math. */}
                <div
                  className="absolute left-0 top-0 origin-top-left will-change-transform"
                  style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
                >

                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt=""
                    onLoad={handleImageLoad}
                    className="pointer-events-none block max-w-none"
                    draggable={false}
                    style={{ opacity: isImageLoaded ? 1 : 0, transition: 'opacity 0.2s' }}
                  />

                  {isImageLoaded && (
                    <div
                      className="absolute z-10"
                      style={{
                        left: `${selection.x}%`,
                        top: `${selection.y}%`,
                        width: `${selection.w}%`,
                        height: `${selection.h}%`
                      }}
                      onMouseDown={(e) => handleMouseDown(e, 'body')}
                    >
                      {/* SVG Overlay for crisp lines */}
                      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                        {/* Main Box Border (Black for high visibility) */}
                        <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="black" strokeWidth={strokeWidth * 2} />

                        {/* Explicit Grid Lines (Black) */}
                        {Array.from({ length: gridSize.cols - 1 }).map((_, i) => (
                          <line
                            key={`v-${i}`}
                            x1={`${((i + 1) / gridSize.cols) * 100}%`} y1="0"
                            x2={`${((i + 1) / gridSize.cols) * 100}%`} y2="100%"
                            stroke="black"
                            strokeWidth={strokeWidth * 0.5}
                          />
                        ))}
                        {Array.from({ length: gridSize.rows - 1 }).map((_, i) => (
                          <line
                            key={`h-${i}`}
                            x1="0" y1={`${((i + 1) / gridSize.rows) * 100}%`}
                            x2="100%" y2={`${((i + 1) / gridSize.rows) * 100}%`}
                            stroke="black"
                            strokeWidth={strokeWidth * 0.5}
                          />
                        ))}
                      </svg>

                      {/* Body Hit Area */}
                      <div className="absolute inset-0 cursor-move bg-lime-400/10 transition-colors hover:bg-lime-400/20"></div>

                      {/* Handles */}
                      {['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'].map(pos => {
                        const isCorner = pos.length === 2;
                        const style: React.CSSProperties = { transform: `translate(-50%, -50%) scale(${inverseScale})`, position: 'absolute' };

                        if (pos.includes('t')) style.top = '0%'; else if (pos.includes('b')) style.top = '100%'; else style.top = '50%';
                        if (pos.includes('l')) style.left = '0%'; else if (pos.includes('r')) style.left = '100%'; else style.left = '50%';

                        let cursor = 'pointer';
                        if (pos === 'tl' || pos === 'br') cursor = 'nwse-resize';
                        else if (pos === 'tr' || pos === 'bl') cursor = 'nesw-resize';
                        else if (pos === 't' || pos === 'b') cursor = 'ns-resize';
                        else if (pos === 'l' || pos === 'r') cursor = 'ew-resize';

                        return (
                          <div
                            key={pos}
                            className="z-30 border-2 border-black bg-white"
                            style={{ ...style, width: isCorner ? 14 : 10, height: isCorner ? 14 : 10, cursor }}
                            onMouseDown={(e) => handleMouseDown(e, pos)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
