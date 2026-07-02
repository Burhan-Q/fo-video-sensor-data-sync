// Pure SVG geometry + readout helpers for the sensor gauges.
// All functions are side-effect-free and fully unit-testable.

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/** Convert degrees to radians. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Point on a circle of radius `r` centred at (cx, cy) at angle `deg`
 * measured clockwise from the top (SVG convention: 0° = 12 o'clock).
 */
function circlePoint(
  cx: number,
  cy: number,
  r: number,
  deg: number,
): [number, number] {
  // SVG y axis points DOWN; 0° is top (−90° in standard math coords).
  const rad = toRad(deg - 90);
  return [
    Math.round((cx + r * Math.cos(rad)) * 1e4) / 1e4,
    Math.round((cy + r * Math.sin(rad)) * 1e4) / 1e4,
  ];
}

// ---------------------------------------------------------------------------
// arcPath
// ---------------------------------------------------------------------------

/**
 * Returns an SVG path `d` string for an arc on a circle centred at (cx, cy)
 * with radius `r`, sweeping from `startDeg` to `endDeg` (clockwise, 0° = top).
 *
 * For a full 360° circle the path is built as two 180° semi-arcs to avoid the
 * SVG degenerate case where start = end.
 */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = endDeg - startDeg;

  if (Math.abs(sweep) >= 360) {
    // Full circle: two 180° arcs.
    const [x0, y0] = circlePoint(cx, cy, r, startDeg);
    const [xm, ym] = circlePoint(cx, cy, r, startDeg + 180);
    const [x1, y1] = circlePoint(cx, cy, r, startDeg + 360);
    return (
      `M ${x0} ${y0} ` +
      `A ${r} ${r} 0 0 1 ${xm} ${ym} ` +
      `A ${r} ${r} 0 0 1 ${x1} ${y1}`
    );
  }

  const [x0, y0] = circlePoint(cx, cy, r, startDeg);
  const [x1, y1] = circlePoint(cx, cy, r, endDeg);
  // large-arc-flag: 1 if sweep > 180°
  const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
  // sweep-flag: 1 = clockwise
  const sweepFlag = sweep > 0 ? 1 : 0;

  return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${x1} ${y1}`;
}

// ---------------------------------------------------------------------------
// needleAngle
// ---------------------------------------------------------------------------

/**
 * Maps `value` within [min, max] linearly to an angle within [startDeg, endDeg].
 * Clamps `value` to [min, max] before mapping.
 */
export function needleAngle(
  value: number,
  min: number,
  max: number,
  startDeg: number,
  endDeg: number,
): number {
  const clamped = Math.max(min, Math.min(max, value));
  const t = max === min ? 0 : (clamped - min) / (max - min);
  return startDeg + t * (endDeg - startDeg);
}

// ---------------------------------------------------------------------------
// normalizeSignedDeg
// ---------------------------------------------------------------------------

/**
 * Normalizes a signed angle (in degrees) to (-180, 180].
 *
 * Used by the `vector` gauge to rotate a pointer glyph by a channel's signed
 * value.
 */
export function normalizeSignedDeg(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

// ---------------------------------------------------------------------------
// linearFraction
// ---------------------------------------------------------------------------

/**
 * Maps `value` within [lo, hi] to a clamped fraction in [0, 1].
 * Returns 0 if `hi === lo` (degenerate range).
 */
export function linearFraction(value: number, lo: number, hi: number): number {
  if (hi === lo) return 0;
  const t = (value - lo) / (hi - lo);
  return Math.max(0, Math.min(1, t));
}

// ---------------------------------------------------------------------------
// frameIndexFor
// ---------------------------------------------------------------------------

/**
 * Index into `frameNumbers` (sorted ascending) of the last entry <= `frame` —
 * last-known-value semantics for sparse per-frame coverage. Clamps: before
 * the first covered frame -> 0, past the last -> the last index. Returns -1
 * only for an empty array.
 *
 * The read path compacts arrays to the frames that actually exist, so
 * positional `frame - 1` indexing is wrong whenever coverage doesn't start
 * at frame 1 or has gaps.
 */
export function frameIndexFor(frameNumbers: number[], frame: number): number {
  const n = frameNumbers.length;
  if (n === 0) return -1;
  if (frame <= frameNumbers[0]) return 0;
  if (frame >= frameNumbers[n - 1]) return n - 1;
  // Binary search: last index with frameNumbers[i] <= frame.
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frameNumbers[mid] <= frame) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ---------------------------------------------------------------------------
// DIAL_SWEEP
// ---------------------------------------------------------------------------

/**
 * Standard sweep angles for the two dial shapes:
 *  - radial: a 270° unsigned dial (e.g. min..max gauges).
 *  - signed: a 180° center-zero dial (e.g. signed-value gauges).
 */
export const DIAL_SWEEP = {
  radial: { startDeg: -135, endDeg: 135 },
  signed: { startDeg: -90, endDeg: 90 },
} as const;

// ---------------------------------------------------------------------------
// formatReadout
// ---------------------------------------------------------------------------

/**
 * Formats a gauge value as a human-readable readout string.
 *  - `null`/`undefined` -> "—".
 *  - If `valueLabels` maps the value (by its string form) to a label, that
 *    label is returned as-is (e.g. gear `3 -> "drive"`, turn_signal `-1 -> "L"`).
 *  - Otherwise a numeric readout: one decimal place if fractional, else an
 *    integer, followed by ` ${unit}` if `unit` is provided.
 */
export function formatReadout(
  value: number | null,
  valueLabels?: Record<string, string>,
  unit?: string,
): string {
  if (value == null) return "—";
  if (valueLabels && valueLabels[String(value)] != null) {
    return valueLabels[String(value)];
  }
  const numeric = value % 1 !== 0 ? value.toFixed(1) : value.toFixed(0);
  return numeric + (unit ? " " + unit : "");
}
