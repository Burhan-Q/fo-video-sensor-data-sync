import React, { useMemo } from "react";
import { Text, TextVariant } from "@voxel51/voodo";

import { useFrameSync } from "./useFrameSync";
import { useSensorData } from "./useSensorData";
import { PALETTE } from "./palette";
import { Centered, sensorPanelMessage } from "./panelCommon";
import type { Channel, Entity, SensorSchema } from "./types";
import {
  arcPath,
  needleAngle,
  normalizeSignedDeg,
  linearFraction,
  frameIndexFor,
  DIAL_SWEEP,
  formatReadout,
} from "./gauges";

const DIM_COLOR = "rgba(160,160,180,0.6)";
const TRACK_COLOR = "rgba(80,80,100,0.5)";

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Compute max absolute value in array (ignoring nulls); fallback to `def`. */
function absMax(arr: Array<number | null> | undefined, def: number): number {
  let m = 0;
  if (arr) {
    for (const v of arr) {
      if (v != null && Math.abs(v) > m) m = Math.abs(v);
    }
  }
  return m > 0 ? m : def;
}

/** Compute max value in array (ignoring nulls); fallback to `def`. */
function maxVal(arr: Array<number | null> | undefined, def: number): number {
  let m = -Infinity;
  if (arr) {
    for (const v of arr) {
      if (v != null && v > m) m = v;
    }
  }
  return m > -Infinity ? m : def;
}

// ---------------------------------------------------------------------------
// SVG Gauge components
// ---------------------------------------------------------------------------

const SVG_SIZE = 140; // px for each gauge
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const R_OUTER = 58;
const R_INNER = 46;
const NEEDLE_LEN = 44;
const NEEDLE_BASE = 8;

interface AnalogGaugeProps {
  value: number | null;
  min: number;
  max: number;
  startDeg: number;
  endDeg: number;
  label: string;
  unit?: string;
  color: string;
  /** Draw a tick at the center (e.g. for signed center-zero dials). */
  showZeroMark?: boolean;
  /** Optional value -> display-label mapping for the center readout. */
  valueLabels?: Record<string, string>;
}

/**
 * Radial / signed analog dial. Serves both the 270° unsigned (`radial`) and the
 * 180° center-zero (`signed`) shapes via `startDeg`/`endDeg` + `showZeroMark`.
 */
