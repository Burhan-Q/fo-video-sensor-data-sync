# Examples

Each subdirectory here is a self-contained example: a `sensor_schema` YAML
config (`schema.yaml`) paired with synthetic per-frame data (`data.json`)
that satisfies it, plus a short `README.md` describing what it demonstrates.

| Example | Entities | Demonstrates |
| --- | --- | --- |
| [`vehicle_controls/`](vehicle_controls/README.md) | `ego` | Single entity, `value_labels`, radial/linear/signed gauges |
| [`drone_flight/`](drone_flight/README.md) | `drone_a`, `drone_b` | Multiple entities, a shared channel, the vector gauge, auto-range |

## Running an example

Load an example onto a video as a new sample and open the App:

```bash
PLUGIN="$(fiftyone config plugins_dir)/@Burhan-Q/fo-video-sensor-data-sync"
python "$PLUGIN/examples/load_demo.py" \
    /path/to/video.mp4 --example vehicle_controls
```

Swap `--example drone_flight` for the multi-entity example. The script
launches the App itself and resolves its own paths from its location on
disk, so it works from any working directory — no `sys.path` setup needed.
When done, return to the terminal and press <kbd>Ctrl</kbd>+<kbd>C</kbd>; the
demo dataset is temporary and cleans itself up.

### Arguments

| Argument | Default | Description |
| --- | --- | --- |
| `video` (positional, required) | — | Path to a real video file on your machine to attach the example data to. |
| `--example` | `vehicle_controls` | Which shipped example to load: `vehicle_controls` or `drone_flight`. |
| `--dataset-name` | derived from `--example` (e.g. `vehicle-controls-demo`) | Name for the created FiftyOne dataset. |
| `--cap-id` | `demo-run` | Value written to the sample's `cap_id` field — the field that activates the panels. |
| `--no-launch` | _off_ | Load only, into a **persistent** dataset (for an App session you already have open); no App is started. Delete the dataset when finished. |
| `-h`, `--help` | — | Show the usage message and exit. |

## Validating a schema (+ optional data) standalone

Validate a schema on its own, or together with a data file, without FiftyOne
running:

```bash
PLUGIN="$(fiftyone config plugins_dir)/@Burhan-Q/fo-video-sensor-data-sync"
python "$PLUGIN/sensor/validate.py" \
    "$PLUGIN/examples/vehicle_controls/schema.yaml" \
    "$PLUGIN/examples/vehicle_controls/data.json"
```

Swap in the `drone_flight/` paths for the other example, and drop the
`data.json` argument to validate the schema alone. Prints `OK` if valid, or
lists each problem found. See
[Schema validation](../SCHEMA.md#schema-validation) for exactly what is
checked.
