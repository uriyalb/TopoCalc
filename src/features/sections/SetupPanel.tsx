import React, { useRef, useState } from 'react';
import { ChevronRight, FileText, FolderOpen, Play, RefreshCw, RotateCcw, Save, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Btn, Panel, Segmented, Step } from '../shared/ui';

interface SetupPanelProps {
    status: string;
    profileStale: boolean;
    fileName: string;
    layers: string[];
    selectedPath: string;
    selectedContours: string[];
    selectedPlannedContours: string[];
    closedContours: boolean;
    closedPlannedContours: boolean;
    contourInfo: { lines: number; closedInDxf: number };
    plannedInfo: { lines: number; closedInDxf: number };
    onClosedContoursChange: (closed: boolean) => void;
    onClosedPlannedContoursChange: (closed: boolean) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onPathChange: (layer: string) => void;
    onContourChange: (layer: string) => void;
    onPlannedContourChange: (layer: string) => void;
    onGenerate: () => void;
    onReset: () => void;
    onSaveProject: () => void;
    onOpenProject: () => void;
}

function LayerList({ layers, isOn, onPick, type, name, tall }: { layers: string[]; isOn: (l: string) => boolean; onPick: (l: string) => void; type: 'radio' | 'checkbox'; name: string; tall?: boolean }) {
    return (
        <div className={cn('overflow-y-auto border-4 border-black bg-white', tall ? 'max-h-52' : 'max-h-40')}>
            {layers.map((layer) => (
                <label key={layer} className={cn('flex cursor-pointer items-center gap-2 px-2 py-1 text-xs font-bold text-black', isOn(layer) ? 'bg-lime-300' : 'hover:bg-lime-100')}>
                    <input type={type} name={name} value={layer} checked={isOn(layer)} onChange={() => onPick(layer)} className="h-4 w-4 shrink-0 accent-lime-800" />
                    <span className="truncate">{layer}</span>
                </label>
            ))}
        </div>
    );
}

/**
 * Closed shapes (rings): the last point joins the first, so the closing side counts as contour.
 * "From DXF" closes exactly the lines the drawing flags as closed; "Close all" closes every one.
 */
function ClosedToggle({ checked, onChange, info }: { checked: boolean; onChange: (closed: boolean) => void; info: { lines: number; closedInDxf: number } }) {
    // Tucked away: closed lines are read from the DXF anyway, so this is only for rings drawn without the flag
    const [open, setOpen] = useState(false);
    const hint = checked
        ? `All ${info.lines} lines closed · last point joins the first`
        : info.closedInDxf === 0
            ? 'No line is closed in the DXF'
            : info.closedInDxf === info.lines
                ? `All ${info.lines} lines are closed in the DXF`
                : `${info.closedInDxf} of ${info.lines} lines are closed in the DXF`;
    return (
        <div className="-mt-1 grid gap-1.5">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label="Closed shapes"
                title="Closed shapes"
                className="flex items-center gap-1.5 justify-self-start px-1 text-black hover:text-lime-700"
            >
                <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} strokeWidth={3} />
                {!open && checked && <span className="border-2 border-black bg-lime-300 px-1 text-[10px] font-black uppercase leading-tight">Close all</span>}
            </button>
            {open && (
                <>
                    <span className="flex items-center gap-1.5 text-xs font-black uppercase text-black">
                        <ClosedIcon closed={checked || info.closedInDxf > 0} />
                        Closed shapes
                    </span>
                    <Segmented
                        label="Closed shapes"
                        className="w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:whitespace-nowrap"
                        value={checked ? 'all' : 'dxf'}
                        onChange={(v) => onChange(v === 'all')}
                        options={[
                            { value: 'dxf', label: 'From DXF' },
                            { value: 'all', label: 'Close all' }
                        ]}
                    />
                    <span className="text-[11px] font-bold leading-tight text-lime-800">{hint}</span>
                </>
            )}
        </div>
    );
}

/** A ring that is either complete or has a gap — the whole idea in 16 pixels. */
function ClosedIcon({ closed }: { closed: boolean }) {
    return (
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {closed ? <path d="M3 4 L12 2 L14 11 L5 14 Z" strokeLinejoin="miter" /> : <path d="M12 2 L14 11 L5 14 L3 4" strokeLinejoin="miter" />}
        </svg>
    );
}

