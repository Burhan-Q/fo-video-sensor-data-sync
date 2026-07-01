"""Demo: load the shipped vehicle_controls example onto a video using the core loader.

Usage:  python examples/load_demo.py /path/to/video.mp4
Attaches the vehicle_controls schema + synthetic data (in this folder) to the
given video as a new sample, then you can open its modal to see the panels.
"""

from __future__ import annotations

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, REPO)

import yaml  # noqa: E402

from sensor.loader import import_run  # noqa: E402


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Load the vehicle_controls demo onto a video sample."
    )
    parser.add_argument("video", help="Path to a video file.")
    parser.add_argument("--dataset-name", default="vehicle-controls-demo")
    parser.add_argument("--cap-id", default="demo-run")
    args = parser.parse_args(argv)

    schema = yaml.safe_load(open(os.path.join(HERE, "vehicle_controls.schema.yaml")))
    data = os.path.join(HERE, "vehicle_controls.data.json")
    dataset = import_run(
        args.video,
        data,
        schema,
        cap_id=args.cap_id,
        dataset_name=args.dataset_name,
        persistent=False,
    )
    print(
        f"loaded {len(dataset)} sample(s) into dataset {dataset.name!r}; "
        "open the sample modal to see the Sensor Traces + Sensor Gauges panels"
    )


if __name__ == "__main__":
    main()
