"""Operator entrypoint for the video+sensor sync plugin."""

import fiftyone.operators as foo
import fiftyone.operators.types as types  # noqa: F401

try:
    from .sensor.query import frame_sensor_arrays
except ImportError:
    from sensor.query import frame_sensor_arrays


class GetFrameSensorData(foo.Operator):
    @property
    def config(self) -> foo.OperatorConfig:
        return foo.OperatorConfig(
            name="get_frame_sensor_data",
            label="Get frame sensor data",
            unlisted=True,
        )

    def execute(self, ctx) -> dict:
        if "sample_id" not in ctx.params:
            raise ValueError("get_frame_sensor_data: 'sample_id' is required")
        return frame_sensor_arrays(ctx.view, ctx.params["sample_id"])


def register(p) -> None:
    p.register(GetFrameSensorData)
