import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import { MoveUp, Minus, Plus, SlidersHorizontal, AlertTriangle, Check, HelpCircle } from "lucide-react";
import StairsDiagram, { StepDetail } from "@/components/StairsDiagram";
import { DEFAULT_RULES, generateOptions, bestOption, buildStair, treadRange, minRunFor, fmtCm, fmtM } from "@/lib/stairs";

const inputClass =
  "border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0";
const labelClass = "text-lime-800 text-sm md:text-base font-bold uppercase";
const squareBtn = "bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] h-11 w-11 p-0 shrink-0";

const GLOSSARY = {
  rise: "The vertical difference between the lower and the upper level.",
  run: "The horizontal length of the whole stair, landings included. Leave empty if there is no limit.",
  steps: "The number of risers. Leave empty to see every count that works.",
  riser: "The height of a single step.",
  tread: "The depth of a single step — where the foot lands.",
  landing: "A flat rest between flights. One is added whenever a flight would climb more than the limit set in Rules.",
};

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** A "?" that explains a term and highlights it in the drawings while open. */
function Term({ id, onHighlight }) {
  return (
    <Popover onOpenChange={(open) => onHighlight(open ? id : null)}>
      <PopoverTrigger asChild>
        <button aria-label={`What is ${id}?`} className="inline-flex align-middle ml-1 text-lime-700 hover:text-black">
          <HelpCircle className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 border-4 border-black rounded-none shadow-[4px_4px_0px_#000] bg-white text-sm font-medium text-black">
        {GLOSSARY[id]}
      </PopoverContent>
    </Popover>
  );
}

function Field({ label, term, onHighlight, hint, fix, bad, ...props }) {
  return (
    <div>
      <label className={`${labelClass} block mb-2`}>
        {label}
        {term && <Term id={term} onHighlight={onHighlight} />}
      </label>
      <Input type="number" min="0" inputMode="decimal" className={`${inputClass} ${bad ? "bg-red-100" : ""}`} {...props} />
      <div className={`mt-2 min-h-5 text-sm font-bold ${bad ? "text-red-800" : "text-lime-700"}`}>
        {hint}
        {fix && (
          <button onClick={fix.apply} className="ml-2 underline font-black uppercase">
            Use {fix.label}
          </button>
        )}
      </div>
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
  const [highlight, setHighlight] = useState(null);

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
  // Every step count that works for this height, ignoring the other fields — drives the hints.
  const free = useMemo(() => (heightCm == null ? [] : generateOptions({ heightCm }, rules).options), [heightCm, rules]);

  const base = options.find((o) => o.key === selectedKey) ?? bestOption(options);
  const range = base ? treadRange(base.riser, rules) : null;
  const stair =
    base && treadOverride?.key === base.key
      ? buildStair({ steps: base.steps, riser: base.riser, tread: treadOverride.tread, targetHeight: heightCm, availableRun: availableRunCm }, rules)
      : base;

  // ---- Field hints ----
  let heightHint = null;
  if (heightCm == null && stepCount != null) {
    heightHint = `${fmtM(stepCount * rules.minRiser)}–${fmtM(stepCount * rules.maxRiser)} m with ${stepCount} steps`;
  }

  let stepsHint = null;
  let stepsFix = null;
  const stepsBad = Boolean(error && stepCount != null);
  if (free.length > 0) {
    const counts = free.map((o) => o.steps);
    stepsHint = `${Math.min(...counts)}–${Math.max(...counts)} work${rules.oddOnly ? " (odd only)" : ""}`;
    if (stepsBad) {
      const nearest = counts.reduce((a, b) => (Math.abs(b - stepCount) < Math.abs(a - stepCount) ? b : a));
      stepsHint = "Out of range.";
      stepsFix = { label: `${nearest}`, apply: () => setSteps(String(nearest)) };
    }
  }

  let runHint = null;
  let runFix = null;
  let runBad = false;
  const runPool = stepCount != null || heightCm == null ? options : free;
  if (runPool.length > 0) {
    const minRun = Math.min(...runPool.map((o) => minRunFor(o, rules)));
    runHint = `Min ${fmtM(minRun)} m`;
    if (availableRunCm != null && availableRunCm < minRun - 1e-6) {
      runBad = true;
      runHint = `Too short, needs ${fmtM(minRun)} m.`;
      runFix = { label: `${fmtM(minRun)}`, apply: () => setDistance(String(parseFloat((Math.ceil(minRun) / 100).toFixed(2)))) };
    }
  }

  // ---- Actions ----
  const setRule = (name, value) => setRules((r) => ({ ...r, [name]: value }));
  const setRuleNum = (name) => (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v) && v > 0) setRule(name, v);
  };
  const select = (o) => {
    setSelectedKey(o.key);
    setTreadOverride(null);
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

  // ---- Checks: only what needs attention ----
  const issues = [];
  if (stair) {
    if (!stair.fits) issues.push(`${fmtM(stair.overBy)} m longer than the available run.`);
    if (!stair.treadOk) issues.push(`Tread is below the ${fmtCm(rules.minTread)} cm minimum.`);
    if (!stair.comfortOk)
      issues.push(`2 × riser + tread = ${fmtCm(stair.comfort)} cm. Comfortable is ${rules.comfortMin}–${rules.comfortMax} (tread ${fmtCm(range.min)}–${fmtCm(range.max)}).`);
    if (heightCm != null && stair.heightDiff !== 0)
      issues.push(
        `Builds ${fmtCm(Math.abs(stair.heightDiff))} cm ${stair.heightDiff > 0 ? "above" : "below"} the target height. Absorb it in grading or round finer.`
      );
  }

  const index = base ? options.findIndex((o) => o.key === base.key) : -1;
  const recommended = bestOption(options);
  const byRiser = heightCm == null; // slider walks risers when the height is open

  return (
    <Card className="border-4 border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
      <h2 className="text-xl md:text-2xl font-black text-lime-900 mb-4 uppercase tracking-tight">Stair Builder</h2>

      <div className="grid gap-4 [&>*]:min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2">
          <Field label="Height (m)" term="rise" onHighlight={setHighlight} step="0.01" placeholder="e.g. 1.20" value={height} onChange={(e) => setHeight(e.target.value)} hint={heightHint} />
          <Field label="Available run (m)" term="run" onHighlight={setHighlight} step="0.01" placeholder="No limit" value={distance} onChange={(e) => setDistance(e.target.value)} hint={runHint} fix={runFix} bad={runBad} />
          <Field label="Steps" term="steps" onHighlight={setHighlight} step="1" placeholder="Auto" value={steps} onChange={(e) => setSteps(e.target.value)} hint={stepsHint} fix={stepsFix} bad={stepsBad} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className={labelClass}>Round to</span>
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
          <span className="text-sm font-bold text-lime-700">
            Riser {fmtCm(rules.minRiser)}–{fmtCm(rules.maxRiser)} · Tread {fmtCm(rules.minTread)}+
          </span>
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
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-lime-100 border-4 border-black p-4 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                <Field label="Min riser (cm)" step="0.5" value={rules.minRiser} onChange={setRuleNum("minRiser")} />
                <Field label="Max riser (cm)" step="0.5" value={rules.maxRiser} onChange={setRuleNum("maxRiser")} />
                <Field label="Min tread (cm)" step="1" value={rules.minTread} onChange={setRuleNum("minTread")} />
                <Field label="Max rise per flight (cm)" step="5" value={rules.maxFlightRise} onChange={setRuleNum("maxFlightRise")} />
                <Field label="Landing length (cm)" step="10" value={rules.landingLength} onChange={setRuleNum("landingLength")} />
                <label className={`${labelClass} flex items-center gap-3 cursor-pointer`}>
                  <input type="checkbox" checked={rules.oddOnly} onChange={(e) => setRule("oddOnly", e.target.checked)} className="w-6 h-6 accent-lime-700" />
                  Odd step counts only
                </label>
                <div className="col-span-2 md:col-span-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-lime-800">
                    Comfort: 2 × riser + tread = {rules.comfortMin}–{rules.comfortMax} cm
                  </span>
                  <button onClick={() => setRules(DEFAULT_RULES)} className="text-sm font-black uppercase underline text-lime-900">
                    Reset
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!stair && (
          <div className="bg-lime-100 border-4 border-dashed border-black p-6 text-center text-lime-800 font-bold uppercase">
            <MoveUp className="w-8 h-8 mx-auto mb-2" />
            {error ? "No stair fits these numbers" : "Enter a height to start"}
          </div>
        )}

        {stair && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 [&>*]:min-w-0">
            <div className="bg-lime-900 text-lime-100 border-4 border-black shadow-[8px_8px_0px_#000] p-4 text-center">
              <div className="text-2xl md:text-3xl font-black leading-tight">
                {stair.steps} steps · Riser {fmtCm(stair.riser)} · Tread {fmtCm(stair.tread)} cm
              </div>
              <div className="text-lime-300 font-bold mt-1">
                Rise {fmtM(stair.rise)} m · Run {fmtM(stair.run)} m
                {stair.landings > 0 && ` · ${stair.landings} landing${stair.landings > 1 ? "s" : ""}`}
                {stair.slopePct != null && ` · ${Math.round(stair.slopePct)}%`}
              </div>
            </div>

            {options.length > 1 && (
              <div className="bg-lime-100 border-4 border-black shadow-[4px_4px_0px_#000] p-3 flex items-center gap-3">
                <span className={`${labelClass} shrink-0 hidden sm:inline`}>{byRiser ? "Riser" : "Steps"}</span>
                <Button onClick={() => select(options[index - 1])} disabled={index <= 0} aria-label="Previous option" className={squareBtn}>
                  <Minus className="w-5 h-5" />
                </Button>
                <input
                  type="range"
                  min={0}
                  max={options.length - 1}
                  step={1}
                  value={index}
                  onChange={(e) => select(options[Number(e.target.value)])}
                  aria-label={byRiser ? "Riser height" : "Number of steps"}
                  aria-valuetext={byRiser ? `${fmtCm(base.riser)} cm` : `${base.steps} steps`}
                  className="flex-1 min-w-0 h-3 accent-lime-800 cursor-pointer"
                />
                <Button onClick={() => select(options[index + 1])} disabled={index >= options.length - 1} aria-label="Next option" className={squareBtn}>
                  <Plus className="w-5 h-5" />
                </Button>
                <span className="shrink-0 w-20 sm:w-24 text-right text-sm font-black uppercase leading-tight">
                  {byRiser ? `${fmtCm(base.riser)} cm` : `${base.steps} steps`}
                  <span className="block text-xs font-bold text-lime-700">
                    {base.key === recommended.key ? "Suggested" : `${index + 1} of ${options.length}`}
                  </span>
                </span>
              </div>
            )}

            <StairsDiagram stair={stair} landingLength={rules.landingLength} availableRun={availableRunCm} highlight={highlight} />

            <div className="bg-lime-100 border-4 border-black shadow-[4px_4px_0px_#000] p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center [&>*]:min-w-0">
              <StepDetail riser={stair.riser} tread={stair.tread} highlight={highlight} />
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <span className={labelClass}>
                    Riser
                    <Term id="riser" onHighlight={setHighlight} />
                  </span>
                  <span className="text-xl font-black">{fmtCm(stair.riser)} cm</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`${labelClass} flex-1`}>
                    Tread
                    <Term id="tread" onHighlight={setHighlight} />
                  </span>
                  <Button onClick={() => nudgeTread(-1)} aria-label="Shorter tread" className={squareBtn}>
                    <Minus className="w-5 h-5" />
                  </Button>
                  <span className="w-20 text-center text-xl font-black">{fmtCm(stair.tread)} cm</span>
                  <Button onClick={() => nudgeTread(1)} aria-label="Longer tread" className={squareBtn}>
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
                {stair.landings > 0 && (
                  <div className="flex items-center justify-between">
                    <span className={labelClass}>
                      Landings
                      <Term id="landing" onHighlight={setHighlight} />
                    </span>
                    <span className="text-xl font-black">
                      {stair.landings} × {fmtM(rules.landingLength)} m
                    </span>
                  </div>
                )}
                {treadOverride?.key === base.key && (
                  <button onClick={() => setTreadOverride(null)} className="justify-self-start text-sm font-black uppercase underline text-lime-900">
                    Reset tread
                  </button>
                )}
              </div>
            </div>

            {issues.length === 0 ? (
              <div className="flex items-center gap-2 font-black uppercase text-lime-900">
                <Check className="w-5 h-5" /> Comfortable and within the rules
              </div>
            ) : (
              <ul className="bg-yellow-200 border-4 border-black shadow-[4px_4px_0px_#000] p-3 grid gap-2 text-sm font-bold text-black">
                {issues.map((text) => (
                  <li key={text} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </div>
    </Card>
  );
}
