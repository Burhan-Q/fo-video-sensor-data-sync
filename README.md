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
channels (see [SCHEMA.md](SCHEMA.md) for the full contract), and prepare a
wide-format JSON or CSV file of per-frame rows, with columns named by the
field-name convention (one row per frame). Then load
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
[Schema validation](SCHEMA.md#schema-validation) for exactly what is checked.

## Schema at a glance

Everything the panels render is driven by one declarative schema — no
per-dataset code. Author it once; the loader stamps it onto
`dataset.info["sensor_schema"]`, and the panels pick up the rest. A minimal
single-entity schema:

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

See **[SCHEMA.md](SCHEMA.md)** for the full contract — every key, the
field-name convention, gauge types, validation rules, and the sample-level
summary fields the loader writes. Two full, runnable schemas live under
[`examples/`](examples/).

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
  in [SCHEMA.md](SCHEMA.md#field-name-convention)) — it tracks frame numbers,
  not wall-clock or sub-frame timing beyond what the source data provides.

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
├── SCHEMA.md                  # The sensor_schema contract (full reference)
└── LICENSE                    # Apache-2.0
```

## License

Apache-2.0. See [LICENSE](LICENSE).
