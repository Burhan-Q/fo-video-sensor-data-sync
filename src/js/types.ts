export interface Channel {
  key: string;
  label: string;
  unit?: string;
  scope: "entity" | "shared";
  // Optional in the schema contract (sensor/validate.py): omitted range means
  // gauge auto-scaling, omitted trace means not traced, omitted gauge means
  // no gauge widget.
  range?: [number, number | null] | null;
  trace?: boolean;
  gauge?: "radial" | "signed" | "linear" | "vector" | null;
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
  // Load-time only (sensor/loader.py copies these row-0 keys onto the
  // sample); present in the stamped schema but unused by the panels.
  sample_fields?: string[];
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
