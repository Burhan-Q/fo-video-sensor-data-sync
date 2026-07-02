import React, { useCallback, useMemo } from "react";

import Plot from "./plotly";
import { useFrameSync } from "./useFrameSync";
import { useSensorData } from "./useSensorData";
import { Centered, sensorPanelMessage } from "./panelCommon";
import { buildData, buildLayout } from "./tracesFigure";

const PLOT_CONFIG = {
  displaylogo: false,
  displayModeBar: false,
  responsive: true,
};

export function TracesPanel() {
  const { currentFrame, seekFrame } = useFrameSync();
  const { data, loading, error, sampleId } = useSensorData();

  const schema = data?.schema ?? null;

  // Memo split: heavy `data` only changes when the sensor result changes; the
  // `layout` (and its per-frame cursor shapes) changes every frame. This lets
  // Plotly.react redraw only the cursor on playback.
  const plotData = useMemo(() => (data ? buildData(data) : []), [data]);
  const layout = useMemo(
    () => buildLayout(schema, currentFrame),
    [schema, currentFrame],
  );

  // Click-to-seek: clicking a trace point drives the video timeline to that
  // frame (the x axis is FiftyOne frame numbers).
  const handleClick = useCallback(
    (event: { points?: Array<{ x?: unknown }> }) => {
      const x = event?.points?.[0]?.x;
      if (typeof x === "number") {
        seekFrame(Math.round(x));
      }
    },
    [seekFrame],
  );

  // ── Empty / loading states ─────────────────────────────────────────
  const message = sensorPanelMessage({ sampleId, error, loading, data }, "traces");
  if (message) {
    return <Centered>{message}</Centered>;
  }

  // ── Chart ──────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      <div style={styles.plotWrap}>
        <Plot
          data={plotData as any}
          layout={layout as any}
          config={PLOT_CONFIG as any}
          onClick={handleClick}
          useResizeHandler
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: 0,
    color: "rgba(220,220,220,0.92)",
  },
  plotWrap: {
    flex: 1,
    minHeight: 0,
    position: "relative",
  },
};

export default TracesPanel;
