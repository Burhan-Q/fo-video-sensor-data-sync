export interface Channel {
  key: string;
  label: string;
  unit?: string;
  scope: "entity" | "shared";
  range: [number, number | null] | null;
  trace: boolean;
  gauge: "radial" | "signed" | "linear" | "vector" | null;
  color?: string;
  value_labels?: Record<string, string>; // numeric value -> display label (e.g. gear, turn_signal)
}

export interface Entity {
  name: string;
  label?: string;
  color?: string;
}

export interface SensorSchema {
  version: number;
  frame_field: string;
  frame_base?: number;
  fps_field?: string | null;
  entities: Entity[];
  channels: Channel[];
}

export interface SensorResult {
  frame_numbers: number[];
  columns: Record<string, Array<number | null>>;
  fps: number | null;
  schema: SensorSchema | null;
}

// Field-name convention for a channel+entity:
//   scope === "entity"  -> `${entity}_${key}`
//   scope === "shared"  -> `${key}`
