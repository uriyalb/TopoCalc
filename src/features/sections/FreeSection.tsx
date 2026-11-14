import React, { useState, useMemo, useRef, useDeferredValue } from 'react';
import { Activity, List, Map, Maximize, Plus, Ruler, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';
import { DxfEntity, UserSection } from './types';
import { flattenEntities, getBounds, getRenderablePolylines, getIntersection, dist2D, calculateLinearProfile, distancePointToSegment } from './geometry';
import { clientToWorld, getViewBox, padBounds, unitsPerPixel, viewBoxAttr } from './planView';
import { AXIS_TICK, COLORS } from '../shared/palette';
import { Btn, ChartTip, Chip, EmptyState, Legend, Panel, PanelHead, TipRow, ZoomButtons, useWheel } from '../shared/ui';

interface FreeSectionProps {
    pathLayer: string;
    contourLayers: string[];
    entities: DxfEntity[];
    sections: UserSection[];
    onSectionsChange: (sections: UserSection[]) => void;
}

const FreeSection: React.FC<FreeSectionProps> = ({ pathLayer, contourLayers, entities, sections, onSectionsChange }) => {
    // Selection State
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

    // Interaction State
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawP1, setDrawP1] = useState<{ x: number, y: number } | null>(null);
    const [mouseSvgPos, setMouseSvgPos] = useState<{ x: number, y: number } | null>(null);

    // Editing State
    const [draggingHandle, setDraggingHandle] = useState<{ id: string, handle: 'p1' | 'p2' } | null>(null);

    // View State
    const [viewState, setViewState] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
    const [isPanning, setIsPanning] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const dragDistance = useRef(0);

    // --- Data Preparation ---
    const pathSegments = useMemo(() => {
        if (!pathLayer || !entities) return [];
        const pathEntities = entities.filter(e => e.layer === pathLayer);
        return flattenEntities(pathEntities, true);
    }, [pathLayer, entities]);

    const contourSegments = useMemo(() => {
        if (!contourLayers || contourLayers.length === 0 || !entities) return [];
        const contourEntities = entities.filter(e => contourLayers.includes(e.layer));
        return flattenEntities(contourEntities, false);
    }, [contourLayers, entities]);

    const renderableContours = useMemo(() => {
        if (!contourLayers || contourLayers.length === 0 || !entities) return [];
        const contourEntities = entities.filter(e => contourLayers.includes(e.layer));
        return getRenderablePolylines(contourEntities);
    }, [contourLayers, entities]);

    const renderablePath = useMemo(() => {
        if (!pathLayer || !entities) return [];
        const pathEntities = entities.filter(e => e.layer === pathLayer);
        return getRenderablePolylines(pathEntities);
    }, [pathLayer, entities]);

    // Bounds Calculation
    const bounds = useMemo(() => {
        const allSegments = [...pathSegments, ...contourSegments];
        return padBounds(getBounds(allSegments));
    }, [pathSegments, contourSegments]);

    // ViewBox
    const viewBox = useMemo(() => getViewBox(bounds, viewState), [bounds, viewState]);

    const activeSection = useMemo(() => sections.find(s => s.id === selectedSectionId), [sections, selectedSectionId]);

    // --- Profile Calculation (Deferred for Performance) ---
    // We defer the active section used for calculation to allow the UI (dragging) to be responsive
    // even if the chart calculation is heavy.
    const deferredActiveSection = useDeferredValue(activeSection);

    const sectionData = useMemo(() => {
        if (!deferredActiveSection) return [];
        // Calculate profile against the deferred (lagging) state
        return calculateLinearProfile(deferredActiveSection.p1, deferredActiveSection.p2, contourSegments);
    }, [deferredActiveSection, contourSegments]);

    const pathIntersections = useMemo(() => {
        if (!deferredActiveSection || pathSegments.length === 0) return [];

        const ints: { distance: number, elevation: number }[] = [];
        for (const seg of pathSegments) {
            const intersection = getIntersection(deferredActiveSection.p1, deferredActiveSection.p2, seg.p1, seg.p2);
            if (intersection) {
                const dist = dist2D(deferredActiveSection.p1, intersection);
                let elev = 0;
                if (sectionData.length > 1) {
                    for (let i = 0; i < sectionData.length - 1; i++) {
                        const p1 = sectionData[i];
                        const p2 = sectionData[i + 1];
                        if (dist >= p1.distance && dist <= p2.distance) {
                            const t = (dist - p1.distance) / (p2.distance - p1.distance);
                            elev = p1.elevation + t * (p2.elevation - p1.elevation);
                            break;
                        }
                    }
                }
                ints.push({ distance: dist, elevation: elev });
            }
        }
        return ints.sort((a, b) => a.distance - b.distance);
    }, [deferredActiveSection, pathSegments, sectionData]);

    // --- Helpers ---
    const getSvgPoint = (clientX: number, clientY: number) => clientToWorld(containerRef.current, viewBox, bounds, clientX, clientY);
    const getPixelToSvgRatio = () => unitsPerPixel(containerRef.current, viewBox);

    // --- Event Handlers ---
    useWheel(containerRef, (e) => {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        setViewState(prev => ({ ...prev, zoom: Math.max(0.1, Math.min(50, prev.zoom * (1 + delta))) }));
    });

    const handleMouseDown = (e: React.MouseEvent) => {
        const pt = getSvgPoint(e.clientX, e.clientY);
        const scale = getPixelToSvgRatio();
        const hitRadius = 15 * scale; // Increased hit radius for easier grabbing

        // 0. Handle Pan (Middle click or Shift+Click)
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            dragDistance.current = 0;
            return;
        }

        if (e.button === 0) {
            // 1. Handle Point Editing (if a section is selected)
            if (selectedSectionId && !isDrawing) {
                const sec = sections.find(s => s.id === selectedSectionId);
                if (sec) {
                    if (dist2D(pt, sec.p1) < hitRadius) {
                        setDraggingHandle({ id: sec.id, handle: 'p1' });
                        return;
                    }
                    if (dist2D(pt, sec.p2) < hitRadius) {
                        setDraggingHandle({ id: sec.id, handle: 'p2' });
                        return;
                    }
                }
            }

            // 2. Drawing Mode
            if (isDrawing) {
                if (!drawP1) {
                    setDrawP1(pt);
                    setMouseSvgPos(pt); // Initialize end point at start
                } else {
                    // Finish
                    const newSection: UserSection = {
                        id: Date.now().toString(),
                        p1: drawP1,
                        p2: pt,
                        name: `Section ${sections.length + 1}`
                    };
                    onSectionsChange([...sections, newSection]);
                    setSelectedSectionId(newSection.id);
                    setDrawP1(null);
                    setMouseSvgPos(null);
                    setIsDrawing(false);
                }
                return;
            }

            // 3. Selection (Hit Test Line)
            let bestId: string | null = null;
            let minDst = Infinity;

            sections.forEach(sec => {
                const d = distancePointToSegment(pt, sec.p1, sec.p2);
                if (d < hitRadius && d < minDst) {
                    minDst = d;
                    bestId = sec.id;
                }
            });

            if (bestId) {
                setSelectedSectionId(bestId);
            } else {
                setSelectedSectionId(null);
                // If clicked empty space, start panning
                setIsPanning(true);
                lastMousePos.current = { x: e.clientX, y: e.clientY };
                dragDistance.current = 0;
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const pt = getSvgPoint(e.clientX, e.clientY);

        // 1. Panning
        if (isPanning) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            dragDistance.current += Math.abs(dx) + Math.abs(dy);

            const scale = getPixelToSvgRatio();

            setViewState(prev => ({
                ...prev,
                pan: {
                    x: prev.pan.x + dx * scale,
                    y: prev.pan.y - dy * scale
                }
            }));
            return;
        }

        // 2. Dragging Handle
        if (draggingHandle) {
            const updatedSections = sections.map(s => {
                if (s.id === draggingHandle.id) {
                    return {
                        ...s,
                        [draggingHandle.handle]: pt
                    };
                }
                return s;
            });
            onSectionsChange(updatedSections);
            return;
        }

        // 3. Drawing
        if (isDrawing) {
            setMouseSvgPos(pt);
            return;
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setDraggingHandle(null);
    };

    const deleteSection = (id: string) => {
        onSectionsChange(sections.filter(s => s.id !== id));
        if (selectedSectionId === id) setSelectedSectionId(null);
    };

    // --- Visualization for a Section ---
    // Line widths are in drawing units so they stay the same on screen at any zoom
    const u = bounds.width / viewState.zoom;

    const renderSection = (key: string, p1: { x: number, y: number }, p2: { x: number, y: number }, isSelected: boolean, isGhost?: boolean) => {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len < 0.0001) return null; // Too short

        // Unit vector
        const ux = dx / len;
        const uy = dy / len;

        // Left Normal (90 deg counter-clockwise)
        const nx = -uy;
        const ny = ux;

        // Visual Scales
        const strokeW = u * (isSelected ? 0.005 : 0.003);
        const markerLen = u * 0.04; // Length of direction tick
        const arrowW = markerLen * 0.4; // Width of arrow base
        const color = isSelected ? COLORS.section : COLORS.sectionIdle;

        // Direction Indicators (Ticks pointing Left)
        const renderMarker = (x: number, y: number) => {
            const tipX = x + nx * markerLen;
            const tipY = y + ny * markerLen;

            return (
                <g>
                    <line x1={x} y1={y} x2={tipX} y2={tipY} stroke={color} strokeWidth={strokeW} />
                    <path
                        d={`M ${tipX} ${tipY} L ${x + ux * (arrowW * 1.5)} ${y + uy * (arrowW * 1.5)} L ${x - ux * (arrowW * 1.5)} ${y - uy * (arrowW * 1.5)} Z`}
                        fill={color}
                    />
                </g>
            );
        };

        return (
            <g key={key} opacity={isGhost ? 0.7 : 1}>
                {/* Main Section Line - Solid */}
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={strokeW} />

                {/* Direction Indicators */}
                {renderMarker(p1.x, p1.y)}
                {renderMarker(p2.x, p2.y)}

                {/* Editable Handles (Circles) - Only if selected */}
                {isSelected && (
                    <>
                        <circle cx={p1.x} cy={p1.y} r={strokeW * 2.4} fill="white" stroke={COLORS.ink} strokeWidth={strokeW * 0.6} />
                        <circle cx={p2.x} cy={p2.y} r={strokeW * 2.4} fill="white" stroke={COLORS.ink} strokeWidth={strokeW * 0.6} />
                    </>
                )}
            </g>
        );
    };

    const startStopDrawing = () => {
        setIsDrawing(!isDrawing);
        setDrawP1(null);
        setMouseSvgPos(null);
        setSelectedSectionId(null);
    };

    const instruction = isDrawing
        ? (!drawP1 ? 'Click the start point' : 'Click the end point')
        : draggingHandle ? 'Drag to move the end' : sections.length === 0 ? 'Add a section, then click two points' : 'Click a line · drag its ends';

    return (
        <div className="grid gap-4">

            {/* TOP: PLAN INTERACTION */}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">

                {/* 1. Plan View */}
                <Panel tone="paper">
                    <PanelHead icon={<Map />} title="Plan">
                        <Legend
                            items={[
                                { color: COLORS.path, label: 'Path' },
                                { color: COLORS.contour, label: 'Existing' },
                                { color: COLORS.section, label: 'Section' }
                            ]}
                        />
                    </PanelHead>

                    <div
                        ref={containerRef}
                        className={cn('relative h-[460px] overflow-hidden', isDrawing || draggingHandle ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-default')}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <svg
                            width="100%"
                            height="100%"
                            viewBox={viewBoxAttr(viewBox)}
                            preserveAspectRatio="xMidYMid meet"
                            className="pointer-events-none block select-none"
                        >
                            <g transform={`scale(1, -1) translate(0, -${bounds.maxY + bounds.minY})`}>
                                {/* Contours */}
                                {renderableContours.map((poly, i) => (
                                    <polyline
                                        key={`cnt-${i}`}
                                        points={poly.map(p => `${p.x},${p.y}`).join(' ')}
                                        fill="none"
                                        stroke={COLORS.contour}
                                        strokeWidth={u * 0.0015}
                                        strokeLinejoin="round"
                                    />
                                ))}

                                {/* Path */}
                                {renderablePath.map((poly, i) => (
                                    <polyline
                                        key={`path-${i}`}
                                        points={poly.map(p => `${p.x},${p.y}`).join(' ')}
                                        fill="none"
                                        stroke={COLORS.path}
                                        strokeWidth={u * 0.004}
                                        strokeLinejoin="round"
                                    />
                                ))}

                                {/* Existing Sections */}
                                {sections.map(sec => renderSection(sec.id, sec.p1, sec.p2, sec.id === selectedSectionId))}

                                {/* Active Drawing Line - follows the cursor */}
                                {isDrawing && drawP1 && mouseSvgPos && renderSection('ghost', drawP1, mouseSvgPos, true, true)}
                            </g>
                        </svg>

                        <ZoomButtons
                            vertical
                            className="absolute left-3 top-3"
                            onIn={() => setViewState(p => ({ ...p, zoom: Math.min(50, p.zoom + 0.2) }))}
                            onFit={() => setViewState({ zoom: 1, pan: { x: 0, y: 0 } })}
                            onOut={() => setViewState(p => ({ ...p, zoom: Math.max(0.1, p.zoom - 0.2) }))}
                            icons={{ in: <ZoomIn />, fit: <Maximize />, out: <ZoomOut /> }}
                        />

                        {/* Mode Switcher */}
                        <div className="absolute right-3 top-3" onMouseDown={(e) => e.stopPropagation()}>
                            <Btn variant={isDrawing ? 'dark' : 'primary'} onClick={startStopDrawing}>
                                {isDrawing ? <X /> : <Plus />}
                                {isDrawing ? 'Cancel' : 'Add section'}
                            </Btn>
                        </div>

                        {/* Instructions */}
                        <Chip className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap">{instruction}</Chip>
                    </div>
                </Panel>

                {/* 2. Side Panel List */}
                <Panel tone="white" className="flex max-h-[512px] flex-col">
                    <PanelHead icon={<List />} title="Sections">
                        <span className="font-mono text-sm font-black">{sections.length}</span>
                    </PanelHead>

                    <div className="grid flex-1 content-start gap-2 overflow-y-auto p-2">
                        {sections.length === 0 ? (
                            <EmptyState icon={<Ruler />} className="border-0 bg-transparent">None yet</EmptyState>
                        ) : (
                            sections.map(sec => {
                                const on = selectedSectionId === sec.id;
                                return (
                                    <div key={sec.id} className={cn('flex items-center border-2 border-black', on ? 'bg-lime-300' : 'bg-white hover:bg-lime-100')}>
                                        <button type="button" onClick={() => setSelectedSectionId(sec.id)} aria-pressed={on} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-xs font-black uppercase text-black">
                                            <span className="h-3 w-3 shrink-0 border-2 border-black" style={{ background: on ? COLORS.section : 'white' }} />
                                            <span className="truncate">{sec.name}</span>
                                        </button>
                                        <button type="button" onClick={() => deleteSection(sec.id)} aria-label={`Delete ${sec.name}`} title="Delete" className="shrink-0 p-2 text-black hover:bg-red-200 hover:text-red-800">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Panel>
            </div>

            {/* BOTTOM: CHART */}
            <Panel tone="paper">
                <PanelHead icon={<Activity />} title={activeSection ? activeSection.name : 'Section'}>
                    {sectionData.length > 0 && <span className="font-mono text-xs font-black">Length {sectionData[sectionData.length - 1].distance.toFixed(1)} m</span>}
                </PanelHead>

                <div className="h-[300px] p-2">
                    {activeSection && sectionData.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sectionData} margin={{ top: 18, right: 24, left: 0, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridStrong} />
                                <XAxis
                                    dataKey="distance"
                                    type="number"
                                    tickFormatter={(v) => v.toFixed(0)}
                                    label={{ value: 'DISTANCE (m)', position: 'insideBottomRight', offset: -5, fontSize: 11, fontWeight: 900, fill: COLORS.ink }}
                                    stroke={COLORS.ink}
                                    tick={AXIS_TICK}
                                />
                                <YAxis
                                    domain={['auto', 'auto']}
                                    label={{ value: 'ELEV. (m)', angle: -90, position: 'insideLeft', fontSize: 11, fontWeight: 900, fill: COLORS.ink }}
                                    stroke={COLORS.ink}
                                    tick={AXIS_TICK}
                                />
                                <Tooltip
                                    content={({ active, payload, label }) =>
                                        active && payload && payload.length ? (
                                            <ChartTip title={`At ${Number(label).toFixed(2)} m`}>
                                                <TipRow color={COLORS.ground} label="Ground" value={`${Number(payload[0].value).toFixed(2)} m`} />
                                            </ChartTip>
                                        ) : null
                                    }
                                />
                                <Area
                                    type="monotone"
                                    dataKey="elevation"
                                    stroke={COLORS.ground}
                                    fill={COLORS.groundSoft}
                                    fillOpacity={0.5}
                                    strokeWidth={2}
                                    name="Ground"
                                    isAnimationActive={false}
                                />

                                {/* Render ALL Path Intersections */}
                                {pathIntersections.map((pt, idx) => (
                                    <React.Fragment key={idx}>
                                        <ReferenceDot
                                            x={pt.distance}
                                            y={pt.elevation}
                                            r={5}
                                            fill={COLORS.path}
                                            stroke="#fff"
                                            strokeWidth={1.5}
                                        />
                                        <ReferenceLine
                                            x={pt.distance}
                                            stroke={COLORS.path}
                                            strokeDasharray="3 3"
                                            label={{
                                                value: `CL ${idx + 1}`,
                                                fill: COLORS.path,
                                                fontSize: 10,
                                                fontWeight: 900,
                                                position: 'top',
                                                offset: 5
                                            }}
                                        />
                                    </React.Fragment>
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState icon={<Ruler />} className="border-0 bg-transparent">
                            {contourLayers.length === 0 ? 'Pick existing contours — step 3' : sections.length === 0 ? 'Add a section on the plan' : 'Pick a section'}
                        </EmptyState>
                    )}
                </div>
                {pathIntersections.length > 0 && (
                    <Legend
                        className="border-t-4 border-black px-3 py-2"
                        items={[
                            { color: COLORS.ground, label: 'Existing ground' },
                            { color: COLORS.path, label: 'CL · path centre line', dashed: true }
                        ]}
                    />
                )}
            </Panel>
        </div>
    );
};

export default FreeSection;
