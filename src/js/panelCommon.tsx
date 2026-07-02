// Shared empty/loading/error-state handling for the two sensor panels.

import React from "react";
import { Text, TextVariant } from "@voxel51/voodo";
import type { SensorResult } from "./types";

/** Centered informational message (the panels' non-chart states). */
export function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={centerStyle}>
      <Text variant={TextVariant.Sm}>{children}</Text>
    </div>
  );
}

interface PanelDataState {
  sampleId: string | null;
  error: string | null;
  loading: boolean;
  data: SensorResult | null;
}

/**
 * The shared state ladder both panels step through before rendering their
 * content: no modal sample → fetch error → loading → activated dataset
 * (cap_id present) but no sensor_schema configured → no per-frame data.
 * Returns the message to display, or null when there is renderable data.
 * `noun` distinguishes the panels ("traces" / "gauges").
 */
export function sensorPanelMessage(
  { sampleId, error, loading, data }: PanelDataState,
  noun: string,
): string | null {
  if (!sampleId) {
    return `Open a sample in the modal to view its sensor ${noun}.`;
  }
  if (error) {
    return `Failed to load sensor data: ${error}`;
  }
  if (loading || !data) {
    return "Loading sensor data…";
  }
  if (!data.schema) {
    return "No sensor schema configured for this dataset.";
  }
  if (!data.frame_numbers || data.frame_numbers.length === 0) {
    return "No sensor data available for this sample.";
  }
  return null;
}

const centerStyle: React.CSSProperties = {
  display: "flex",
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  padding: 16,
  textAlign: "center",
  color: "rgba(170,170,190,0.85)",
};
