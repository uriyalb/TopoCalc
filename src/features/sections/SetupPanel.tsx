import React, { useRef } from 'react';
import { FileText, FolderOpen, Play, RefreshCw, RotateCcw, Save, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Btn, Panel, Step } from '../shared/ui';

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
 * Are these contours rings? When on, each line's last point is joined to its first,
 * so the closing side counts as contour too. The hint says what the DXF itself claims.
 */
function ClosedToggle({ checked, onChange, info }: { checked: boolean; onChange: (closed: boolean) => void; info: { lines: number; closedInDxf: number } }) {
    return (
        <label className={cn('flex cursor-pointer items-start gap-2 border-2 border-black px-2 py-1.5', checked ? 'bg-lime-300' : 'bg-white hover:bg-lime-100')}>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-lime-800" />
            <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-black uppercase text-black">
                    <ClosedIcon closed={checked} />
                    Closed shapes
                </span>
                <span className="block text-[11px] font-bold leading-tight text-lime-800">
                    {checked ? 'Last point joins the first' : 'Lines end where they are drawn'}
                    {info.closedInDxf > 0 && ` · ${info.closedInDxf} of ${info.lines} closed in the DXF`}
                </span>
            </span>
        </label>
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
