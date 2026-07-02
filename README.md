# fo-video-sensor-data-sync

A community [FiftyOne](https://github.com/voxel51/fiftyone) plugin that syncs
any per-frame numeric sensor data with video — frame-accurate and driven
entirely by a declarative schema — via two modal panels (traces + gauges)
that track the video timeline during playback. Sync runs both ways: the
panels follow playback, and clicking a point in the traces seeks the video
to that frame. No per-dataset code: author a schema once, load your data
with the loader convention, and the panels pick up the rest.

Requires FiftyOne ≥ 1.17 and Python ≥ 3.11.

## Installation

Install directly from GitHub with FiftyOne's plugin download command:

```bash
fiftyone plugins download https://github.com/Burhan-Q/fo-video-sensor-data-sync
```

**For local development**, clone the repository and symlink it into your
FiftyOne plugins directory instead:

```bash
git clone https://github.com/Burhan-Q/fo-video-sensor-data-sync
mkdir -p "$(fiftyone config plugins_dir)/@Burhan-Q"
ln -s "$(pwd)/fo-video-sensor-data-sync" "$(fiftyone config plugins_dir)/@Burhan-Q/fo-video-sensor-data-sync"
```

(The plugins directory defaults to `~/fiftyone/__plugins__`; set
`FIFTYONE_PLUGINS_DIR` to override it.)

No build step is required — the runtime bundle (`dist/index.umd.js`) ships
committed in this repository.

## Quickstart

**Try a shipped example** with the self-resolving demo script — it works
from any working directory, since it resolves its own paths on disk:

```bash
python "$(fiftyone config plugins_dir)/@Burhan-Q/fo-video-sensor-data-sync/examples/load_demo.py" \
    /path/to/video.mp4 --example vehicle_controls
```

(also `--example drone_flight`). This attaches the chosen example's schema
and synthetic per-frame data to your video as a new sample and launches the
FiftyOne App. Open that sample's modal to see the Sensor Traces and Sensor
Gauges panels, synced to the video timeline — clicking a point in the
traces seeks the video to that frame. Press Ctrl-C when done; the demo
dataset is temporary and cleans itself up. (If you already have an App
session open, pass `--no-launch` to load into a persistent dataset
instead.)

**Load your own data:** author a YAML schema describing your entities and
channels (see [the `sensor_schema` contract](#the-sensor_schema-contract)
below), and prepare a wide-format JSON or CSV file of per-frame rows, with
columns named by the field-name convention (one row per frame). Then load
it with the `import_sensor_data` operator — a normal FiftyOne operator you
can call directly from the SDK, with no plugin-internal import and no
`sys.path` setup:

```python
import fiftyone as fo
import fiftyone.operators as foo

dataset = fo.Dataset("my-sensor-data", persistent=True)  # or fo.load_dataset("...")
import_sensor_data = foo.get_operator(
    "@Burhan-Q/fo-video-sensor-data-sync/import_sensor_data"
)
# Creates one (1) FiftyOne sample
import_sensor_data(
    dataset,                  # FiftyOne dataset 
    video_path="drive.mp4",   # sample video
    frames_path="drive.json", # per-frame sensor data
    schema="schema.yaml",     # path to data schema YAML file
    cap_id="run-1",           # activation id written on the sample (see Activation)
)
```

`schema` must be a path to a schema YAML file (an inline dict is not
supported — the operator validates its params before running, and that
validation only declares a `schema_path` string property). You can also
copy `examples/load_demo.py` as a starting point if you'd rather script
the load end to end; it self-resolves the plugin directory the same way.

**Validate a schema (and optionally a data file) standalone**, without
FiftyOne running, by invoking the validator by its file path:

```bash
PLUGIN="$(fiftyone config plugins_dir)/@Burhan-Q/fo-video-sensor-data-sync"
python "$PLUGIN/sensor/validate.py" \
    "$PLUGIN/examples/vehicle_controls/schema.yaml" \
    "$PLUGIN/examples/vehicle_controls/data.json"
```

This prints `OK` if the schema (and data, if given) is valid, or lists each
problem found otherwise. The loader runs these same structural checks
automatically on import — fail-fast: an invalid schema raises with the full
list of problems before anything is written — so validating standalone first
is optional, but it lets you catch mistakes without launching FiftyOne. See
[Schema validation](#schema-validation) for exactly what is checked.

## Activation

The two panels — **Sensor Traces** and **Sensor Gauges** — appear on any
**video** dataset whose samples carry a **`cap_id`** field. When active,
their render config is read from `dataset.info["sensor_schema"]`. If a video
dataset has no `cap_id` field on its samples, the panels do not activate for
that dataset.

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
  below) — it tracks frame numbers, not wall-clock or sub-frame timing
  beyond what the source data provides.

## The `sensor_schema` contract

Everything the panels render is driven by one declarative config, stamped
onto `dataset.info["sensor_schema"]`. There is no per-dataset code: author a
schema, load your data with the loader convention below, and the panels pick
up the rest.

Top-level keys:

| Key | Type | Description |
| --- | --- | --- |
| `version` | int | Schema format version. |
| `frame_field` | str | Name of the per-frame index column in your source data — **any column name works** (e.g. `frame_number`, `frame_idx`, `t`). Load-time only: the loader converts it (per `frame_base`) into FiftyOne's built-in 1-based `frame_number`, which is what the panels and the read operator use afterwards. |
| `frame_base` | `0` \| `1` | Indexing base of `frame_field` in your source data (default `1`). FiftyOne frames are always 1-indexed; the loader normalizes for you. |
| `fps_field` | str, optional | Source-row key holding frames-per-second; copied onto the sample and returned alongside the per-frame arrays. (The panels currently plot by frame number — no time axis is rendered yet.) |
| `sample_fields` | list[str], optional | Source-row keys copied **verbatim** from the first row onto the sample as sample-level fields (e.g. a session id) — the generalization of `fps_field`. Values pass through as parsed (string/number/bool/list); **does not** include label fields (detections, segments, …), these must be added via FiftyOne's SDK. |
| `entities[]` | list | Named series to track: `{name, label?, color?}`. |
| `channels[]` | list | The data channels to render (see below). |

Each entry in `channels[]` has the shape (definitions follow):

```yaml
channels:
  - key:
    label:
    unit:  # (optional)
    trace: bool  # (optional)
    color:  # (optional)
    scope: "entity" | "shared"

    range: [lo, hi|null] | null  # (optional)
    gauge: "radial" | "signed" | "linear" | "vector" | null  # (optional)

    value_labels:  # (optional)
      0: <display label>  # numeric data value -> display string
      # ...
```

- `key` — Unique channel identifier. It becomes part of the FiftyOne
  frame-field name (`<entity>_<key>` / `<key>`), so use identifier-safe
  characters (letters, digits, underscores).

- `label` — Display name

- `unit` — Units of measure (optional)

- `trace` — Whether the channel appears as a line in the Sensor Traces panel
  (omitted = not traced).

- `color` — Quoted hex color used for the channel's trace and gauge
  (optional; falls back to the entity color, then a built-in palette)

- `scope` —

  - `"entity"` — one value per entity, per frame.

  - `"shared"` — a single value per frame, shared across entities.

- `range` — `[lo, hi]` bounds for gauge scaling; `hi: null` means
  auto-range from the observed data.

- `gauge` — which Sensor Gauges widget renders the channel (or `null` for
  none).

- `value_labels` — maps a numeric value to a display string, e.g.
  `{0: "park", 1: "reverse", 2: "neutral", 3: "drive"}` for a discrete
  `gear` channel. Map keys are matched against the **string form of the
  numeric value** (e.g. `"3"`, not `"3.0"`; negatives like `"-1"` work) —
  the panels look up `value_labels[String(value)]`.

### Field-name convention

The schema describes per-frame data; the actual values live on
`frames[].<field>` of each video sample, named by this convention:

| Channel scope | Frame field name |
| --- | --- |
| `entity` | `frames[].<entity>_<key>` |
| `shared` | `frames[].<key>` |

For example, an entity named `ego` with a `velocity` channel reads from
`frames[].ego_velocity`; a `shared`-scope `separation` channel, indicating
a mutual distance between two entities, reads from `frames[].separation`.

The frame index itself is always FiftyOne's built-in `frames[].frame_number`
— the source `frame_field` column is consumed at load time (to place each
row on the right frame) and is not written as a separate frame field.

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

See [`examples/vehicle_controls/schema.yaml`](examples/vehicle_controls/schema.yaml)
and [`examples/drone_flight/schema.yaml`](examples/drone_flight/schema.yaml)
for two full, runnable schemas — together they exercise every gauge type,
both channel scopes, `value_labels`, and auto-range.

### Schema validation

The structural rules above are defined in one place (`sensor/validate.py`)
and enforced at two layers:

- **Schema content.** `version`, `frame_field`, `entities`, and `channels`
  are required; each channel must declare a `key` and a `label` (strings);
  each `channel.scope` must be `entity` or `shared`; each
  `gauge` must be one of `radial`/`signed`/`linear`/`vector` (or `null`);
  `range` must be `[lo, hi]` with `lo <= hi` (or `hi: null` for auto-range);
  entity `name`s and channel `key`s must be strings, each unique;
  `value_labels`, if present, must map int/float/str keys to string labels;
  `sample_fields`, if present, must be a list of strings; and `frame_base`
  must be `0` or `1`.
  When a data file is also supplied, validation additionally checks that
  the frame field, every expected per-frame column (per the field-name
  convention), and every declared `sample_fields` key is present. These
  checks run standalone via the validator command in the Quickstart **and**
  automatically on load — the loader (and the `import_sensor_data` operator)
  validates fail-fast and raises with the full list of problems before
  writing anything to the dataset.

- **Operator parameters.** The `import_sensor_data` operator validates its
  inputs (`video_path`, `frames_path`, `schema_path`, `cap_id`) as strings
  before `execute` runs. That is why it takes a `schema_path` (a path to a
  schema YAML file) rather than an inline schema dict.

## Repo structure

```
fo-video-sensor-data-sync/
├── __init__.py              # Plugin entry point: registers the two operators (panels register in src/js/index.tsx)
├── fiftyone.yml              # Plugin manifest (name, version, panels, operators)
├── sensor/                   # Python package: schema-driven loading + querying
│   ├── __init__.py
│   ├── loader.py              # Wide-format JSON/CSV -> per-frame FiftyOne fields
│   ├── query.py                # Reads sensor_schema + per-frame fields for the panels
│   └── validate.py             # sensor_schema structural validation (+ CLI)
├── src/js/                   # Panel front-end (React/TypeScript source)
├── dist/index.umd.js         # Committed, pre-built runtime bundle (no build step needed)
├── examples/                  # Runnable example schemas + synthetic data
│   ├── README.md               # Overview of the shipped examples
│   ├── load_demo.py            # Self-resolving demo script (see Quickstart)
│   ├── vehicle_controls/       # schema.yaml + data.json + README.md
│   └── drone_flight/           # schema.yaml + data.json + README.md
├── package.json               # JS package metadata + build scripts
├── vite.config.mts            # Vite build config for the JS bundle
├── tsconfig.json              # TypeScript config
├── pyproject.toml             # Python package metadata
├── README.md                  # This file
└── LICENSE                    # Apache-2.0
```

## Sample-level summary fields

In addition to the per-frame fields described above, the loader
(`sensor/loader.py`) writes three sample-level scalar fields for every
per-frame column with at least one loaded value: `<col>_min`, `<col>_max`,
and `<col>_mean` (e.g. `ego_velocity_min`, `ego_velocity_max`,
`ego_velocity_mean`).

Per-frame fields live under `frames[]` and are not queryable at the sample
level. The sample-level summary scalars exist so you can sort, filter, and
aggregate across samples directly in the App's grid and sidebar — giving an
at-a-glance summary of each sample's sensor ranges without opening the
modal.

Schemas may also declare their own verbatim sample-level fields via the
optional `sample_fields` key — see
[the `sensor_schema` contract](#the-sensor_schema-contract).

## License

Apache-2.0. See [LICENSE](LICENSE).
