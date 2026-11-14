// Pure stair-geometry logic. All internal lengths are in centimetres.

export const DEFAULT_RULES = {
  roundTo: 1, // riser rounding step in cm: 1, 0.5 or 0.1
  minRiser: 10,
  maxRiser: 17.5,
  minTread: 26,
  comfortMin: 61, // 2 x riser + tread
  comfortMax: 63,
  maxFlightRise: 75, // a landing is inserted when a flight would climb more than this
  landingLength: 150,
  oddOnly: true,
};

const EPS = 1e-6;
const roundStep = (v, step) => Math.round(v / step + EPS) * step;
const floorStep = (v, step) => Math.floor(v / step + EPS) * step;
const ceilStep = (v, step) => Math.ceil(v / step - EPS) * step;
const clean = (v) => Math.round(v * 1000) / 1000;

export const treadStepFor = (rules) => (rules.roundTo >= 1 ? 1 : 0.5);

/** Split `steps` risers into flights so that no flight climbs more than maxFlightRise. */
export function splitFlights(steps, riser, rules) {
  const maxPerFlight = Math.max(1, Math.floor(rules.maxFlightRise / riser + EPS));
  const flights = Math.max(1, Math.ceil(steps / maxPerFlight - EPS));
  const base = Math.floor(steps / flights);
  const extra = steps % flights;
  return Array.from({ length: flights }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Tread limits for a riser: the comfort window (2R + T) clipped by the minimum tread. */
export function treadRange(riser, rules) {
  const step = treadStepFor(rules);
  const min = Math.max(ceilStep(rules.minTread, step), ceilStep(rules.comfortMin - 2 * riser, step));
  const max = Math.max(min, floorStep(rules.comfortMax - 2 * riser, step));
  const ideal = Math.min(max, Math.max(min, roundStep((rules.comfortMin + rules.comfortMax) / 2 - 2 * riser, step)));
  return { min: clean(min), max: clean(max), ideal: clean(ideal), step };
}

/** Full geometry for a given step count, riser and tread. */
export function buildStair({ steps, riser, tread, targetHeight = null, availableRun = null }, rules) {
  const flights = splitFlights(steps, riser, rules);
  const landings = flights.length - 1;
  // The top step of every flight lands on a landing (or the upper level), so it needs no tread.
  const treads = steps - flights.length;
  const rise = clean(steps * riser);
  const run = clean(treads * tread + landings * rules.landingLength);
  const comfort = clean(2 * riser + tread);
  return {
    key: `${steps}x${clean(riser)}`,
    steps,
    riser: clean(riser),
    tread: clean(tread),
    flights,
    landings,
    treads,
    rise,
    run,
    comfort,
    comfortOk: comfort >= rules.comfortMin - EPS && comfort <= rules.comfortMax + EPS,
    treadOk: tread >= rules.minTread - EPS,
    heightDiff: targetHeight == null ? 0 : clean(rise - targetHeight),
    fits: availableRun == null || run <= availableRun + EPS,
    overBy: availableRun == null ? 0 : clean(Math.max(0, run - availableRun)),
    slopePct: run > 0 ? (rise / run) * 100 : null,
    slopeDeg: run > 0 ? (Math.atan2(rise, run) * 180) / Math.PI : null,
  };
}

function pickTread(steps, riser, availableRun, rules) {
  const range = treadRange(riser, rules);
  if (availableRun == null) return range.ideal;
  const flights = splitFlights(steps, riser, rules);
  const treads = steps - flights.length;
  if (treads <= 0) return range.ideal;
  const room = availableRun - (flights.length - 1) * rules.landingLength;
  const fit = floorStep(room / treads, range.step);
  // Shorten the tread to fit the available run, but never below the allowed minimum.
  return fit >= range.min ? Math.min(range.ideal, clean(fit)) : range.ideal;
}

/**
 * Generate buildable stair options from whatever is known.
 * heightCm and/or steps must be given; availableRunCm is optional.
 * Returns { options, error }.
 */
export function generateOptions({ heightCm = null, steps = null, availableRunCm = null }, rules) {
  const options = [];
  const add = (n, riser) => {
    const tread = pickTread(n, riser, availableRunCm, rules);
    options.push(buildStair({ steps: n, riser, tread, targetHeight: heightCm, availableRun: availableRunCm }, rules));
  };
  const inRange = (r) => r >= rules.minRiser - EPS && r <= rules.maxRiser + EPS;

  if (heightCm != null && steps != null) {
    const riser = roundStep(heightCm / steps, rules.roundTo);
    if (!inRange(riser)) {
      return {
        options,
        error: `${steps} steps over this height gives a ${clean(heightCm / steps).toFixed(1)} cm riser, outside the allowed ${rules.minRiser}–${rules.maxRiser} cm.`,
      };
    }
    add(steps, riser);
  } else if (heightCm != null) {
    const nMin = Math.max(1, Math.floor(heightCm / rules.maxRiser) - 1);
    const nMax = Math.ceil(heightCm / rules.minRiser) + 1;
    for (let n = nMin; n <= nMax && n <= 400; n++) {
      if (rules.oddOnly && n % 2 === 0) continue;
      const riser = roundStep(heightCm / n, rules.roundTo);
      if (riser <= 0 || !inRange(riser)) continue;
      // Rounding must not add or drop what amounts to a whole step.
      if (Math.abs(n * riser - heightCm) > riser / 2 + EPS) continue;
      add(n, riser);
    }
    if (options.length === 0) {
      return { options, error: "No step count gives a riser inside the allowed range for this height. Try adjusting the rules." };
    }
  } else if (steps != null) {
    // Height unknown: sweep risers. Use a coarser sweep when rounding to millimetres.
    const sweep = Math.max(rules.roundTo, 0.5);
    for (let r = ceilStep(rules.minRiser, sweep); r <= rules.maxRiser + EPS; r += sweep) add(steps, clean(r));
  }
  return { options, error: null };
}

/** The option we preselect: fits the run if possible, then closest to target height, then a ~15 cm riser. */
export function bestOption(options) {
  if (options.length === 0) return null;
  const score = (o) => (o.fits ? 0 : 1000) + Math.abs(o.heightDiff) * 2 + Math.abs(o.riser - 15);
  return options.reduce((best, o) => (score(o) < score(best) ? o : best));
}

export const fmtCm = (v) => `${parseFloat(clean(v).toFixed(1))}`;
export const fmtM = (cm) => `${parseFloat((cm / 100).toFixed(3))}`;

/** Shortest run an option can be built in (using the shortest allowed tread). */
export function minRunFor(option, rules) {
  const { min } = treadRange(option.riser, rules);
  return buildStair({ steps: option.steps, riser: option.riser, tread: min }, rules).run;
}
