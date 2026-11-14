import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Activity, ArrowLeft, ArrowRight, FileDown, Map, Maximize, TrendingUp, ZoomIn, ZoomOut } from 'lucide-react';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { cn } from '@/lib/utils';
import { DxfEntity, LocalSectionConfig } from './types';
import { flattenEntities, getBounds, generateSectionLines, calculateSectionProfile, generateProfileData, calculateOffsetSegments, getPathIntersections, interpolateElevation, getRenderablePolylines, dist2D } from './geometry';
import { dxfService } from './dxfService';
import { clientToWorld, getViewBox, padBounds, unitsPerPixel, viewBoxAttr } from './planView';
import { AXIS_TICK, COLORS } from '../shared/palette';
import { Btn, ChartTip, Chip, EmptyState, Field, Legend, Panel, PanelHead, TipRow, ZoomButtons, downloadText, useWheel } from '../shared/ui';

interface CrossSectionsProps {
    pathLayer: string;
    contourLayers: string[];
    plannedContourLayers?: string[];
    entities: DxfEntity[];
    config: LocalSectionConfig;
    onConfigChange: (config: LocalSectionConfig) => void;
}

// Pixels the chart keeps for itself around the plot (axis + margins).
const CHART_MARGIN = { top: 20, right: 20, left: 0, bottom: 5 };
const Y_AXIS_WIDTH = 45;
const X_AXIS_HEIGHT = 30;
const MIN_PLOT_HEIGHT = 245;

// Whole-metre axis ticks, thinned out so the labels never crowd
const metreTicks = ([min, max]: [number, number]) => {
    const step = [1, 2, 5, 10, 20, 50, 100].find(s => (max - min) / s <= 12) ?? 200;
    const ticks: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
    return ticks;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existing = payload.find((p: any) => p.name === 'Existing Ground');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const planned = payload.find((p: any) => p.name === 'Planned Topography');
        const slope = payload[0]?.payload?.slope; // Slope derived from existing ground segments

        return (
            <ChartTip title={`Offset ${Number(label).toFixed(2)} m`}>
                {existing && <TipRow color={COLORS.ground} label="Existing" value={`${Number(existing.value).toFixed(2)} m`} />}
                {planned && <TipRow color={COLORS.design} label="Planned" value={`${Number(planned.value).toFixed(2)} m`} />}
                {slope !== undefined && <div className="mt-1 border-t-2 border-black pt-1 font-mono">Ground slope {slope.toFixed(1)}%</div>}
            </ChartTip>
        );
    }
    return null;
};

