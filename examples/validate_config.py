"""Standalone CLI: validate a ``sensor_schema`` config (and optionally data).

Usage: ``python examples/validate_config.py config.yaml [data.json]``
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sensor.validate import validate  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate a sensor_schema config.")
    parser.add_argument("config", help="Path to the schema YAML file.")
    parser.add_argument(
        "data", nargs="?", help="Optional path to a sample data JSON file."
    )
    args = parser.parse_args()

    with open(args.config) as fh:
        cfg = yaml.safe_load(fh)

    sample_record = None
    if args.data:
        with open(args.data) as fh:
            rows = json.load(fh)
        sample_record = rows[0] if isinstance(rows, list) and rows else None

    errs = validate(cfg, sample_record)
    if errs:
        for err in errs:
            print(err)
        sys.exit(1)

    print("OK")
    sys.exit(0)


if __name__ == "__main__":
    main()
