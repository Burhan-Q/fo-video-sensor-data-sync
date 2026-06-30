# fo-video-sensor-data-sync

A community [FiftyOne](https://github.com/voxel51/fiftyone) plugin that syncs
any per-frame numeric sensor data with video — frame-accurate and driven
entirely by a declarative schema — via two modal panels (traces + gauges) that
track the video timeline during playback. No per-dataset code.

Requires FiftyOne ≥ 1.17 and Python ≥ 3.11.

## Install

FiftyOne plugins install by clone: check out this repository directly into
your FiftyOne plugins directory.

```bash
git clone https://github.com/Burhan-Q/fo-video-sensor-data-sync \
  "$(fiftyone config plugins_dir)/fo-video-sensor-data-sync"
```

(`FIFTYONE_PLUGINS_DIR` defaults to `~/.fiftyone/plugins` if unset.)

No build step is required — the runtime bundle (`dist/index.umd.js`) ships
committed in this repository.

## The `sensor_schema` contract

Everything the panels render is driven by one declarative config, stamped
onto `dataset.info["sensor_schema"]`. There is no per-dataset code: author a
schema, load your data with the loader convention below, and the panels pick
up the rest.

Top-level keys:

| Key | Type | Description |
| --- | --- | --- |
| `version` | int | Schema format version. |
| `frame_field` | str | Name of the per-frame index field in your source data. |
| `frame_base` | `0` \| `1` | Indexing base of `frame_field` in your source data (default `1`). FiftyOne frames are always 1-indexed; the loader normalizes for you. |
| `fps_field` | str, optional | Sample-level field holding frames-per-second, used to drive an optional time axis. |
| `entities[]` | list | Named series to track: `{name, label?, color?}`. |
| `channels[]` | list | The data channels to render (see below). |

Each entry in `channels[]` has the shape:

```
{key, label, unit?, scope: "entity" | "shared",
 range: [lo, hi|null] | null, trace: bool,
 gauge: "radial" | "signed" | "linear" | "vector" | null,
 color?, value_labels?}
```

- `scope: "entity"` — one value per entity, per frame.
- `scope: "shared"` — a single value per frame, shared across entities.
- `range` — `[lo, hi]` bounds for gauge scaling; `hi: null` means
  auto-range from the observed data.
- `trace` — whether the channel appears as a line in the Sensor Traces
  panel.
- `gauge` — which Sensor Gauges widget renders the channel (or `null` for
  none).
- `value_labels` — maps a numeric value to a display string, e.g.
  `{0: "park", 1: "reverse", 2: "neutral", 3: "drive"}` for a discrete
  `gear` channel.

### Field-name convention

The schema describes per-frame data; the actual values live on
`frames[].<field>` of each video sample, named by this convention:

| Channel scope | Frame field name |
| --- | --- |
| `entity` | `frames[].<entity>_<key>` |
| `shared` | `frames[].<key>` |

For example, an entity named `ego` with a `velocity` channel reads from
`frames[].ego_velocity`; a `shared`-scope `separation` channel reads from
`frames[].separation`.

### Gauge types

- **radial** — unsigned dial (e.g. a `velocity` reading).
- **signed** — center-zero dial (e.g. a `steering` or turn-signal input
  that swings negative/positive around zero).
- **linear** — bar gauge (e.g. `throttle`, `brake`, `battery`).
- **vector** — deflection-from-reference pointer (e.g. an orientation
  channel like `bearing`, shown as a deflection from a fixed reference
  direction).

### Example schema

```yaml
version: 1
frame_field: frame_number
frame_base: 1
fps_field: fps

entities:
  - name: ego
    label: Ego

channels:
  - key: velocity
    label: Velocity
    unit: kph
    scope: entity
    range: [0, 240]
    gauge: radial
    trace: true

  - key: steering
    label: Steering
    scope: entity
    range: [-1, 1]
    gauge: signed
    trace: true
```

See [`examples/vehicle_controls.schema.yaml`](examples/vehicle_controls.schema.yaml)
and [`examples/drone_flight.schema.yaml`](examples/drone_flight.schema.yaml)
for two full, runnable schemas — together they exercise every gauge type,
both channel scopes, `value_labels`, and auto-range.

## Activation

The two panels — **Sensor Traces** and **Sensor Gauges** — appear on any
**video** dataset whose samples carry a **`cap_id`** field. When active,
their render config is read from `dataset.info["sensor_schema"]`. If a video
dataset has no `cap_id` field on its samples, the panels do not activate for
that dataset.

## Quickstart

1. Author a YAML schema describing your entities and channels (see above).
2. Prepare a wide-format JSON or CSV file of per-frame rows, with columns
   named by the field-name convention (one row per frame).
3. Load the video + sidecar data with the example loader:

```python
import fiftyone as fo
from examples.load_sensor_data import import_run

schema = {
    "version": 1,
    "frame_field": "frame_number",
    "frame_base": 1,
    "entities": [{"name": "ego", "label": "Ego"}],
    "channels": [
        {
            "key": "velocity",
            "label": "Velocity",
            "scope": "entity",
            "range": [0, 240],
            "gauge": "radial",
            "trace": True,
        },
        {
            "key": "steering",
            "label": "Steering",
            "scope": "entity",
            "range": [-1, 1],
            "gauge": "signed",
            "trace": True,
        },
    ],
}

dataset = import_run("drive.mp4", "drive.json", schema, cap_id="run-1")
```

4. Open a sample's modal in the FiftyOne App — the Sensor Traces and Sensor
   Gauges panels appear, synced to the video timeline.

You can validate a schema (and optionally a data file) standalone, without
FiftyOne running:

```bash
python examples/validate_config.py config.yaml [data.json]
```

## Known limitations

- **Modal-only surface.** The synced experience needs the sample-modal
  video timeline; the panels do not appear on the grid surface, which has
  no per-sample modal timeline and so cannot reproduce the synced playhead.
  This is a deliberate trade-off, not an oversight.
- **Shared modal layout storage.** As of FiftyOne 1.17, the modal layout is
  stored as a single global `localStorage` blob shared across all datasets,
  with no per-dataset scoping or pruning. This means deactivated panels can
  occasionally linger as harmless, cosmetic "ghost" tabs when you switch to
  a different dataset, until you close them manually.
- **Forkers: never mutate the global modal layout.** Because that layout
  storage is global and unscoped, a plugin that tries to "clean up" or
  evict its own panel from it risks corrupting the layout for every
  dataset, not just its own — including by your panels. Treat it as
  read-only.
- **Frame-accuracy, precisely defined.** Synchronization is achieved via a
  per-frame sidecar indexed to video frames (see the field-name convention
  above) — it tracks frame numbers, not wall-clock or sub-frame timing
  beyond what the source data provides.

## License

Apache-2.0. See [LICENSE](LICENSE).
