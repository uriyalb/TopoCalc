import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { MoveUp, Minus, Plus, SlidersHorizontal, AlertTriangle, Check } from "lucide-react";
import StairsDiagram, { StepDetail } from "@/components/StairsDiagram";
import { DEFAULT_RULES, generateOptions, bestOption, buildStair, treadRange, fmtCm, fmtM } from "@/lib/stairs";

const inputClass =
  "border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0";
const labelClass = "block text-lime-800 text-sm md:text-base font-bold mb-2 uppercase";

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function Field({ label, hint, ...props }) {
  return (
    <div>
      <label className={labelClass}>
        {label} {hint && <span className="text-lime-700 font-medium normal-case">· {hint}</span>}
      </label>
      <Input type="number" min="0" inputMode="decimal" className={inputClass} {...props} />
    </div>
  );
}

function Stat({ label, value, note, tone = "ok" }) {
  const tones = {
    ok: "bg-lime-900 text-lime-100",
    warn: "bg-yellow-300 text-black",
    bad: "bg-red-200 text-red-900",
  };
  return (
    <div className={`${tones[tone]} border-4 border-black shadow-[4px_4px_0px_#000] p-3 text-center`}>
      <div className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xl md:text-2xl font-black leading-tight">{value}</div>
      {note && <div className="text-xs font-bold mt-1">{note}</div>}
    </div>
  );
}

const ROUNDING = [
  { value: 1, label: "1 cm" },
  { value: 0.5, label: "0.5 cm" },
  { value: 0.1, label: "1 mm" },
];

