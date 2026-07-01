"""Generic loader: per-frame sensor data -> a FiftyOne video sample.

This module knows nothing about any proprietary data format — it only
enforces the ``sensor_schema`` field-name convention defined in
``sensor/validate.py`` (``_expected_columns``) and writes the same
``dataset.info["sensor_schema"]`` marker that ``sensor/query.py`` reads.

Besides the per-frame columns, ``load_run`` also writes a per-channel
sample-level summary: for every column with at least one written value,
the sample gets ``f"{col}_min"``, ``f"{col}_max"``, and ``f"{col}_mean"``
fields, computed over that column's values across the loaded frames.
"""

from __future__ import annotations

import copy
import csv
import json
import os
from pathlib import Path

import fiftyone as fo

from .validate import _expected_columns, validate


def _read_rows(frames_path: str | Path) -> list[dict]:
    """Wide-format rows: a CSV with a header, or a JSON list of objects."""
    frames_path = Path(frames_path)
    if frames_path.suffix == ".json":
        rows = json.loads(frames_path.read_text())
        if not isinstance(rows, list) or not rows:
            raise ValueError(f"{frames_path}: expected a non-empty JSON list")
        return rows
    with frames_path.open(newline="") as fh:
        return list(csv.DictReader(fh))


def load_run(
    dataset: fo.Dataset,
    video_path: str | Path,
    frames_path: str | Path,
    schema: dict,
    cap_id: str,
) -> fo.Sample:
    """Add one video sample with per-frame sensor data, per ``schema``.

    Validates ``schema`` (fail-fast) against the first parsed row before
    touching the dataset, then writes per-frame columns following the
    ``<entity>_<channel>`` / ``<shared-channel>`` convention, the
    ``cap_id`` activation marker, a per-channel sample-level summary
    (``f"{col}_min"``, ``f"{col}_max"``, ``f"{col}_mean"`` for every
    column with at least one value), and stamps a JSON/Mongo-safe copy of
    ``schema`` onto ``dataset.info["sensor_schema"]``.
    """
    rows = _read_rows(frames_path)

    errs = validate(schema, sample_record=(rows[0] if rows else None))
    if errs:
        raise ValueError("invalid sensor schema:\n  - " + "\n  - ".join(errs))

    frame_field = schema["frame_field"]
    fps_field = schema.get("fps_field")
    offset = 1 - int(schema.get("frame_base", 1))  # normalize to FiftyOne 1-based
    columns = _expected_columns(schema)

    sample = fo.Sample(filepath=str(video_path))
    dataset.add_sample(sample)  # sample must be in the dataset before frames

    # Only probe metadata when the file actually exists, so the loader works
    # without real media (tests, sidecar-only authoring). When absent, total
    # stays None and all rows are loaded; when present, rows beyond the clip
    # are skipped.
    total: int | None = None
    if os.path.exists(video_path):
        sample.compute_metadata()
        if sample.metadata is not None:
            total = sample.metadata.total_frame_count

    col_values: dict[str, list[float]] = {c: [] for c in columns}
    for row in rows:
        n = int(row[frame_field]) + offset  # source base -> FiftyOne 1-based
        if total is not None and n > total:
            continue  # extra sidecar rows beyond the video are skipped
        for col in columns:
            val = row.get(col)
            if val not in (None, ""):
                fval = float(val)
                sample.frames[n][col] = fval
                col_values[col].append(fval)

    sample["cap_id"] = cap_id

    if fps_field and rows and fps_field in rows[0]:
        sample[fps_field] = float(rows[0][fps_field])

    for col, vals in col_values.items():
        if vals:
            sample[f"{col}_min"] = min(vals)
            sample[f"{col}_max"] = max(vals)
            sample[f"{col}_mean"] = round(sum(vals) / len(vals), 4)

    sample.save()

    # dataset.info is stored in MongoDB, which requires string dict keys.
    # value_labels maps come from YAML with integer keys (e.g. {0: "park"}) —
    # stamping them raw raises a bson InvalidDocument error. Stamp a
    # JSON-safe deep copy instead, leaving the caller's schema untouched.
    safe = copy.deepcopy(schema)
    for ch in safe.get("channels", []):
        vl = ch.get("value_labels")
        if isinstance(vl, dict):
            ch["value_labels"] = {str(k): v for k, v in vl.items()}
    dataset.info["sensor_schema"] = safe
    dataset.save()

    return sample


def import_run(
    video_path: str | Path,
    frames_path: str | Path,
    schema: dict,
    cap_id: str,
    dataset_name: str = "video-sensor-data",
    persistent: bool = True,
    overwrite: bool = False,
) -> fo.Dataset:
    """Create/load a dataset, add the run, and stamp the schema on it."""
    if fo.dataset_exists(dataset_name):
        if overwrite:
            fo.delete_dataset(dataset_name)
            dataset = fo.Dataset(dataset_name, persistent=persistent)
        else:
            dataset = fo.load_dataset(dataset_name)
    else:
        dataset = fo.Dataset(dataset_name, persistent=persistent)

    load_run(dataset, video_path, frames_path, schema, cap_id)
    return dataset
