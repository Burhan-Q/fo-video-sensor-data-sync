# vehicle_controls

A single tracked entity, `ego`, with a handful of simple control/state
channels:

- `throttle`, `brake` -- binary control inputs, linear gauge
- `velocity` -- continuous, radial gauge, unit `kph`
- `gear` -- discrete state with `value_labels` (linear gauge)
- `turn_signal` -- signed/center-zero state with `value_labels` (signed gauge)

Demonstrates: a single entity (the series toggle is hidden in the UI),
`value_labels`, and the radial/linear/signed gauge types.

## Run

```
python examples/load_demo.py /path/to/video.mp4 --example vehicle_controls
```

## Validate

```
python sensor/validate.py examples/vehicle_controls/schema.yaml examples/vehicle_controls/data.json
```
