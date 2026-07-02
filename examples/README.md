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

```
python examples/load_demo.py /path/to/video.mp4 --example vehicle_controls
python examples/load_demo.py /path/to/video.mp4 --example drone_flight
```

The script launches the App itself; press Ctrl-C when done (the demo
dataset is temporary and cleans itself up). If you already have an App
session open, pass `--no-launch` to load into a persistent dataset instead
(delete it when finished). `load_demo.py` resolves its own paths from its
location on disk, so it works from any working directory -- no `sys.path`
setup needed.

## Validating a schema (+ optional data) standalone

```
python sensor/validate.py examples/vehicle_controls/schema.yaml examples/vehicle_controls/data.json
python sensor/validate.py examples/drone_flight/schema.yaml examples/drone_flight/data.json
```