const CrossSections: React.FC<CrossSectionsProps> = ({ pathLayer, contourLayers, plannedContourLayers = [], entities, config, onConfigChange }) => {
    // Unpack Config
    const { interval, width, pathWidth, sections } = config;

    // Helper to update partial config
    const updateConfig = (updates: Partial<LocalSectionConfig>) => {
        onConfigChange({ ...config, ...updates });
    };

    // View State (Pan/Zoom)
    const [viewState, setViewState] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
    const [isDragging, setIsDragging] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragDistance = useRef(0); // Track total movement to distinguish click vs drag
    const containerRef = useRef<HTMLDivElement>(null);

    // Toggle State
    const [showExisting, setShowExisting] = useState(true);
    const [showPlanned, setShowPlanned] = useState(true);

    // Section Nav State
    const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);

    // Interaction State
    const [draggingHandle, setDraggingHandle] = useState<{ index: number, handle: 'p1' | 'p2' } | null>(null);

    // 1:1 Aspect Ratio Logic - Container Width Tracking
    const [containerWidth, setContainerWidth] = useState<number>(1000);
    const chartContainerRef = useRef<HTMLDivElement>(null);

    // Ref to track parameters used for last generation to avoid overwriting on load
    const lastGenParams = useRef({ pathLayer, interval, width });

    // Derived Offset
    const pathOffset = pathWidth / 2;

    // 1. Process Geometry: Segments
    const pathSegments = useMemo(() => {
        if (!pathLayer || !entities) return [];
        const pathEntities = entities.filter(e => e.layer === pathLayer);
        return flattenEntities(pathEntities, true);
    }, [pathLayer, entities]);

    const hasPlan = !!pathLayer && pathSegments.length > 0;

    useEffect(() => {
        if (!chartContainerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        resizeObserver.observe(chartContainerRef.current);
        return () => resizeObserver.disconnect();
    }, [hasPlan]);

    const renderableContours = useMemo(() => {
        if (!contourLayers || contourLayers.length === 0 || !entities) return [];
        const contourEntities = entities.filter(e => contourLayers.includes(e.layer));
        return getRenderablePolylines(contourEntities);
    }, [contourLayers, entities]);

    const renderablePlanned = useMemo(() => {
        if (!plannedContourLayers || plannedContourLayers.length === 0 || !entities) return [];
        const plannedEntities = entities.filter(e => plannedContourLayers.includes(e.layer));
        return getRenderablePolylines(plannedEntities);
    }, [plannedContourLayers, entities]);

    const contourSegments = useMemo(() => {
        if (!contourLayers || contourLayers.length === 0 || !entities) return [];
        const contourEntities = entities.filter(e => contourLayers.includes(e.layer));
        return flattenEntities(contourEntities, false);
    }, [contourLayers, entities]);

    const plannedSegments = useMemo(() => {
        if (!plannedContourLayers || plannedContourLayers.length === 0 || !entities) return [];
        const plannedEntities = entities.filter(e => plannedContourLayers.includes(e.layer));
        return flattenEntities(plannedEntities, false);
    }, [plannedContourLayers, entities]);

    // 2. Process Geometry: Top View Offsets
    const offsetPathLeft = useMemo(() => calculateOffsetSegments(pathSegments, pathOffset), [pathSegments, pathOffset]);
    const offsetPathRight = useMemo(() => calculateOffsetSegments(pathSegments, -pathOffset), [pathSegments, pathOffset]);

    // 3. Process Geometry: Longitudinal Profile
    const longitudinalData = useMemo(() => {
        if (pathSegments.length === 0 || contourSegments.length === 0) return [];
        const result = generateProfileData(pathLayer, contourLayers, entities);
        if (!result.success || result.points.length < 2) return [];

        const points = result.points;
        const start = points[0];
        const end = points[points.length - 1];

        const slope = (end.elevation - start.elevation) / (end.distance - start.distance);

        return points.map(p => ({
            ...p,
            designZ: start.elevation + (p.distance - start.distance) * slope
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathLayer, contourLayers, entities, pathSegments]);

    // 4. Generate Sections Logic
    // Only regenerate if parameters changed significantly from what we have tracked.
    // This allows loading a project (where sections exist) without overwriting them immediately.
    useEffect(() => {
        const paramsChanged =
            pathLayer !== lastGenParams.current.pathLayer ||
            interval !== lastGenParams.current.interval ||
            width !== lastGenParams.current.width;

        // Condition 1: Params changed by user interaction -> Regenerate
        // Condition 2: No sections exist yet (initial load of new project) -> Generate
        if (paramsChanged || sections.length === 0) {
            if (pathSegments.length > 0) {
                const generated = generateSectionLines(pathSegments, interval, width);
                updateConfig({ sections: generated });
                setActiveSectionIndex(prev => {
                    if (generated.length === 0) return 0;
                    if (prev >= generated.length) return generated.length - 1;
                    return prev;
                });
            } else if (sections.length > 0) {
                // If path is invalid/empty but we have sections, maybe clear them?
                // Keeping previous sections might be safer unless path explicitly changed to something invalid
                if (pathLayer !== lastGenParams.current.pathLayer) {
                    updateConfig({ sections: [] });
                }
            }
            // Update tracker
            lastGenParams.current = { pathLayer, interval, width };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathSegments, interval, width, pathLayer]); // Dependencies drive the logic

    // Calculate Bounds for Top View
    const bounds = useMemo(() => {
        const allSegments = [...pathSegments, ...contourSegments, ...plannedSegments];
        return padBounds(getBounds(allSegments));
    }, [pathSegments, contourSegments, plannedSegments]);

    // Reset view when bounds change (new file loaded significantly)
    // We use a simplified key to avoid resetting on minor updates
    const boundsKey = `${bounds.minX.toFixed(1)},${bounds.minY.toFixed(1)},${bounds.width.toFixed(1)}`;
    useEffect(() => {
        // Only reset if we are "far" away or scale is wrong, but simple approach:
        // If no sections active, reset.
        if (sections.length === 0) {
            setViewState({ zoom: 1, pan: { x: 0, y: 0 } });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boundsKey]);

    // --- Interaction Helpers ---
    const viewBox = useMemo(() => getViewBox(bounds, viewState), [bounds, viewState]);
    const getPixelToSvgRatio = () => unitsPerPixel(containerRef.current, viewBox);
    const getSvgPoint = (clientX: number, clientY: number) => clientToWorld(containerRef.current, viewBox, bounds, clientX, clientY);

    // --- Interaction Handlers ---

    useWheel(containerRef, (e) => {
        e.preventDefault();
        const sensitivity = 0.001;
        const delta = -e.deltaY * sensitivity;
        setViewState(prev => {
            const newZoom = Math.max(0.1, Math.min(50, prev.zoom * (1 + delta)));
            return { ...prev, zoom: newZoom };
        });
    }, hasPlan);

    const handleMouseDown = (e: React.MouseEvent) => {
        const pt = getSvgPoint(e.clientX, e.clientY);
        const scale = getPixelToSvgRatio();
        const hitRadius = 10 * scale; // 10px visual radius for hit

        // Check Handle Hits for Active Section
        if (sections.length > 0 && activeSectionIndex < sections.length) {
            const sec = sections[activeSectionIndex];
            if (dist2D(pt, sec.p1) < hitRadius) {
                setDraggingHandle({ index: activeSectionIndex, handle: 'p1' });
                return;
            }
            if (dist2D(pt, sec.p2) < hitRadius) {
                setDraggingHandle({ index: activeSectionIndex, handle: 'p2' });
                return;
            }
        }

        // Default Pan
        setIsDragging(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        dragDistance.current = 0;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // 1. Dragging Handle
        if (draggingHandle) {
            const pt = getSvgPoint(e.clientX, e.clientY);

            // Update config via prop
            const newSections = [...sections];
            const sec = { ...newSections[draggingHandle.index] };

            if (draggingHandle.handle === 'p1') sec.p1 = pt;
            else sec.p2 = pt;

            // Update derived props
            sec.width = dist2D(sec.p1, sec.p2);
            sec.center = { x: (sec.p1.x + sec.p2.x) / 2, y: (sec.p1.y + sec.p2.y) / 2 };

            newSections[draggingHandle.index] = sec;
            updateConfig({ sections: newSections });
            return;
        }

        // 2. Panning
        if (isDragging && containerRef.current) {
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
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDraggingHandle(null);
    };

    const handleSectionClick = (e: React.MouseEvent, index: number) => {
        if (dragDistance.current < 5) {
            e.stopPropagation();
            setActiveSectionIndex(index);
        }
    };

    const resetView = () => setViewState({ zoom: 1, pan: { x: 0, y: 0 } });

    // 5. Current Active Section Data
    const currentSection = sections[activeSectionIndex];

    // ... Data processing hooks ...
    const pathIntersections = useMemo(() => {
        if (!currentSection || longitudinalData.length < 2) return [];
        const start = longitudinalData[0];
        const end = longitudinalData[longitudinalData.length - 1];
        return getPathIntersections(
            currentSection,
            pathSegments,
            { dist: start.distance, elev: start.designZ },
            { dist: end.distance, elev: end.designZ }
        );
    }, [currentSection, pathSegments, longitudinalData]);

    const rawExistingProfile = useMemo(() => {
        if (!currentSection) return [];
        return calculateSectionProfile(currentSection, contourSegments);
    }, [currentSection, contourSegments]);

    const rawPlannedProfile = useMemo(() => {
        if (!currentSection) return [];
        return calculateSectionProfile(currentSection, plannedSegments);
    }, [currentSection, plannedSegments]);

    const mergedSectionData = useMemo(() => {
        if (rawExistingProfile.length === 0 && rawPlannedProfile.length === 0) return [];

        const allOffsets = new Set<number>();
        rawExistingProfile.forEach(p => allOffsets.add(p.offset));
        rawPlannedProfile.forEach(p => allOffsets.add(p.offset));

        const sortedOffsets = Array.from(allOffsets).sort((a, b) => a - b);

        return sortedOffsets.map((offset, idx) => {
            const existingZ = interpolateElevation(rawExistingProfile, offset);
            const plannedZ = interpolateElevation(rawPlannedProfile, offset);

            let slope = 0;
            if (idx > 0) {
                const prevOffset = sortedOffsets[idx - 1];
                const prevZ = interpolateElevation(rawExistingProfile, prevOffset);
                if (existingZ !== null && prevZ !== null) {
                    slope = ((existingZ - prevZ) / (offset - prevOffset)) * 100;
                }
            }

            return { offset, existing: existingZ, planned: plannedZ, slope: slope };
        });
    }, [rawExistingProfile, rawPlannedProfile]);

    const aspectParams = useMemo(() => {
        // Collect all Y values
        const vals: number[] = [];
        if (showExisting) vals.push(...mergedSectionData.map(p => p.existing || Infinity).filter(v => v !== Infinity));
        if (showPlanned) vals.push(...mergedSectionData.map(p => p.planned || Infinity).filter(v => v !== Infinity));
        vals.push(...pathIntersections.map(p => p.elevation));

        let yMin = 0, yMax = 10;
        if (vals.length > 0) {
            yMin = Math.min(...vals);
            yMax = Math.max(...vals);
        }

        // Add vertical padding
        const paddingY = Math.max((yMax - yMin) * 0.15, 2);
        yMin -= paddingY;
        yMax += paddingY;

        // The half-metre grid lines stretch the axes to whole metres, so snap first
        // and size the plot from the snapped ranges: 1 m is then the same on both axes.
        yMin = Math.floor(yMin);
        yMax = Math.ceil(yMax);
        const xMin = Math.floor(-width / 2);
        const xMax = Math.ceil(width / 2);

        const availablePlotWidth = Math.max(100, containerWidth - CHART_MARGIN.left - CHART_MARGIN.right - Y_AXIS_WIDTH);
        const pxPerMetre = availablePlotWidth / (xMax - xMin);
        let plotHeight = (yMax - yMin) * pxPerMetre;

        // Never collapse: add whole metres of headroom instead of stretching the scale
        while (plotHeight < MIN_PLOT_HEIGHT) {
            yMax += 1;
            plotHeight = (yMax - yMin) * pxPerMetre;
            if (plotHeight < MIN_PLOT_HEIGHT) {
                yMin -= 1;
                plotHeight = (yMax - yMin) * pxPerMetre;
            }
        }

        return {
            height: plotHeight + CHART_MARGIN.top + CHART_MARGIN.bottom + X_AXIS_HEIGHT,
            yDomain: [yMin, yMax] as [number, number],
            xDomain: [xMin, xMax] as [number, number]
        };

    }, [mergedSectionData, pathIntersections, showExisting, showPlanned, width, containerWidth]);

    // Grid Tick Generation
    const gridTicks = useMemo(() => {
        const ticks: React.ReactNode[] = [];

        const [yMin, yMax] = aspectParams.yDomain;
        const [xMin, xMax] = aspectParams.xDomain;

        // Horizontal (Elevation)
        for (let y = yMin; y <= yMax; y += 0.5) {
            const isMajor = Math.abs(y % 1) < 0.1;
            ticks.push(
                <ReferenceLine
                    key={`h-${y}`}
                    y={y}
                    stroke={isMajor ? COLORS.gridStrong : COLORS.grid}
                    strokeWidth={isMajor ? 1.5 : 1}
                    ifOverflow="extendDomain"
                />
            );
        }

        // Vertical (Offset)
        for (let x = xMin; x <= xMax; x += 0.5) {
            const isMajor = Math.abs(x % 1) < 0.1;
            ticks.push(
                <ReferenceLine
                    key={`v-${x}`}
                    x={x}
                    stroke={isMajor ? COLORS.gridStrong : COLORS.grid}
                    strokeWidth={isMajor ? 1.5 : 1}
                    ifOverflow="extendDomain"
                />
            );
        }
        return ticks;
    }, [aspectParams]);

    // Handlers
    const handleNext = () => { if (activeSectionIndex < sections.length - 1) setActiveSectionIndex(prev => prev + 1); };
    const handlePrev = () => { if (activeSectionIndex > 0) setActiveSectionIndex(prev => prev - 1); };

    const handleExport = () => {
        if (sections.length === 0) return;

        const planData = {
            contours: contourSegments,
            planned: plannedSegments,
            path: pathSegments,
            pathLeft: offsetPathLeft,
            pathRight: offsetPathRight,
            sections: sections
        };

        const profileData = {
            ground: longitudinalData.map(p => ({ distance: p.distance, elevation: p.elevation, layer: 'Ground' })),
            design: longitudinalData.map(p => ({ distance: p.distance, elevation: p.designZ, layer: 'Design' }))
        };

        const allSectionsData = sections.map(sec => {
            const ground = calculateSectionProfile(sec, contourSegments);
            const planned = calculateSectionProfile(sec, plannedSegments);
            const start = longitudinalData[0];
            const end = longitudinalData[longitudinalData.length - 1];
            const pathInts = getPathIntersections(sec, pathSegments, { dist: start.distance, elev: start.designZ }, { dist: end.distance, elev: end.designZ });

            return {
                meta: sec,
                ground,
                planned,
                paths: pathInts.map(p => ({ offset: p.offset, elevation: p.elevation }))
            };
        });

        const dxfString = dxfService.generateProjectDxf(planData, profileData, allSectionsData, pathWidth);

        downloadText(dxfString, `project_export.dxf`, 'application/dxf');
    };

    // --- Renders ---
    if (!pathLayer) return <EmptyState icon={<Map />} className="min-h-80">Pick a path layer — step 2</EmptyState>;
    if (pathSegments.length === 0) return <EmptyState tone="bad" icon={<Activity />} className="min-h-80">No usable geometry on layer “{pathLayer}”</EmptyState>;

    const atFirst = activeSectionIndex === 0;
    const atLast = activeSectionIndex === sections.length - 1;
    // Line widths are in drawing units so they stay the same on screen at any zoom
    const u = bounds.width / viewState.zoom;
    const canExport = sections.length > 0 && longitudinalData.length > 1;

    return (
        <div className="grid gap-4">

            {/* PANEL 1: Configuration & Top View */}
            <Panel tone="paper">
                <PanelHead icon={<Map />} title="Plan">
                    <Legend
                        items={[
                            { color: COLORS.path, label: 'Path' },
                            { color: COLORS.contour, label: 'Existing' },
                            ...(plannedContourLayers.length > 0 ? [{ color: COLORS.design, label: 'Planned', dashed: true }] : []),
                            { color: COLORS.section, label: 'Section' }
                        ]}
                    />
                </PanelHead>
                <div className="flex flex-wrap items-end gap-3 border-b-4 border-black bg-lime-100 p-3">
                    <NumberInput label="Every" value={interval} onChange={(v) => updateConfig({ interval: v })} />
                    <NumberInput label="Section width" value={width} onChange={(v) => updateConfig({ width: v })} />
                    <NumberInput label="Path width" value={pathWidth} onChange={(v) => updateConfig({ pathWidth: v })} />
                    <div className="flex-1" />
                    <Btn variant="primary" onClick={handleExport} disabled={!canExport} title={canExport ? undefined : 'Pick existing contours first — step 3'}>
                        <FileDown />
                        Export DXF
                    </Btn>
                </div>

                {/* SVG Canvas */}
                <div
                    ref={containerRef}
                    className={cn('relative h-[450px] overflow-hidden', isDragging || draggingHandle ? 'cursor-grabbing' : 'cursor-grab')}
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
                            {/* Existing Contours - Continuous */}
                            {renderableContours.map((poly, i) => (
                                <polyline
                                    key={`cnt-${i}`}
                                    points={poly.map(p => `${p.x},${p.y}`).join(' ')}
                                    fill="none"
                                    stroke={COLORS.contour}
                                    strokeWidth={u * 0.0015}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            ))}

                            {/* Planned Contours - Continuous */}
                            {renderablePlanned.map((poly, i) => (
                                <polyline
                                    key={`pln-${i}`}
                                    points={poly.map(p => `${p.x},${p.y}`).join(' ')}
                                    fill="none"
                                    stroke={COLORS.design}
                                    strokeWidth={u * 0.0015}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeDasharray={`${u * 0.008} ${u * 0.006}`}
                                />
                            ))}

                            {/* Path edges (Left/Right) */}
                            {offsetPathLeft.map((seg, i) => (
                                <line key={`opl-${i}`} x1={seg.p1.x} y1={seg.p1.y} x2={seg.p2.x} y2={seg.p2.y} stroke={COLORS.path} strokeWidth={u * 0.0015} />
                            ))}
                            {offsetPathRight.map((seg, i) => (
                                <line key={`opr-${i}`} x1={seg.p1.x} y1={seg.p1.y} x2={seg.p2.x} y2={seg.p2.y} stroke={COLORS.path} strokeWidth={u * 0.0015} />
                            ))}

                            {/* Main Path - Solid */}
                            {pathSegments.map((seg, i) => (
                                <line key={`path-${i}`} x1={seg.p1.x} y1={seg.p1.y} x2={seg.p2.x} y2={seg.p2.y} stroke={COLORS.path} strokeWidth={u * 0.004} strokeLinecap="round" />
                            ))}

                            {/* Section Lines - Interactive */}
                            {sections.map((line, index) => {
                                const isActive = index === activeSectionIndex;
                                const strokeW = u * (isActive ? 0.006 : 0.003);
                                return (
                                    <g
                                        key={`sec-${line.id}`}
                                        className="pointer-events-auto cursor-pointer" // Enable interactions on sections
                                        onClick={(e) => handleSectionClick(e, index)}
                                    >
                                        {/* Invisible thicker hit area for easier clicking */}
                                        <line x1={line.p1.x} y1={line.p1.y} x2={line.p2.x} y2={line.p2.y} stroke="transparent" strokeWidth={u * 0.03} />

                                        {/* Visible Line */}
                                        <line x1={line.p1.x} y1={line.p1.y} x2={line.p2.x} y2={line.p2.y} stroke={isActive ? COLORS.section : COLORS.sectionIdle} strokeWidth={strokeW} />

                                        {/* Handles for Active Section */}
                                        {isActive && (
                                            <>
                                                <circle cx={line.p1.x} cy={line.p1.y} r={strokeW * 2} fill="white" stroke={COLORS.ink} strokeWidth={strokeW / 2} className="cursor-move pointer-events-auto" />
                                                <circle cx={line.p2.x} cy={line.p2.y} r={strokeW * 2} fill="white" stroke={COLORS.ink} strokeWidth={strokeW / 2} className="cursor-move pointer-events-auto" />
                                            </>
                                        )}

                                        <g transform={`translate(${line.p1.x}, ${line.p1.y}) scale(1, -1)`}>
                                            <text y={-u * 0.015} textAnchor="middle" fontSize={u * 0.016} fill={isActive ? COLORS.section : COLORS.sectionIdle} fontWeight="900">
                                                {line.n * interval}
                                            </text>
                                        </g>
                                    </g>
                                );
                            })}
                        </g>
                    </svg>

                    <ZoomButtons
                        vertical
                        className="absolute left-3 top-3"
                        onIn={() => setViewState(p => ({ ...p, zoom: Math.min(50, p.zoom + 0.2) }))}
                        onFit={resetView}
                        onOut={() => setViewState(p => ({ ...p, zoom: Math.max(0.1, p.zoom - 0.2) }))}
                        icons={{ in: <ZoomIn />, fit: <Maximize />, out: <ZoomOut /> }}
                    />
                    <Chip className="absolute right-3 top-3">Click a section · drag its ends</Chip>

                    {/* Navigation Buttons Overlay */}
                    <SectionNav
                        className="absolute bottom-3 left-1/2 -translate-x-1/2"
                        label={currentSection ? `${currentSection.distance.toFixed(0)} m` : '–'}
                        count={sections.length ? `${activeSectionIndex + 1} / ${sections.length}` : ''}
                        onPrev={handlePrev}
                        onNext={handleNext}
                        atFirst={atFirst}
                        atLast={atLast}
                    />
                </div>
            </Panel>

            {/* PANEL 2: Longitudinal Profile */}
            <Panel tone="paper">
                <PanelHead icon={<TrendingUp />} title="Long section">
                    <Legend
                        items={[
                            { color: COLORS.ground, label: 'Existing ground' },
                            { color: COLORS.design, label: 'Design grade' },
                            { color: COLORS.section, label: 'This section', dashed: true }
                        ]}
                    />
                </PanelHead>
                <div className="h-[260px] p-2">
                    {longitudinalData.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={longitudinalData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridStrong} />
                                <XAxis dataKey="distance" type="number" tickFormatter={(v) => v.toFixed(0)} height={22} tick={AXIS_TICK} stroke={COLORS.ink} />
                                <YAxis domain={['auto', 'auto']} width={Y_AXIS_WIDTH} tick={AXIS_TICK} stroke={COLORS.ink} />
                                <Tooltip
                                    content={({ active, payload, label }) =>
                                        active && payload && payload.length ? (
                                            <ChartTip title={`Station ${Number(label).toFixed(2)} m`}>
                                                <TipRow color={COLORS.ground} label="Ground" value={`${Number(payload[0].payload.elevation).toFixed(2)} m`} />
                                                <TipRow color={COLORS.design} label="Design" value={`${Number(payload[0].payload.designZ).toFixed(2)} m`} />
                                            </ChartTip>
                                        ) : null
                                    }
                                />
                                <Area type="monotone" dataKey="elevation" stroke={COLORS.ground} strokeWidth={2} fill={COLORS.groundSoft} fillOpacity={0.5} name="Ground" isAnimationActive={false} />
                                <Line type="linear" dataKey="designZ" stroke={COLORS.design} strokeWidth={2} dot={false} name="Design" isAnimationActive={false} />
                                {currentSection && (
                                    <ReferenceLine x={currentSection.distance} stroke={COLORS.section} strokeWidth={2} strokeDasharray="4 3" />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState icon={<TrendingUp />} className="border-0 bg-transparent">Pick existing contours — step 3</EmptyState>
                    )}
                </div>
            </Panel>

            {/* PANEL 3: Section Profile View (Dynamic Height for 1:1 Ratio) */}
            <Panel tone="paper">
                <PanelHead icon={<Activity />} title={currentSection ? `Cross section · ${currentSection.distance.toFixed(0)} m` : 'Cross section'}>
                    {plannedContourLayers.length > 0 && (
                        <div className="flex items-center gap-3 text-xs font-black uppercase">
                            <label className="flex cursor-pointer items-center gap-1.5">
                                <input type="checkbox" checked={showExisting} onChange={(e) => setShowExisting(e.target.checked)} className="h-4 w-4 accent-lime-800" />
                                Existing
                            </label>
                            <label className="flex cursor-pointer items-center gap-1.5">
                                <input type="checkbox" checked={showPlanned} onChange={(e) => setShowPlanned(e.target.checked)} className="h-4 w-4 accent-fuchsia-600" />
                                Planned
                            </label>
                        </div>
                    )}
                    <span className="border-2 border-black bg-white px-1.5 py-0.5 font-mono text-xs font-black" title="One metre is the same length on both axes">1:1</span>
                    <SectionNav label={sections.length ? `${activeSectionIndex + 1} / ${sections.length}` : '–'} onPrev={handlePrev} onNext={handleNext} atFirst={atFirst} atLast={atLast} flat />
                </PanelHead>

                <div className="px-2 pb-2">
                    <div ref={chartContainerRef} className="relative" style={{ height: aspectParams.height }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={mergedSectionData} margin={CHART_MARGIN}>
                                {/* Replaced CartesianGrid with Custom Grid Ticks */}
                                {gridTicks}

                                <XAxis
                                    dataKey="offset"
                                    type="number"
                                    domain={aspectParams.xDomain}
                                    ticks={metreTicks(aspectParams.xDomain)}
                                    allowDataOverflow={true}
                                    height={X_AXIS_HEIGHT}
                                    tickFormatter={(val) => `${Math.abs(val).toFixed(0)}`}
                                    stroke={COLORS.ink}
                                    tick={AXIS_TICK}
                                />
                                <YAxis
                                    domain={aspectParams.yDomain}
                                    ticks={metreTicks(aspectParams.yDomain)}
                                    width={Y_AXIS_WIDTH}
                                    allowDataOverflow={true}
                                    stroke={COLORS.ink}
                                    tick={AXIS_TICK}
                                />
                                <Tooltip content={<CustomTooltip />} />

                                <ReferenceLine x={0} stroke={COLORS.ink} strokeDasharray="3 3" label={{ value: "CL", position: 'insideTop', fill: COLORS.ink, fontSize: 10, fontWeight: 900 }} />

                                {showPlanned && (
                                    <Area
                                        type="monotone"
                                        dataKey="planned"
                                        stroke={COLORS.design}
                                        fill={COLORS.designSoft}
                                        fillOpacity={0.6}
                                        strokeWidth={2}
                                        name="Planned Topography"
                                        isAnimationActive={false}
                                    />
                                )}

                                {showExisting && (
                                    <Area
                                        type="monotone"
                                        dataKey="existing"
                                        stroke={COLORS.ground}
                                        fill={COLORS.groundSoft}
                                        fillOpacity={0.5}
                                        strokeWidth={2}
                                        name="Existing Ground"
                                        isAnimationActive={false}
                                    />
                                )}

                                {/* Path Intersections Visualization */}
                                {pathIntersections.map((intersection, idx) => {
                                    // Determine if this is the "main" path (closest to center)
                                    const isMain = Math.abs(intersection.offset) < 0.1;
                                    return (
                                        <g key={`path-group-${idx}`}>
                                            {/* Path Surface */}
                                            <ReferenceLine
                                                segment={[
                                                    { x: intersection.offset - pathOffset, y: intersection.elevation },
                                                    { x: intersection.offset + pathOffset, y: intersection.elevation }
                                                ]}
                                                stroke={COLORS.path}
                                                strokeWidth={isMain ? 5 : 3}
                                            />

                                            {/* Triangle Marker */}
                                            <ReferenceDot
                                                x={intersection.offset}
                                                y={intersection.elevation}
                                                r={10} // Just used for collision, custom shape ignores it
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                shape={(props: any) => {
                                                    const { cx, cy } = props;
                                                    return (
                                                        <g>
                                                            <path
                                                                d={`M ${cx - 5} ${cy - 12} L ${cx + 5} ${cy - 12} L ${cx} ${cy - 3} Z`}
                                                                fill={COLORS.path}
                                                                stroke="none"
                                                            />
                                                            <text
                                                                x={cx}
                                                                y={cy - 16}
                                                                textAnchor="middle"
                                                                fill={COLORS.path}
                                                                stroke="#f7fee7"
                                                                strokeWidth={3}
                                                                paintOrder="stroke"
                                                                fontSize={11}
                                                                fontWeight="900"
                                                            >
                                                                {intersection.elevation.toFixed(2)}
                                                            </text>
                                                        </g>
                                                    );
                                                }}
                                            />
                                        </g>
                                    );
                                })}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <Legend
                        className="border-t-4 border-black px-1 pt-2"
                        items={[
                            ...(showExisting ? [{ color: COLORS.ground, label: 'Existing ground' }] : []),
                            ...(showPlanned && plannedContourLayers.length > 0 ? [{ color: COLORS.design, label: 'Planned' }] : []),
                            { color: COLORS.path, label: `Path at design level · ${pathWidth} m wide` }
                        ]}
                    />
                </div>
            </Panel>
        </div>
    );
};

function SectionNav({ label, count, onPrev, onNext, atFirst, atLast, className, flat }: { label: string; count?: string; onPrev: () => void; onNext: () => void; atFirst: boolean; atLast: boolean; className?: string; flat?: boolean }) {
    return (
        <div className={cn('flex items-center gap-2', !flat && 'border-2 border-black bg-white p-1 shadow-[2px_2px_0px_#000]', className)} onMouseDown={(e) => e.stopPropagation()}>
            <Btn size="icon-sm" variant="secondary" onClick={onPrev} disabled={atFirst} aria-label="Previous section"><ArrowLeft /></Btn>
            <span className="min-w-16 text-center font-mono text-xs font-black uppercase leading-tight text-black">
                {label}
                {count && <span className="block text-[10px] text-lime-700">{count}</span>}
            </span>
            <Btn size="icon-sm" variant="secondary" onClick={onNext} disabled={atLast} aria-label="Next section"><ArrowRight /></Btn>
        </div>
    );
}

// UI Helpers
const NumberInput = ({ label, value, onChange }: { label: string, value: number, onChange: (n: number) => void }) => (
    <Field
        className="w-28"
        label={label}
        unit="m"
        type="number" min="0.1" step="0.5"
        value={value} onChange={(e) => onChange(Math.max(0.1, Number(e.target.value)))}
    />
);

export default CrossSections;