export default function StairsCalculator() {
  const [height, setHeight] = useState("");
  const [distance, setDistance] = useState("");
  const [steps, setSteps] = useState("");
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [showRules, setShowRules] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [treadOverride, setTreadOverride] = useState(null); // { key, tread }

  const heightCm = num(height) != null ? num(height) * 100 : null;
  const availableRunCm = num(distance) != null ? num(distance) * 100 : null;
  const stepCount = num(steps) != null ? Math.round(num(steps)) : null;

  const { options, error } = useMemo(
    () =>
      heightCm == null && stepCount == null
        ? { options: [], error: null }
        : generateOptions({ heightCm, steps: stepCount, availableRunCm }, rules),
    [heightCm, stepCount, availableRunCm, rules]
  );

  const base = options.find((o) => o.key === selectedKey) ?? bestOption(options);
  const range = base ? treadRange(base.riser, rules) : null;
  const stair =
    base && treadOverride?.key === base.key
      ? buildStair({ steps: base.steps, riser: base.riser, tread: treadOverride.tread, targetHeight: heightCm, availableRun: availableRunCm }, rules)
      : base;

  const setRule = (name, value) => setRules((r) => ({ ...r, [name]: value }));
  const setRuleNum = (name) => (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v) && v > 0) setRule(name, v);
  };
  const nudgeTread = (dir) => {
    const next = Math.max(range.step, Math.round((stair.tread + dir * range.step) * 10) / 10);
    setTreadOverride({ key: base.key, tread: next });
  };
  const clear = () => {
    setHeight("");
    setDistance("");
    setSteps("");
    setSelectedKey(null);
    setTreadOverride(null);
  };

  const diffNote = (o) =>
    o.heightDiff === 0 ? "Exact" : `${o.heightDiff > 0 ? "+" : "−"}${fmtCm(Math.abs(o.heightDiff))} cm vs target`;

  return (
    <Card className="border-4 border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
      <h2 className="text-xl md:text-2xl font-black text-lime-900 mb-1 uppercase tracking-tight">Stair Builder</h2>
      <p className="text-lime-800 font-medium mb-4 md:mb-6">
        Fill in what you know. Results update as you type and use buildable, rounded dimensions.
      </p>

      <div className="grid gap-4 md:gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Height (m)" step="0.01" placeholder="e.g. 1.20" value={height} onChange={(e) => setHeight(e.target.value)} />
          <Field label="Available run (m)" hint="optional" step="0.01" placeholder="No limit" value={distance} onChange={(e) => setDistance(e.target.value)} />
          <Field label="Steps" hint="optional" step="1" placeholder="Auto" value={steps} onChange={(e) => setSteps(e.target.value)} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lime-800 text-sm md:text-base font-bold uppercase">Round risers to</span>
          <div className="flex border-4 border-black shadow-[4px_4px_0px_#000]">
            {ROUNDING.map((r) => (
              <button
                key={r.value}
                onClick={() => setRule("roundTo", r.value)}
                aria-pressed={rules.roundTo === r.value}
                className={`px-3 py-2 font-black uppercase text-sm border-r-4 last:border-r-0 border-black ${
                  rules.roundTo === r.value ? "bg-lime-900 text-lime-100" : "bg-white hover:bg-lime-100 text-black"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <Button
            onClick={() => setShowRules((v) => !v)}
            aria-expanded={showRules}
            className="bg-lime-300 hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] font-black uppercase"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Rules
          </Button>
          <Button onClick={clear} className="bg-lime-300 hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] font-black uppercase">
            Clear
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {showRules && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-lime-100 border-4 border-black p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Min riser (cm)" step="0.5" value={rules.minRiser} onChange={setRuleNum("minRiser")} />
                <Field label="Max riser (cm)" step="0.5" value={rules.maxRiser} onChange={setRuleNum("maxRiser")} />
                <Field label="Min tread (cm)" step="1" value={rules.minTread} onChange={setRuleNum("minTread")} />
                <Field label="Max rise per flight (cm)" step="5" value={rules.maxFlightRise} onChange={setRuleNum("maxFlightRise")} />
                <Field label="Landing length (cm)" step="10" value={rules.landingLength} onChange={setRuleNum("landingLength")} />
                <label className="flex items-center gap-3 font-bold text-lime-800 uppercase text-sm md:text-base self-end pb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules.oddOnly}
                    onChange={(e) => setRule("oddOnly", e.target.checked)}
                    className="w-6 h-6 accent-lime-700 border-4 border-black"
                  />
                  Odd step counts only
                </label>
                <div className="col-span-2 md:col-span-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-lime-800">
                    Comfort rule: 2 × riser + tread = {rules.comfortMin}–{rules.comfortMax} cm.
                  </span>
                  <button onClick={() => setRules(DEFAULT_RULES)} className="text-sm font-black uppercase underline text-lime-900">
                    Reset rules
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <Card className="bg-red-100 text-red-800 border-4 border-black shadow-[8px_8px_0px_#000] p-4 text-center">
            <p className="text-lg font-bold">{error}</p>
          </Card>
        )}

        {!stair && !error && (
          <div className="bg-lime-100 border-4 border-dashed border-black p-6 text-center text-lime-800 font-bold uppercase">
            <MoveUp className="w-8 h-8 mx-auto mb-2" />
            Enter a height or a number of steps to draw the stair
          </div>
        )}

        {stair && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
            {options.length > 1 && (
              <div>
                <div className={labelClass}>Options · {options.length}</div>
                <div className="flex flex-wrap gap-2">
                  {options.map((o) => {
                    const active = o.key === base.key;
                    return (
                      <button
                        key={o.key}
                        onClick={() => {
                          setSelectedKey(o.key);
                          setTreadOverride(null);
                        }}
                        aria-pressed={active}
                        title={o.fits ? diffNote(o) : `Needs ${fmtM(o.overBy)} m more run`}
                        className={`px-3 py-2 border-4 border-black font-black text-sm uppercase text-left leading-tight ${
                          active
                            ? "bg-lime-900 text-lime-100 shadow-none translate-x-[2px] translate-y-[2px]"
                            : o.fits
                              ? "bg-white hover:bg-lime-100 text-black shadow-[4px_4px_0px_#000]"
                              : "bg-red-100 hover:bg-red-200 text-red-900 shadow-[4px_4px_0px_#000]"
                        }`}
                      >
                        {heightCm != null ? `${o.steps} steps` : `${fmtM(o.rise)} m`}
                        <span className="block text-xs font-bold opacity-80">
                          {fmtCm(o.riser)} cm riser{!o.fits && " · too long"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-lime-900 text-lime-100 border-4 border-black shadow-[8px_8px_0px_#000] p-4 md:p-5 text-center">
              <div className="text-sm font-bold uppercase tracking-wide text-lime-300">Stair configuration</div>
              <div className="text-3xl md:text-4xl font-black my-1">
                {stair.steps} steps × {fmtCm(stair.riser)} cm
              </div>
              <div className="text-lime-300 font-bold">
                Tread {fmtCm(stair.tread)} cm
                {stair.landings > 0 && ` · ${stair.landings} landing${stair.landings > 1 ? "s" : ""} (flights of ${stair.flights.join(" + ")})`}
              </div>
            </div>

            <StairsDiagram stair={stair} landingLength={rules.landingLength} availableRun={availableRunCm} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat
                label="Built height"
                value={`${fmtM(stair.rise)} m`}
                note={heightCm != null ? diffNote(stair) : null}
                tone={Math.abs(stair.heightDiff) > 3 ? "warn" : "ok"}
              />
              <Stat
                label="Total run"
                value={`${fmtM(stair.run)} m`}
                note={availableRunCm == null ? null : stair.fits ? `${fmtM(availableRunCm - stair.run)} m to spare` : `${fmtM(stair.overBy)} m too long`}
                tone={stair.fits ? "ok" : "bad"}
              />
              <Stat
                label="2R + T"
                value={`${fmtCm(stair.comfort)} cm`}
                note={stair.comfortOk ? "Comfortable" : `Outside ${rules.comfortMin}–${rules.comfortMax}`}
                tone={stair.comfortOk ? "ok" : "warn"}
              />
              <Stat
                label="Slope"
                value={stair.slopePct == null ? "—" : `${Math.round(stair.slopePct)}%`}
                note={stair.slopeDeg == null ? null : `${stair.slopeDeg.toFixed(1)}° overall`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-lime-100 border-4 border-black shadow-[4px_4px_0px_#000] p-4">
                <div className={labelClass}>Step detail · shoe 28 cm</div>
                <StepDetail riser={stair.riser} tread={stair.tread} />
              </div>
              <div className="bg-lime-100 border-4 border-black shadow-[4px_4px_0px_#000] p-4 flex flex-col gap-3">
                <div className={labelClass + " mb-0"}>Fine-tune tread</div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => nudgeTread(-1)}
                    aria-label="Shorter tread"
                    className="bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] h-12 w-12 p-0"
                  >
                    <Minus className="w-5 h-5" />
                  </Button>
                  <div className="flex-1 text-center bg-white border-4 border-black py-2 text-2xl font-black">{fmtCm(stair.tread)} cm</div>
                  <Button
                    onClick={() => nudgeTread(1)}
                    aria-label="Longer tread"
                    className="bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] h-12 w-12 p-0"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
                <ul className="text-sm font-bold text-lime-900 grid gap-1">
                  <Check_ ok={stair.comfortOk}>
                    Comfort range for this riser: {fmtCm(range.min)}–{fmtCm(range.max)} cm
                  </Check_>
                  <Check_ ok={stair.treadOk}>Minimum tread {fmtCm(rules.minTread)} cm</Check_>
                  {availableRunCm != null && <Check_ ok={stair.fits}>Fits the available {fmtM(availableRunCm)} m</Check_>}
                  {heightCm != null && stair.heightDiff !== 0 && (
                    <Check_ ok={Math.abs(stair.heightDiff) <= 3}>
                      Built height is {fmtCm(Math.abs(stair.heightDiff))} cm {stair.heightDiff > 0 ? "above" : "below"} target — absorb it in grading, or round finer
                    </Check_>
                  )}
                </ul>
                {treadOverride?.key === base.key && (
                  <button onClick={() => setTreadOverride(null)} className="self-start text-sm font-black uppercase underline text-lime-900">
                    Reset tread
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </Card>
  );
}

function Check_({ ok, children }) {
  return (
    <li className={`flex items-start gap-2 ${ok ? "" : "text-red-800"}`}>
      {ok ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span>{children}</span>
    </li>
  );
}