const SetupPanel: React.FC<SetupPanelProps> = ({
    status,
    profileStale,
    fileName,
    layers,
    selectedPath,
    selectedContours,
    selectedPlannedContours,
    closedContours,
    closedPlannedContours,
    contourInfo,
    plannedInfo,
    onClosedContoursChange,
    onClosedPlannedContoursChange,
    onFileUpload,
    onPathChange,
    onContourChange,
    onPlannedContourChange,
    onGenerate,
    onReset,
    onSaveProject,
    onOpenProject
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isProcessing = status === 'PARSING' || status === 'PROCESSING';
    const hasData = layers.length > 0;
    const ready = hasData && !!selectedPath && selectedContours.length > 0;

    return (
        <Panel className="grid gap-4 p-3">
            {/* 1. File */}
            <div className="grid gap-2">
                <Step n={1} title="DXF" done={!!fileName} />
                {!fileName ? (
                    <>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex h-24 flex-col items-center justify-center gap-1 border-4 border-dashed border-black bg-white text-sm font-black uppercase text-black hover:bg-lime-300"
                        >
                            <Upload className="h-6 w-6" />
                            Upload DXF
                        </button>
                        <Btn onClick={onOpenProject}>
                            <FolderOpen /> Open saved
                        </Btn>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2 border-4 border-black bg-white px-2 py-1.5">
                            <FileText className="h-5 w-5 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-black text-black">{fileName}</p>
                                <p className="text-xs font-bold text-lime-700">{layers.length} layers</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Btn size="sm" variant="plain" onClick={() => fileInputRef.current?.click()}>
                                <Upload /> Replace
                            </Btn>
                            <Btn size="sm" variant="danger" onClick={onReset}>
                                <RotateCcw /> Reset
                            </Btn>
                            <Btn size="sm" onClick={onSaveProject} disabled={!hasData}>
                                <Save /> Save
                            </Btn>
                            <Btn size="sm" onClick={onOpenProject}>
                                <FolderOpen /> Open
                            </Btn>
                        </div>
                    </>
                )}
                <input ref={fileInputRef} type="file" accept=".dxf" className="hidden" onChange={onFileUpload} />
            </div>

            {hasData && (
                <>
                    {/* 2. Path */}
                    <div className="grid gap-2">
                        <Step n={2} title="Path layer" note="Pick one" done={!!selectedPath} />
                        <LayerList layers={layers} type="radio" name="pathLayer" isOn={(l) => selectedPath === l} onPick={onPathChange} />
                    </div>

                    {/* 3. Existing contours */}
                    <div className="grid gap-2">
                        <Step n={3} title="Existing contours" note={`${selectedContours.length} picked`} done={selectedContours.length > 0} />
                        <LayerList layers={layers} type="checkbox" name="contourLayer" isOn={(l) => selectedContours.includes(l)} onPick={onContourChange} tall />
                        {selectedContours.length > 0 && <ClosedToggle checked={closedContours} onChange={onClosedContoursChange} info={contourInfo} />}
                    </div>

                    {/* 4. Planned contours */}
                    <div className="grid gap-2">
                        <Step n={4} title="Planned contours" note={selectedPlannedContours.length > 0 ? `${selectedPlannedContours.length} picked` : 'Optional'} done={selectedPlannedContours.length > 0} />
                        <LayerList layers={layers} type="checkbox" name="plannedLayer" isOn={(l) => selectedPlannedContours.includes(l)} onPick={onPlannedContourChange} tall />
                        {selectedPlannedContours.length > 0 && <ClosedToggle checked={closedPlannedContours} onChange={onClosedPlannedContoursChange} info={plannedInfo} />}
                    </div>

                    <Btn variant="primary" onClick={onGenerate} disabled={!ready || isProcessing}>
                        {isProcessing ? <RefreshCw className="animate-spin" /> : <Play fill="currentColor" />}
                        {isProcessing ? 'Working…' : profileStale ? 'Redraw long section' : 'Draw long section'}
                    </Btn>
                </>
            )}
        </Panel>
    );
};

export default SetupPanel;
