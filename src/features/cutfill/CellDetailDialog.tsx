import React, { useState } from 'react';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModalData, CalculationStep } from './types';
import { COLORS } from '../shared/palette';
import { Btn, EmptyState, Modal, Panel, Segmented, labelClass } from '../shared/ui';

interface CellDetailDialogProps {
  data: ModalData | null;
  /** Name of the grid point at row r, node column c (same letters as on the grid). */
  labelOf: (r: number, c: number) => string;
  onClose: () => void;
}

const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

export const CellDetailDialog: React.FC<CellDetailDialogProps> = ({ data, labelOf, onClose }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'calc'>('summary');
  const [showGeometry, setShowGeometry] = useState(false);

  if (!data) return null;
  const { r, c, results, nodes } = data;

  const cutSteps = results.steps.filter(s => s.category === 'cut');
  const fillSteps = results.steps.filter(s => s.category === 'fill');
  const geoSteps = results.steps.filter(s => s.category === 'geometry');

  // Corners in reading order. Node columns count from the right, so the left side is c + 1.
  const corners = [
    { name: labelOf(r, c + 1), val: nodes[0].val },
    { name: labelOf(r, c), val: nodes[1].val },
    { name: labelOf(r + 1, c + 1), val: nodes[3].val },
    { name: labelOf(r + 1, c), val: nodes[2].val }
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Cell ${corners[0].name}–${corners[3].name}`}
      icon={<Calculator />}
      className="max-w-2xl"
      footer={<Btn onClick={onClose}>Close</Btn>}
    >
      <div className="grid gap-4">
        <Segmented
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          label="View"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'summary', label: 'Summary' },
            { value: 'calc', label: 'Working' }
          ]}
        />

        {activeTab === 'summary' && (
          <>
            {/* Level change at the four corners, laid out as on the grid */}
            <div>
              <div className={cn(labelClass, 'mb-2')}>Planned − existing at the corners (m)</div>
              <div className="grid grid-cols-2 gap-3">
                {corners.map((n) => (
                  <div key={n.name} className="flex items-center justify-between gap-2 border-4 border-black bg-white px-3 py-2 shadow-[4px_4px_0px_#000]">
                    <span className="text-sm font-black text-black">{n.name}</span>
                    <span className="font-mono text-lg font-black tabular-nums" style={{ color: n.val > 0 ? COLORS.fill : n.val < 0 ? COLORS.cut : '#a8a29e' }}>
                      {signed(n.val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <VolumeCard title="Cut" color={COLORS.cut} volume={results.cutVol} area={results.realCutArea} avg={results.cutAvgH} avgLabel="Avg. depth" />
              <VolumeCard title="Fill" color={COLORS.fill} volume={results.fillVol} area={results.realFillArea} avg={results.fillAvgH} avgLabel="Avg. height" />
            </div>
          </>
        )}

        {activeTab === 'calc' && (
          <>
            {/* Geometry Section */}
            {geoSteps.length > 0 && (
              <Panel tone="white">
                <button type="button" onClick={() => setShowGeometry(!showGeometry)} aria-expanded={showGeometry} className="flex w-full items-center justify-between gap-2 bg-lime-300 px-3 py-2 text-sm font-black uppercase text-black hover:bg-lime-400">
                  Zero line · where cut meets fill
                  {showGeometry ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showGeometry && (
                  <ul className="grid gap-2 border-t-4 border-black p-3">
                    {geoSteps.map((step, i) => (
                      <li key={i} className="text-sm">
                        <p className="font-bold text-black">{step.description}</p>
                        <p className="font-mono text-xs text-lime-800">{step.formula} → {step.result}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}

            {/* Volume Calc logic */}
            {cutSteps.length > 0 && <StepList title="Cut polygons" color={COLORS.cut} steps={cutSteps} />}
            {fillSteps.length > 0 && <StepList title="Fill polygons" color={COLORS.fill} steps={fillSteps} />}

            {cutSteps.length === 0 && fillSteps.length === 0 && <EmptyState>No cut or fill in this cell</EmptyState>}
          </>
        )}
      </div>
    </Modal>
  );
};

function VolumeCard({ title, color, volume, area, avg, avgLabel }: { title: string; color: string; volume: number; area: number; avg: number; avgLabel: string }) {
  return (
    <Panel tone="white" className="p-3">
      <div className="flex items-center gap-2 text-sm font-black uppercase text-black">
        <span className="h-3 w-3 border-2 border-black" style={{ background: color }} />
        {title}
      </div>
      <div className="font-mono text-3xl font-black tabular-nums text-black">
        {volume.toFixed(3)}
        <span className="ml-1 text-sm font-bold">m³</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 border-t-2 border-black pt-2 text-sm">
        <div>
          <span className={cn(labelClass, 'block')}>Area</span>
          <span className="font-mono font-bold">{area.toFixed(2)} m²</span>
        </div>
        <div>
          <span className={cn(labelClass, 'block')}>{avgLabel}</span>
          <span className="font-mono font-bold">{avg.toFixed(3)} m</span>
        </div>
      </div>
    </Panel>
  );
}

function StepList({ title, color, steps }: { title: string; color: string; steps: CalculationStep[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-black uppercase text-black">
        <span className="h-3 w-3 border-2 border-black" style={{ background: color }} />
        {title}
        <span className="ml-auto text-xs font-bold normal-case text-lime-700">area × average = volume</span>
      </div>
      <div className="grid gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-2 border-black bg-white px-3 py-2">
            <span className="text-sm font-bold text-black">{step.description}</span>
            <span className="font-mono text-sm text-black">
              {step.area !== undefined && step.avgH !== undefined && step.vol !== undefined ? (
                <>
                  {step.area.toFixed(4)} m² × {step.avgH.toFixed(4)} m = <b style={{ color }}>{step.vol.toFixed(4)} m³</b>
                </>
              ) : (
                <>
                  {step.formula} = <b style={{ color }}>{step.result}</b>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
