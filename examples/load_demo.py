"""Demo: load a shipped example onto a video and open it in the App.

Usage:  python examples/load_demo.py /path/to/video.mp4 --example vehicle_controls
Attaches the chosen example's schema + synthetic data (examples/<example>/)
to the given video as a new sample, then launches the App — open the sample
modal to see the panels, and press Ctrl-C to exit (the demo dataset is
temporary and cleans itself up).

With --no-launch the data is loaded into a *persistent* dataset instead (no
App is started), so it survives for a session you already have open; delete
it when done. A non-persistent dataset would be deleted the moment this
script exits — FiftyOne removes non-persistent datasets when the last
database client disconnects.
"""

import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import yaml  # noqa: E402
import fiftyone as fo  # noqa: E402

from sensor.loader import import_run  # noqa: E402

EXAMPLES = ("vehicle_controls", "drone_flight")


def main(argv: list[str] | None = None) -> None:
    """Parse CLI args, load the chosen example, and open the App.

    Parameters
    ----------
    argv:
        Argument list to parse; ``None`` uses ``sys.argv[1:]``.
    """
    parser = argparse.ArgumentParser(
        description="Load a shipped example onto a video sample."
    )
    parser.add_argument("video", help="Path to a video file.")
    parser.add_argument("--example", choices=EXAMPLES, default="vehicle_controls")
    parser.add_argument(
        "--dataset-name",
        default=None,
        help="Dataset name (default: derived from --example, e.g. vehicle-controls-demo).",
    )
    parser.add_argument("--cap-id", default="demo-run")
    parser.add_argument(
        "--no-launch",
        action="store_true",
        help="Load only, into a PERSISTENT dataset (for an App session you "
        "already have open); no App is started. Delete the dataset when done.",
    )
    args = parser.parse_args(argv)

    example_dir = HERE / args.example
    schema = yaml.safe_load((example_dir / "schema.yaml").read_text())
    dataset = import_run(
        args.video,
        example_dir / "data.json",
        schema,
        cap_id=args.cap_id,
        dataset_name=args.dataset_name or f"{args.example.replace('_', '-')}-demo",
        # A non-persistent dataset is auto-deleted when this (sole) client
        # exits, so it only survives past --no-launch if made persistent.
        persistent=args.no_launch,
    )
    print(f"loaded {len(dataset)} sample(s) into dataset {dataset.name!r}")

    if args.no_launch:
        print(
            "dataset is persistent — open it in your App session; delete it "
            f"when done: fiftyone datasets delete {dataset.name}"
        )
        return

    print(
        "launching the App — open the sample modal to see the Sensor Traces "
        "+ Sensor Gauges panels (use the split-layout icon to view video and "
        "panel side by side); press Ctrl-C to exit"
    )
    session = fo.launch_app(dataset)
    try:
        session.wait()
    except KeyboardInterrupt:
        pass  # clean exit; the non-persistent demo dataset is auto-removed


if __name__ == "__main__":
    main()
