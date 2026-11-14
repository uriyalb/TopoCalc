import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Check, ChevronDown, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfilePoint } from './types';
import { dxfService, ExportLayers } from './dxfService';
import { calculateEarthworkStats, generateEarthworkPolygons } from './geometry';
import { AXIS_TICK, COLORS } from '../shared/palette';
import { Btn, ChartTip, Hint, Legend, Panel, Segmented, Stat, TipRow, downloadText, labelClass } from '../shared/ui';

interface LongSectionProps {
    data: ProfilePoint[];
    onError: (message: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ground = payload.find((p: any) => p.dataKey === 'elevation');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const design = payload.find((p: any) => p.dataKey === 'designLine');

        return (
            <ChartTip title={`Station ${Number(label).toFixed(2)} m`}>
                {ground && <TipRow color={COLORS.ground} label="Ground" value={`${Number(ground.value).toFixed(2)} m`} />}
                {design && <TipRow color={COLORS.design} label="Design" value={`${Number(design.value).toFixed(2)} m`} />}
                {ground && design && (
                    <div className="mt-1 border-t-2 border-black pt-1">
                        {ground.value > design.value ? (
                            <TipRow color={COLORS.cut} label="Cut" value={`${(ground.value - design.value).toFixed(2)} m`} />
                        ) : (
                            <TipRow color={COLORS.fill} label="Fill" value={`${(design.value - ground.value).toFixed(2)} m`} />
                        )}
                    </div>
                )}
            </ChartTip>
        );
    }
    return null;
};

const EXPORT_LAYERS: { id: keyof ExportLayers; label: string; color: string }[] = [
    { id: 'ground', label: 'Existing ground', color: COLORS.ground },
    { id: 'design', label: 'Design grade', color: COLORS.design },
    { id: 'cut', label: 'Cut', color: COLORS.cut },
    { id: 'fill', label: 'Fill', color: COLORS.fill }
];

