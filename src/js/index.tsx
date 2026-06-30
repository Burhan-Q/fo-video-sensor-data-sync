import "@voxel51/voodo/theme.css";
import { registerComponent, PluginComponentType } from "@fiftyone/plugins";
import { TracesPanel } from "./TracesPanel";
import { GaugesPanel } from "./GaugesPanel";

// Gate both panels via the panel `activator`, the FiftyOne-supported mechanism.
// The activator receives `{ schema, dataset }`, where `schema` is the
// sample-field schema keyed by name; sensor datasets carry a `cap_id` field on
// video samples. This keeps the panels OUT of the default modal layout (and the
// "+ New panel" menu) for datasets that don't carry sensor data.
//
// Known FiftyOne limitation (NOT something a plugin can fix): the sample-modal
// layout is a single GLOBAL localStorage blob (e.g. `fo-sample-modal-plugins` /
// `fiftyone-modal-spaces`) shared across ALL datasets, and FiftyOne does not
// prune deactivated panels from it. So if these panels were added on a sensor
// dataset and you then open a dataset without sensor data, their tabs may linger
// as inactive "no longer exists" placeholders until closed via the tab "X".
// This is cosmetic and safe.
//
// A plugin must NEVER try to "clean up" by self-evicting from that layout (e.g.
// calling `spaces.removeNode`): doing so mutates the shared GLOBAL blob and can
// corrupt the modal for ALL datasets, not just this one. Leave the harmless
// ghost tabs; do not mutate FiftyOne's global modal layout.
function isSensorDataset(ctx?: {
  dataset?: { mediaType?: string };
  schema?: Record<string, unknown>;
}): boolean {
  return ctx?.dataset?.mediaType === "video" && Boolean(ctx?.schema?.cap_id);
}

registerComponent({
  name: "sensor_traces",
  label: "Sensor Traces",
  component: TracesPanel,
  type: PluginComponentType.Panel,
  panelOptions: { surfaces: "modal" },
  activator: isSensorDataset,
});

registerComponent({
  name: "sensor_gauges",
  label: "Sensor Gauges",
  component: GaugesPanel,
  type: PluginComponentType.Panel,
  panelOptions: { surfaces: "modal" },
  activator: isSensorDataset,
});
