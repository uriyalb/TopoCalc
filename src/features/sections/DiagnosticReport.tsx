import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProcessingStep } from './types';
import { Panel, PanelHead } from '../shared/ui';

const TONE: Record<ProcessingStep['status'], { bg: string; icon: React.ReactNode }> = {
    success: { bg: 'bg-lime-100', icon: <CheckCircle2 className="h-4 w-4 text-lime-800" /> },
    warning: { bg: 'bg-yellow-200', icon: <AlertTriangle className="h-4 w-4" /> },
    error: { bg: 'bg-red-100', icon: <XCircle className="h-4 w-4 text-red-800" /> },
    info: { bg: 'bg-white', icon: <Info className="h-4 w-4" /> }
};

/** Step-by-step account of what the geometry engine found in the drawing. */
const DiagnosticReport: React.FC<{ logs: ProcessingStep[] }> = ({ logs }) => {
    if (!logs || logs.length === 0) return null;

    return (
        <Panel tone="white">
            <PanelHead icon={<Info />} title="Geometry report" />
            <ul className="grid gap-2 p-3">
                {logs.map((log, index) => {
                    const tone = TONE[log.status] ?? TONE.info;
                    return (
                        <li key={index} className={cn('flex items-start gap-2 border-2 border-black p-2', tone.bg)}>
                            <div className="mt-0.5 shrink-0">{tone.icon}</div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-black text-black">{log.step}</span>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-black">{log.status}</span>
                                </div>
                                <p className="text-sm font-medium text-black">{log.message}</p>
                                {log.details && log.details.length > 0 && (
                                    <ul className="mt-1 grid gap-0.5 font-mono text-xs text-black">
                                        {log.details.map((detail, i) => (
                                            <li key={i} className="flex gap-1.5">
                                                <span>·</span>
                                                {detail}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
};

export default DiagnosticReport;
