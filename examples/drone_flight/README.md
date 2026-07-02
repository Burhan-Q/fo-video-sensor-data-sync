# drone_flight

Two tracked entities, `drone_a` and `drone_b`, flying in formation:

- `altitude` -- per-entity, radial gauge, unit `m`
- `battery` -- per-entity, linear gauge, unit `%`
- `bearing` -- per-entity, vector gauge, unit `°`
- `separation` -- a channel SHARED between the two entities (auto-range,
  `hi: null`), linear gauge, unit `m`

Demonstrates: multiple entities, a shared channel, the vector gauge, and
auto-range.

## Run

```
python examples/load_demo.py /path/to/video.mp4 --example drone_flight
```

## Validate

```
python sensor/validate.py examples/drone_flight/schema.yaml examples/drone_flight/data.json
```