function AnalogGauge({
  value,
  min,
  max,
  startDeg,
  endDeg,
  label,
  unit,
  color,
  showZeroMark,
  valueLabels,
}: AnalogGaugeProps) {
  const trackPath = arcPath(CX, CY, R_OUTER, startDeg, endDeg);
  const hasValue = value != null;

  // Filled arc from startDeg to needle position
  let fillPath: string | null = null;
  let angle = startDeg;
  if (hasValue) {
    angle = needleAngle(value!, min, max, startDeg, endDeg);
    if (Math.abs(angle - startDeg) > 0.5) {
      fillPath = arcPath(CX, CY, R_OUTER - 3, startDeg, angle);
    }
  }

  // Needle tip position
  const rad = ((angle - 90) * Math.PI) / 180;
  const tipX = CX + NEEDLE_LEN * Math.cos(rad);
  const tipY = CY + NEEDLE_LEN * Math.sin(rad);

  // Needle base left/right perp
  const baseRad = rad + Math.PI / 2;
  const b1x = CX + NEEDLE_BASE * Math.cos(baseRad);
  const b1y = CY + NEEDLE_BASE * Math.sin(baseRad);
  const b2x = CX - NEEDLE_BASE * Math.cos(baseRad);
  const b2y = CY - NEEDLE_BASE * Math.sin(baseRad);

  // Center readout: a value_labels mapping (if any) wins over the number; the
  // separate unit line is only rendered when the readout is still numeric.
  const readout = formatReadout(value, valueLabels, undefined);
  const mappedLabel =
    hasValue && valueLabels != null && valueLabels[String(value)] != null;

  return (
    <svg
      width={SVG_SIZE}
      height={SVG_SIZE}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      style={{ display: "block" }}
    >
      {/* Track arc */}
      <path
        d={trackPath}
        fill="none"
        stroke={TRACK_COLOR}
        strokeWidth={10}
        strokeLinecap="round"
      />
      {/* Filled arc (value fill) */}
      {fillPath && (
        <path
          d={fillPath}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.7}
        />
      )}
      {/* Center tick for signed dials */}
      {showZeroMark && (
        <line
          x1={CX}
          y1={CY - R_OUTER + 2}
          x2={CX}
          y2={CY - R_INNER + 2}
          stroke={DIM_COLOR}
          strokeWidth={1.5}
        />
      )}
      {/* Needle */}
      {hasValue && (
        <polygon
          points={`${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}`}
          fill={color}
          opacity={0.95}
        />
      )}
      {/* Hub circle */}
      <circle cx={CX} cy={CY} r={5} fill={color} opacity={0.9} />
      {/* Digital readout */}
      <text
        x={CX}
        y={CY + 26}
        textAnchor="middle"
        fontSize={16}
        fontWeight="bold"
        fill={hasValue ? color : DIM_COLOR}
        fontFamily="monospace"
      >
        {readout}
      </text>
      {/* Unit line — only when the readout is numeric (no value_labels match) */}
      {unit && !mappedLabel && (
        <text
          x={CX}
          y={CY + 38}
          textAnchor="middle"
          fontSize={9}
          fill={DIM_COLOR}
          fontFamily="sans-serif"
        >
          {unit}
        </text>
      )}
      {/* Label at bottom */}
      <text
        x={CX}
        y={SVG_SIZE - 4}
        textAnchor="middle"
        fontSize={9}
        fill="rgba(180,180,200,0.75)"
        fontFamily="sans-serif"
        letterSpacing={0.5}
      >
        {label.toUpperCase()}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar gauge (linear)
// ---------------------------------------------------------------------------

const BAR_W = 120;
const BAR_H = 24;

interface LinearGaugeProps {
  value: number | null;
  lo: number;
  hi: number;
  label: string;
  unit?: string;
  color: string;
  valueLabels?: Record<string, string>;
}

function LinearGauge({
  value,
  lo,
  hi,
  label,
  unit,
  color,
  valueLabels,
}: LinearGaugeProps) {
  const hasValue = value != null;
  const fillW = hasValue ? linearFraction(value!, lo, hi) * BAR_W : 0;
  const readout = formatReadout(value, valueLabels, unit);

  return (
    <div style={styles.barWrap}>
      <svg width={BAR_W} height={BAR_H} style={{ display: "block" }}>
        {/* Background track */}
        <rect x={0} y={6} width={BAR_W} height={12} rx={4} fill={TRACK_COLOR} />
        {/* Fill */}
        {hasValue && (
          <rect
            x={0}
            y={6}
            width={fillW}
            height={12}
            rx={4}
            fill={color}
            opacity={0.85}
          />
        )}
      </svg>
      <div style={styles.barLabel}>
        <span style={{ fontSize: 11, color, fontFamily: "monospace" }}>
          {readout}
        </span>
        <span style={{ fontSize: 9, color: DIM_COLOR, marginLeft: 4 }}>
          {label.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vector gauge (rotating pointer relative to a static "up" reference)
// ---------------------------------------------------------------------------

const COMPASS_SIZE = 140;
const CCX = COMPASS_SIZE / 2;
const CCY = COMPASS_SIZE / 2;
const COMPASS_R = 52;

interface VectorGaugeProps {
  value: number | null;
  label: string;
  color: string;
  valueLabels?: Record<string, string>;
}

// A static "up" reference arrow (locked to 12 o'clock) plus a pointer glyph
// rotated by the signed value. Sign is preserved: a positive value rotates the
// pointer clockwise of the reference.
function VectorGauge({ value, label, color, valueLabels }: VectorGaugeProps) {
  const hasData = value != null;

  const pointerTransform = hasData
    ? `rotate(${normalizeSignedDeg(value!)}, ${CCX}, ${CCY})`
    : undefined;

  const readout = formatReadout(value, valueLabels, undefined);

  return (
    <svg
      width={COMPASS_SIZE}
      height={COMPASS_SIZE}
      viewBox={`0 0 ${COMPASS_SIZE} ${COMPASS_SIZE}`}
      style={{ display: "block" }}
    >
      {/* Compass ring */}
      <circle
        cx={CCX}
        cy={CCY}
        r={COMPASS_R}
        fill="none"
        stroke={TRACK_COLOR}
        strokeWidth={2}
      />
      {/* Reference arrow — STATIC at 12 o'clock (always up). */}
      {hasData && (
        <g opacity={0.9}>
          {/* Arrow shaft */}
          <line
            x1={CCX}
            y1={CCY + 4}
            x2={CCX}
            y2={CCY - COMPASS_R + 8}
            stroke={DIM_COLOR}
            strokeWidth={2}
            strokeDasharray="4 3"
            opacity={0.6}
          />
          {/* Arrowhead */}
          <polygon
            points={`${CCX},${CCY - COMPASS_R + 4} ${CCX - 5},${CCY - COMPASS_R + 14} ${CCX + 5},${CCY - COMPASS_R + 14}`}
            fill={DIM_COLOR}
            opacity={0.7}
          />
        </g>
      )}

      {/* Pointer glyph — a generic arrow rotated by the signed value. */}
      {hasData && pointerTransform ? (
        <g transform={pointerTransform}>
          {/* Pointer shaft */}
          <line
            x1={CCX}
            y1={CCY + 10}
            x2={CCX}
            y2={CCY - 18}
            stroke={color}
            strokeWidth={3}
            opacity={0.95}
          />
          {/* Pointer head (triangle/arrow tip) */}
          <polygon
            points={`${CCX},${CCY - 26} ${CCX - 7},${CCY - 12} ${CCX + 7},${CCY - 12}`}
            fill={color}
            opacity={0.95}
          />
        </g>
      ) : (
        // No-data placeholder pointer (not rotated, dimmed)
        <g opacity={0.4}>
          <line
            x1={CCX}
            y1={CCY + 10}
            x2={CCX}
            y2={CCY - 18}
            stroke={DIM_COLOR}
            strokeWidth={3}
          />
          <polygon
            points={`${CCX},${CCY - 26} ${CCX - 7},${CCY - 12} ${CCX + 7},${CCY - 12}`}
            fill={DIM_COLOR}
          />
        </g>
      )}

      {/* Center readout */}
      <text
        x={CCX}
        y={COMPASS_SIZE - 16}
        textAnchor="middle"
        fontSize={12}
        fontWeight="bold"
        fill={hasData ? color : DIM_COLOR}
        fontFamily="monospace"
      >
        {readout}
      </text>

      {/* Label */}
      <text
        x={CCX}
        y={COMPASS_SIZE - 4}
        textAnchor="middle"
        fontSize={9}
        fill="rgba(180,180,200,0.75)"
        fontFamily="sans-serif"
        letterSpacing={0.5}
      >
        {label.toUpperCase()}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Resolved per-gauge spec — shared by the SVG render path and the fallback
// ---------------------------------------------------------------------------

type GaugeKind = "radial" | "signed" | "linear" | "vector";

interface GaugeSpec {
  key: string; // unique render key
  kind: GaugeKind;
  value: number | null;
  label: string;
  unit?: string;
  color: string;
  valueLabels?: Record<string, string>;
  // radial / signed
  min?: number;
  max?: number;
  // linear
  lo?: number;
  hi?: number;
}

interface EntityGroup {
  label: string;
  color: string;
  gauges: GaugeSpec[];
}

/** Build the gauge specs for a single (entity | shared) column key prefix. */
export function buildGauge(
  channel: Channel,
  renderKey: string,
  column: Array<number | null> | undefined,
  idx: number,
  color: string,
): GaugeSpec {
  const value = column?.[idx] ?? null;
  const base: GaugeSpec = {
    key: renderKey,
    kind: channel.gauge as GaugeKind,
    value,
    label: channel.label,
    unit: channel.unit,
    color,
    valueLabels: channel.value_labels,
  };

  if (channel.gauge === "radial") {
    const lo = channel.range?.[0] ?? 0;
    // Auto-range (range[1] omitted): round the column max up to the nearest
    // 20, but floor it at lo + 20 so an all-negative-or-zero column can't
    // collapse the span to a degenerate min >= max gauge.
    const hiOrAuto =
      channel.range?.[1] ??
      Math.max(Math.ceil(maxVal(column, lo + 1) / 20) * 20, lo + 20);
    return { ...base, min: lo, max: hiOrAuto };
  }
  if (channel.gauge === "signed") {
    const scale = channel.range?.[1] ?? absMax(column, 1);
    return { ...base, min: -scale, max: scale };
  }
  if (channel.gauge === "linear") {
    const lo = channel.range?.[0] ?? 0;
    const hi = channel.range?.[1] ?? maxVal(column, lo + 1);
    return { ...base, lo, hi };
  }
  // vector — value only
  return base;
}

function renderGauge(spec: GaugeSpec): React.ReactNode {
  switch (spec.kind) {
    case "radial":
      return (
        <AnalogGauge
          key={spec.key}
          value={spec.value}
          min={spec.min!}
          max={spec.max!}
          {...DIAL_SWEEP.radial}
          label={spec.label}
          unit={spec.unit}
          color={spec.color}
          valueLabels={spec.valueLabels}
        />
      );
    case "signed":
      return (
        <AnalogGauge
          key={spec.key}
          value={spec.value}
          min={spec.min!}
          max={spec.max!}
          {...DIAL_SWEEP.signed}
          showZeroMark
          label={spec.label}
          unit={spec.unit}
          color={spec.color}
          valueLabels={spec.valueLabels}
        />
      );
    case "linear":
      return (
        <LinearGauge
          key={spec.key}
          value={spec.value}
          lo={spec.lo!}
          hi={spec.hi!}
          label={spec.label}
          unit={spec.unit}
          color={spec.color}
          valueLabels={spec.valueLabels}
        />
      );
    case "vector":
      return (
        <VectorGauge
          key={spec.key}
          value={spec.value}
          label={spec.label}
          color={spec.color}
          valueLabels={spec.valueLabels}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Digital fallback (error boundary) — generic numeric-readout safety net
// ---------------------------------------------------------------------------

interface DigitalFallbackProps {
  entityGroups: EntityGroup[];
  sharedGauges: GaugeSpec[];
}

function DigitalFallback({ entityGroups, sharedGauges }: DigitalFallbackProps) {
  const line = (g: GaugeSpec) => (
    <Text key={g.key} variant={TextVariant.Sm}>
      {g.label}: {formatReadout(g.value, g.valueLabels, g.unit)}
    </Text>
  );
  return (
    <div style={styles.gaugesContent}>
      {entityGroups.map((group, i) => (
        <div key={i} style={{ padding: "8px 12px", color: group.color }}>
          <Text variant={TextVariant.Sm}>{group.label}</Text>
          <div style={styles.digitalRow}>{group.gauges.map(line)}</div>
        </div>
      ))}
      {sharedGauges.length > 0 && (
        <div style={styles.sharedSection}>
          <div style={styles.digitalRow}>{sharedGauges.map(line)}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner gauges content (wrapped by error boundary)
// ---------------------------------------------------------------------------

interface GaugesContentProps {
  entityGroups: EntityGroup[];
  sharedGauges: GaugeSpec[];
}

function GaugesContent({ entityGroups, sharedGauges }: GaugesContentProps) {
  return (
    <div style={styles.gaugesContent}>
      <div style={styles.entitiesRow}>
        {entityGroups.map((group, i) => (
          <div key={i} style={styles.entityColumn}>
            <div style={{ ...styles.entityLabel, color: group.color }}>
              {group.label}
            </div>
            <div style={styles.gaugeRow}>{group.gauges.map(renderGauge)}</div>
          </div>
        ))}
      </div>
      {sharedGauges.length > 0 && (
        <div style={styles.sharedSection}>
          <div style={styles.gaugeRow}>{sharedGauges.map(renderGauge)}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error boundary wrapper
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean;
  error: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

class GaugeErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(err: unknown): ErrorBoundaryState {
    return { hasError: true, error: String(err) };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Schema -> gauge specs
// ---------------------------------------------------------------------------

function gaugeChannels(schema: SensorSchema): Channel[] {
  return schema.channels.filter((c) => c.gauge != null);
}

function buildGroups(
  schema: SensorSchema,
  columns: Record<string, Array<number | null>>,
  idx: number,
): { entityGroups: EntityGroup[]; sharedGauges: GaugeSpec[] } {
  const channels = gaugeChannels(schema);
  let paletteIdx = 0;

  const entityGroups: EntityGroup[] = schema.entities.map(
    (entity: Entity, ei) => {
      const groupColor = entity.color ?? PALETTE[ei % PALETTE.length];
      const gauges: GaugeSpec[] = channels
        .filter((c) => c.scope === "entity")
        .map((channel) => {
          const key = `${entity.name}_${channel.key}`;
          const color =
            channel.color ??
            entity.color ??
            PALETTE[paletteIdx++ % PALETTE.length];
          return buildGauge(channel, key, columns[key], idx, color);
        });
      return {
        label: entity.label ?? entity.name,
        color: groupColor,
        gauges,
      };
    },
  );

  const sharedGauges: GaugeSpec[] = channels
    .filter((c) => c.scope === "shared")
    .map((channel) => {
      const color = channel.color ?? PALETTE[paletteIdx++ % PALETTE.length];
      return buildGauge(channel, channel.key, columns[channel.key], idx, color);
    });

  return { entityGroups, sharedGauges };
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function GaugesPanel() {
  const { currentFrame } = useFrameSync();
  const { data, loading, error, sampleId } = useSensorData();

  const schema = data?.schema ?? null;

  const groups = useMemo(() => {
    if (!data || !schema || data.frame_numbers.length === 0) return null;
    // Resolve the display index by FRAME NUMBER (not position): coverage may
    // be sparse or start past frame 1. The null → first-frame fallback is
    // intentional: with no active timeline (e.g. the brief pre-initialization
    // moment, or a non-modal context) the gauges show the first covered
    // frame's values as a sensible default rather than blanking.
    const idx =
      currentFrame != null ? frameIndexFor(data.frame_numbers, currentFrame) : 0;
    return buildGroups(schema, data.columns, idx);
  }, [data, schema, currentFrame]);

  // ── Empty / loading / error states ───────────────────────────────────
  const message = sensorPanelMessage({ sampleId, error, loading, data }, "gauges");
  if (message) {
    return <Centered>{message}</Centered>;
  }
  if (!groups) {
    return <Centered>No sensor data available for this sample.</Centered>;
  }

  // ── Render ────────────────────────────────────────────────────────────
  const { entityGroups, sharedGauges } = groups;
  const fallback = (
    <div style={styles.root}>
      <DigitalFallback entityGroups={entityGroups} sharedGauges={sharedGauges} />
    </div>
  );

  return (
    <div style={styles.root}>
      <GaugeErrorBoundary fallback={fallback}>
        <GaugesContent entityGroups={entityGroups} sharedGauges={sharedGauges} />
      </GaugeErrorBoundary>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: 0,
    color: "rgba(220,220,220,0.92)",
    overflowY: "auto",
  },
  gaugesContent: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "8px 12px",
    flex: 1,
    minHeight: 0,
  },
  entitiesRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 16,
  },
  entityColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  entityLabel: {
    fontSize: 12,
    fontWeight: "bold" as const,
    letterSpacing: 0.5,
    paddingLeft: 2,
  },
  gaugeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  sharedSection: {
    paddingTop: 4,
    borderTop: "1px solid rgba(120,120,140,0.12)",
  },
  barWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "4px 2px",
  },
  barLabel: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
  },
  digitalRow: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    marginTop: 4,
  },
};

export default GaugesPanel;
