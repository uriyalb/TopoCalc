import React, { useRef } from 'react';
import { FileText, FolderOpen, Play, RefreshCw, RotateCcw, Save, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Btn, Panel, Step } from '../shared/ui';

interface SetupPanelProps {
    status: string;
    fileName: string;
    layers: string[];
    selectedPath: string;
    selectedContours: string[];
    selectedPlannedContours: string[];
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

const SetupPanel: React.FC<SetupPanelProps> = ({
    status,
    fileName,
    layers,
    selectedPath,
    selectedContours,
    selectedPlannedContours,
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
                    </div>

                    {/* 4. Planned contours */}
                    <div className="grid gap-2">
                        <Step n={4} title="Planned contours" note={selectedPlannedContours.length > 0 ? `${selectedPlannedContours.length} picked` : 'Optional'} done={selectedPlannedContours.length > 0} />
                        <LayerList layers={layers} type="checkbox" name="plannedLayer" isOn={(l) => selectedPlannedContours.includes(l)} onPick={onPlannedContourChange} tall />
                    </div>

                    <Btn variant="primary" onClick={onGenerate} disabled={!ready || isProcessing}>
                        {isProcessing ? <RefreshCw className="animate-spin" /> : <Play fill="currentColor" />}
                        {isProcessing ? 'Working…' : 'Draw long section'}
                    </Btn>
                </>
            )}
        </Panel>
    );
};

export default SetupPanel;