const LongSection: React.FC<LongSectionProps> = ({ data, onError }) => {
    // Default to Distorted view for Profile
    const [isDistorted, setIsDistorted] = useState(true);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // Export State
    const [exportExaggeration, setExportExaggeration] = useState<number>(10);
    const [exportLayers, setExportLayers] = useState<ExportLayers>({
        ground: true,
        design: true,
        cut: true,
        fill: true
    });

    const stats = useMemo(() => calculateEarthworkStats(data), [data]);

    const chartData = useMemo(() => {
        if (data.length < 2) return [];
        const start = data[0];
        const end = data[data.length - 1];
        const slope = (end.elevation - start.elevation) / (end.distance - start.distance);

        return data.map(p => {
            const designZ = start.elevation + (p.distance - start.distance) * slope;
            return {
                ...p,
                designLine: designZ,
                cutRange: p.elevation > designZ ? [designZ, p.elevation] : [designZ, designZ],
                fillRange: designZ > p.elevation ? [p.elevation, designZ] : [designZ, designZ]
            };
        });
    }, [data]);

    useEffect(() => {
        // Reset export exaggeration when distortion changes
        setExportExaggeration(isDistorted ? 10 : 1);
    }, [isDistorted]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleExport = () => {
        try {
            // Profile Export (Standard logic)
            const polygons = generateEarthworkPolygons(data);
            const xScale = 0.1;
            const yScale = xScale * exportExaggeration;

            const dxfString = dxfService.generateProfileDxf(
                data,
                polygons.cutPolygons,
                polygons.fillPolygons,
                polygons.designLine,
                xScale,
                yScale,
                exportLayers
            );
            const fileName = `profile_section_${exportExaggeration}x.dxf`;

            downloadText(dxfString, fileName, 'application/dxf');
            setIsExportMenuOpen(false);
        } catch (error) {
            console.error("Failed to generate DXF", error);
            onError("Could not export the DXF");
        }
    };

    const toggleLayer = (key: keyof ExportLayers) => {
        setExportLayers(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const work = stats.cutArea + stats.fillArea || 1;

    return (
        <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Stat label="Slope" value={stats.slopePercentage.toFixed(2)} unit="%" sub={`${stats.startElevation.toFixed(1)} m → ${stats.endElevation.toFixed(1)} m`} />
                <Stat label="Cut area" swatch={COLORS.cut} value={stats.cutArea.toFixed(1)} unit="m²" sub={`${((stats.cutArea / work) * 100).toFixed(0)}% of earthwork`} />
                <Stat label="Fill area" swatch={COLORS.fill} value={stats.fillArea.toFixed(1)} unit="m²" sub={`${((stats.fillArea / work) * 100).toFixed(0)}% of earthwork`} />
                <Stat tone="dark" label="Net" value={Math.abs(stats.netArea).toFixed(1)} unit="m²" sub={stats.netArea > 0 ? 'Surplus · haul away' : 'Deficit · bring in'} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <span className={labelClass}>Vertical</span>
                <Segmented
                    label="Vertical display"
                    value={isDistorted ? 'tall' : 'flat'}
                    onChange={(v) => setIsDistorted(v === 'tall')}
                    options={[
                        { value: 'tall', label: 'Exaggerated' },
                        { value: 'flat', label: 'Flat' }
                    ]}
                />
                <div className="flex-1" />

                {/* Export Menu */}
                <div className="relative" ref={exportMenuRef}>
                    <Btn variant="primary" onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} aria-expanded={isExportMenuOpen}>
                        <Download />
                        Export DXF
                        <ChevronDown className={cn('transition-transform', isExportMenuOpen && 'rotate-180')} />
                    </Btn>

                    {isExportMenuOpen && (
                        <div className="absolute right-0 z-30 mt-3 grid w-72 gap-4 border-4 border-black bg-white p-3 shadow-[4px_4px_0px_#000]">
                            <div className="grid gap-2">
                                <span className={labelClass}>Vertical exaggeration</span>
                                <Segmented
                                    className="w-full [&>button]:flex-1 [&>button]:justify-center"
                                    label="Vertical exaggeration"
                                    value={exportExaggeration}
                                    onChange={setExportExaggeration}
                                    options={[
                                        { value: 10, label: '10×' },
                                        { value: 1, label: '1×' }
                                    ]}
                                />
                                <Hint>
                                    Scale: horizontal 0.1 · vertical {exportExaggeration === 10 ? '1.0' : '0.1'}
                                </Hint>
                            </div>

                            <div className="grid gap-1">
                                <span className={labelClass}>Layers</span>
                                {EXPORT_LAYERS.map((layer) => (
                                    <button
                                        key={layer.id}
                                        type="button"
                                        role="checkbox"
                                        aria-checked={exportLayers[layer.id]}
                                        onClick={() => toggleLayer(layer.id)}
                                        className="flex items-center gap-2 px-1 py-1 text-left text-sm font-bold text-black hover:bg-lime-100"
                                    >
                                        <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center border-2 border-black', exportLayers[layer.id] ? 'bg-black text-lime-300' : 'bg-white')}>
                                            {exportLayers[layer.id] && <Check className="h-3.5 w-3.5" strokeWidth={4} />}
                                        </span>
                                        <span className="h-3 w-3 shrink-0 border-2 border-black" style={{ background: layer.color }} />
                                        {layer.label}
                                    </button>
                                ))}
                            </div>

                            <Btn variant="primary" onClick={handleExport}>
                                <Download />
                                Download .dxf
                            </Btn>
                        </div>
                    )}
                </div>
            </div>

            <Panel tone="paper" className="p-2">
                <div className={cn('w-full', isDistorted ? 'h-[440px]' : 'min-h-[200px]')}>
                    <ResponsiveContainer width="100%" height={isDistorted ? '100%' : undefined} aspect={isDistorted ? undefined : 2.5}>
                        <ComposedChart data={chartData} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridStrong} />
                            <XAxis
                                dataKey="distance"
                                type="number"
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={(val) => val.toFixed(0)}
                                label={{ value: 'DISTANCE (m)', position: 'insideBottomRight', offset: -8, fontSize: 11, fontWeight: 900, fill: COLORS.ink }}
                                stroke={COLORS.ink}
                                tick={AXIS_TICK}
                            />
                            <YAxis
                                dataKey="elevation"
                                type="number"
                                domain={['auto', 'auto']}
                                label={{ value: 'ELEVATION (m)', angle: -90, position: 'insideLeft', fontSize: 11, fontWeight: 900, fill: COLORS.ink }}
                                stroke={COLORS.ink}
                                tick={AXIS_TICK}
                            />
                            <Tooltip content={<CustomTooltip />} />

                            <Area type="monotone" dataKey="cutRange" stroke="none" fill={COLORS.cutSoft} fillOpacity={0.85} isAnimationActive={false} name="Cut Area" />
                            <Area type="monotone" dataKey="fillRange" stroke="none" fill={COLORS.fillSoft} fillOpacity={0.85} isAnimationActive={false} name="Fill Area" />
                            <Line type="linear" dataKey="designLine" stroke={COLORS.design} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} name="Design Grade" />
                            <Line
                                type="monotone"
                                dataKey="elevation"
                                stroke={COLORS.ground}
                                strokeWidth={3}
                                dot={{ r: 2, fill: COLORS.ground }}
                                activeDot={{ r: 6 }}
                                isAnimationActive={false}
                                name="Existing Ground"
                            />

                            <ReferenceLine y={0} stroke={COLORS.gridStrong} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t-4 border-black px-1 pt-2">
                    <Legend
                        items={[
                            { color: COLORS.ground, label: 'Existing ground' },
                            { color: COLORS.design, label: 'Design grade · start to end', dashed: true },
                            { color: COLORS.cutSoft, label: 'Cut' },
                            { color: COLORS.fillSoft, label: 'Fill' }
                        ]}
                    />
                    <Hint>Fitted to the screen · the DXF is to scale</Hint>
                </div>
            </Panel>
        </div>
    );
};

export default LongSection;
