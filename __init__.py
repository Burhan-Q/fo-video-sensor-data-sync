"""Operator entrypoint for the video+sensor sync plugin."""

from __future__ import annotations

from pathlib import Path

import yaml

import fiftyone as fo
import fiftyone.operators as foo
import fiftyone.operators.types as types

try:
    from .sensor.loader import load_run
    from .sensor.query import frame_sensor_arrays
except ImportError:
    from sensor.loader import load_run
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


class ImportSensorData(foo.Operator):
    """Loads one per-frame sensor run onto a video sample.

    SDK-callable: ``foo.get_operator("@Burhan-Q/fo-video-sensor-data-sync/import_sensor_data")``
    returns an instance of this class, which can be called directly as
    ``import_sensor_data(dataset, video_path=..., frames_path=..., schema=..., cap_id=...)``
    with no plugin-internal import required.

    ``schema`` must be a path to a schema YAML file. ``execute_operator``
    validates ``params`` against ``resolve_input``'s declared properties
    before ``execute`` ever runs, and ``types.Object`` has no property type
    for an arbitrary nested dict — so an inline ``schema`` dict cannot be
    threaded through as a param; only a path string can.
    """

    @property
    def config(self) -> foo.OperatorConfig:
        return foo.OperatorConfig(
            name="import_sensor_data",
            label="Import sensor data",
        )

    def resolve_input(self, ctx) -> types.Property:
        inputs = types.Object()
        inputs.str("video_path", label="Video path", required=True)
        inputs.str("frames_path", label="Per-frame data path (JSON/CSV)", required=True)
        inputs.str("schema_path", label="Schema YAML path", required=True)
        inputs.str("cap_id", label="Activation id (cap_id)", required=True)
        return types.Property(inputs)

    def execute(self, ctx) -> dict:
        with open(ctx.params["schema_path"]) as f:
            schema = yaml.safe_load(f)
        load_run(
            ctx.dataset,
            ctx.params["video_path"],
            ctx.params["frames_path"],
            schema,
            ctx.params["cap_id"],
        )
        ctx.dataset.reload()
        return {"cap_id": ctx.params["cap_id"], "num_samples": len(ctx.dataset)}

    def __call__(
        self,
        dataset: fo.Dataset,
        video_path: str | Path,
        frames_path: str | Path,
        schema: str | Path,
        cap_id: str,
    ) -> fo.Dataset:
        """Loads one sensor run onto ``dataset`` and returns it, reloaded.

        ``schema`` must be a path to a schema YAML file (see class docstring
        for why an inline dict is not supported).
        """
        params = dict(
            video_path=str(video_path),
            frames_path=str(frames_path),
            schema_path=str(schema),
            cap_id=cap_id,
        )
        foo.execute_operator(self.uri, dict(dataset=dataset), params=params)
        dataset.reload()
        return dataset


def register(p) -> None:
    p.register(GetFrameSensorData)
    p.register(ImportSensorData)
