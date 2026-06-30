// Pure, testable Plotly figure builders for the Traces panel.
//
// One subplot per traced channel (channels with `trace === true`, in
// declared schema order). Entities OVERLAY within a channel's subplot:
// entity-scoped channels emit one trace per entity; shared-scoped channels
// emit a single trace. The per-chart cursor is a `layout.shapes` line per
// subplot (full-height playhead in EVERY chart), pinned to that subplot's
// y-axis DOMAIN via `yref: "${axis} domain"`. buildData and buildLayout
// share `visibleAxes()` so a trace's `yaxis` always matches its cursor
// shape's `yref`.

import type { SensorResult, SensorSchema, Channel } from "./types";

export interface PlotlyTrace {
  type: "scatter";
  mode: "lines";
  name: string;
  x: number[];
  y: Array<number | null>;
  line: { color: string };
  xaxis: "x";
  yaxis: string;
}

// Generic palette for traces lacking an explicit color.
const PALETTE = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#17becf",
];

// Vertical gap (paper fraction) between adjacent stacked subplots.
const SUBPLOT_GAP = 0.08;

// Plotly y-axis id for the i-th visible subplot (0-based).
// 0 -> "y" / "yaxis", 1 -> "y2" / "yaxis2", ...
function traceAxis(i: number): string {
  return i === 0 ? "y" : `y${i + 1}`;
}
function layoutAxisKey(i: number): string {
  return i === 0 ? "yaxis" : `yaxis${i + 1}`;
}

function allNull(values: Array<number | null> | undefined): boolean {
  return !values || values.every((v) => v == null);
}

// ---------------------------------------------------------------------------
// Shared visible-ordered axis assignment
// ---------------------------------------------------------------------------

/** Channels with `trace === true`, in declared schema order. */
export function tracedChannels(schema: SensorSchema): Channel[] {
  return schema.channels.filter((c) => c.trace);
}

/**
 * The traced channels in declared order, each mapped to the Plotly y-axis id
 * it occupies. This is the single source of truth shared by buildData (trace
 * `yaxis`) and buildLayout (axis defs + cursor shape `yref`), so a trace and
 * its cursor line always land in the same subplot.
 */
export function visibleAxes(
  schema: SensorSchema,
): Array<{ channel: Channel; axis: string }> {
  return tracedChannels(schema).map((channel, i) => ({
    channel,
    axis: traceAxis(i),
  }));
}

// ---------------------------------------------------------------------------
// buildData
// ---------------------------------------------------------------------------

export function buildData(result: SensorResult): PlotlyTrace[] {
  const schema = result.schema;
  if (!schema) return [];

  const x = result.frame_numbers;
  const traces: PlotlyTrace[] = [];
  let paletteIdx = 0;

  const line = (
    name: string,
    y: Array<number | null>,
    axis: string,
    color: string,
  ): PlotlyTrace => ({
    type: "scatter",
    mode: "lines",
    name,
    x,
    y,
    line: { color },
    xaxis: "x",
    yaxis: axis,
  });

  for (const { channel, axis } of visibleAxes(schema)) {
    if (channel.scope === "entity") {
      for (const entity of schema.entities) {
        const key = `${entity.name}_${channel.key}`;
        const y = result.columns[key];
        if (allNull(y)) continue;
        const color =
          channel.color ??
          entity.color ??
          PALETTE[paletteIdx++ % PALETTE.length];
        const name = `${entity.label ?? entity.name} ${channel.label}`;
        traces.push(line(name, y, axis, color));
      }
    } else {
      const key = channel.key;
      const y = result.columns[key];
      if (allNull(y)) continue;
      const color = channel.color ?? PALETTE[paletteIdx++ % PALETTE.length];
      traces.push(line(channel.label, y, axis, color));
    }
  }

  return traces;
}

// ---------------------------------------------------------------------------
// buildLayout
// ---------------------------------------------------------------------------

export interface PlotlyLayout {
  showlegend: boolean;
  autosize: boolean;
  margin: { l: number; r: number; t: number; b: number };
  paper_bgcolor: string;
  plot_bgcolor: string;
  font: { color: string; size: number };
  legend: any;
  hoverlabel: any;
  xaxis: any;
  yaxis?: any;
  yaxis2?: any;
  yaxis3?: any;
  shapes: any[];
}

export function buildLayout(
  schema: SensorSchema | null,
  currentFrame: number | null,
): PlotlyLayout {
  const shown = schema ? visibleAxes(schema) : [];
  const n = shown.length || 1; // guard against an empty selection

  // Evenly split [0, 1] into n stacked bands (top band first) with gaps.
  const band = (1.0 - SUBPLOT_GAP * (n - 1)) / n;
  const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

  const axisGrid = {
    zeroline: false,
    showgrid: true,
    gridcolor: "rgba(120,120,120,0.15)",
    tickfont: { size: 10, color: "rgba(180,180,180,0.85)" },
    automargin: true,
  };

  const layout: PlotlyLayout = {
    showlegend: true,
    autosize: true,
    margin: { l: 56, r: 12, t: 8, b: 44 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "rgba(220,220,220,0.9)", size: 11 },
    legend: {
      orientation: "h",
      x: 0,
      y: 1.04,
      bgcolor: "rgba(0,0,0,0)",
      font: { color: "rgba(220,220,220,0.9)", size: 11 },
    },
    hoverlabel: {
      bgcolor: "rgba(20,20,30,0.92)",
      bordercolor: "rgba(70,70,90,0.6)",
      font: { color: "rgba(240,240,240,0.95)", size: 11 },
    },
    // Single shared x-axis anchored to the bottom-most visible subplot.
    xaxis: {
      title: {
        text: "Frame",
        font: { size: 11, color: "rgba(180,180,200,0.85)" },
      },
      anchor: shown.length ? shown[shown.length - 1].axis : "y",
      ...axisGrid,
    },
    yaxis: undefined as any,
    shapes: [],
  };

  shown.forEach(({ channel }, i) => {
    const top = round4(1.0 - i * (band + SUBPLOT_GAP));
    const bottom = round4(top - band);
    (layout as any)[layoutAxisKey(i)] = {
      title: {
        text: channel.label + (channel.unit ? ` (${channel.unit})` : ""),
        font: { size: 11, color: "rgba(180,180,200,0.85)" },
      },
      domain: [Math.max(bottom, 0.0), Math.min(top, 1.0)],
      anchor: "x",
      ...axisGrid,
    };
  });

  // Cursor — one full-height vertical line per VISIBLE subplot, pinned to that
  // subplot's y-axis DOMAIN (so it spans only its own band, but every band gets
  // one). Re-emitted each frame; Plotly.react redraws just these.
  if (currentFrame != null) {
    for (const { axis } of shown) {
      layout.shapes.push({
        type: "line",
        xref: "x",
        yref: `${axis} domain`,
        x0: currentFrame,
        x1: currentFrame,
        y0: 0,
        y1: 1,
        line: { color: "red", width: 2 },
      });
    }
  }

  return layout;
}
