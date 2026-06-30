import React, { useMemo } from "react";
import { Text, TextVariant } from "@voxel51/voodo";

import Plot from "./plotly";
import { useFrameSync } from "./useFrameSync";
import { useSensorData } from "./useSensorData";
import { buildData, buildLayout } from "./tracesFigure";

const PLOT_CONFIG = {
  displaylogo: false,
  displayModeBar: false,
  responsive: true,
};

export function TracesPanel() {
  const { currentFrame } = useFrameSync();
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

  // ── Empty / loading states ─────────────────────────────────────────
  if (!sampleId) {
    return (
      <div style={styles.center}>
        <Text variant={TextVariant.Sm}>
          Open a sample in the modal to view its sensor traces.
        </Text>
      </div>
    );
  }
  if (error) {
    return (
      <div style={styles.center}>
        <Text variant={TextVariant.Sm}>
          Failed to load sensor data: {error}
        </Text>
      </div>
    );
  }
  if (loading || !data) {
    return (
      <div style={styles.center}>
        <Text variant={TextVariant.Sm}>Loading sensor data…</Text>
      </div>
    );
  }
  // Activated dataset (cap_id present) but no sensor_schema configured.
  if (!schema) {
    return (
      <div style={styles.center}>
        <Text variant={TextVariant.Sm}>
          No sensor schema configured for this dataset.
        </Text>
      </div>
    );
  }
  if (!data.frame_numbers || data.frame_numbers.length === 0) {
    return (
      <div style={styles.center}>
        <Text variant={TextVariant.Sm}>
          No sensor data available for this sample.
        </Text>
      </div>
    );
  }

  // ── Chart ──────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      <div style={styles.plotWrap}>
        <Plot
          data={plotData as any}
          layout={layout as any}
          config={PLOT_CONFIG as any}
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
  center: {
    display: "flex",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: 16,
    textAlign: "center",
    color: "rgba(170,170,190,0.85)",
  },
};

export default TracesPanel;
