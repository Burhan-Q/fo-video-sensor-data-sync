"""Pure query helper: fetch per-frame sensor arrays for one video sample.

This module is the single data source for the JS panels that render
per-frame sensor data. The ``get_frame_sensor_data`` operator (in the
package root ``__init__.py``) delegates entirely to
``frame_sensor_arrays``; keeping the logic here makes it unit-testable
without an operator context.

The schema is read from ``dataset.info["sensor_schema"]`` and describes:
  - ``frame_field``: the per-frame index field *in the source data* (a
    load-time concept — after loading, frames are always indexed by
    FiftyOne's built-in 1-based ``frame_number``, which is what this
    module reads back).
  - ``fps_field``: the sample-level frames-per-second field, if any.
  - ``entities``: a list of ``{"name": ...}`` dicts (e.g. multiple tracked
    subjects in the video).
  - ``channels``: a list of ``{"key": ..., "scope": "entity" | "shared"}``
    dicts. An ``"entity"``-scoped channel is expanded once per entity
    (column key ``f"{entity}_{channel}"``); a ``"shared"``-scoped channel
    produces a single column (column key ``channel``) — see
    ``sensor.validate._expected_columns``, the single definition of that
    convention.
"""

import fiftyone as fo
import fiftyone.core.view as fov

from .validate import _expected_columns


def _frame_paths(schema: dict) -> tuple[list[str], list[str]]:
    """Build the ``frames[].*`` field paths and bare column keys for a schema.

    Returns
    -------
    tuple[list[str], list[str]]
        ``(paths, keys)`` where ``paths`` is ``frames[]``-prefixed field
        paths (FiftyOne's built-in ``frame_number`` index first, then one
        per column key) and ``keys`` is the bare column keys in the same
        order as the trailing entries of ``paths``.
    """
    keys = _expected_columns(schema)
    paths = ["frames[].frame_number"] + [f"frames[].{key}" for key in keys]
    return paths, keys


def frame_sensor_arrays(view: fo.DatasetView | fo.Dataset, sample_id: str) -> dict:
    """Return per-frame sensor arrays and the sample's fps for one sample.

    Parameters
    ----------
    view:
        A FiftyOne dataset or view to query against.
    sample_id:
        The ``_id`` string of the target video sample.

    Returns
    -------
    dict
        Keys: ``frame_numbers`` (1-based FiftyOne frame numbers),
        ``columns`` (dict mapping column key to a list of floats/``None``,
        one entry per frame number), ``fps`` (float or ``None``), and
        ``schema`` (the ``sensor_schema`` dict, verbatim, or ``None``).

        If the dataset/view has no ``sensor_schema`` in ``info``, or the
        sample has no frames, ``columns`` is empty and ``frame_numbers``
        is empty; ``schema`` still reflects whatever was found (``None``
        in the no-schema case).
    """
    schema: dict | None = (view.info or {}).get("sensor_schema")
    if not schema:
        return {"frame_numbers": [], "columns": {}, "fps": None, "schema": None}

    paths, keys = _frame_paths(schema)

    sel = fov.make_optimized_select_view(view, [sample_id])

    # Pull per-frame columns in a single .values() call — returns a tuple of
    # flat lists, one per path. _allow_missing=True so schemas that declare
    # a column (e.g. an entity/channel combination) that was never actually
    # written to any frame return a None-filled list rather than raising on
    # an unknown field name.
    # NOTE: _allow_missing is a PRIVATE FiftyOne parameter (underscore-
    # prefixed; stable for years but not guaranteed across major releases).
    # If it breaks, replace with: check sel.get_frame_field_schema() for
    # which frames[].<key> fields exist, then fill any absent column with
    # [None] * len(frame_numbers).
    cols: tuple = sel.values(paths, _allow_missing=True)
    frame_numbers: list = cols[0] or []

    if not frame_numbers:
        return {"frame_numbers": [], "columns": {}, "fps": None, "schema": schema}

    # OBSERVED behavior: for a declared-but-never-written entity/channel
    # column, _allow_missing=True already yields a per-frame [None, None, ...]
    # fill (matching len(frame_numbers)), not a scalar None/empty list — so
    # no extra normalization is needed here. Kept defensive with `or []`
    # plus a length-normalizing fallback below in case a future FiftyOne
    # release changes this shape.
    n = len(frame_numbers)
    columns: dict[str, list] = {}
    for i, key in enumerate(keys):
        col = cols[i + 1] or []
        columns[key] = col if len(col) == n else [None] * n

    # fps is a sample-level scalar; only look it up if the schema declares
    # a fps field. sel.values(field) returns a per-sample list — take [0]
    # for the single selected sample.
    fps: float | None = None
    fps_field = schema.get("fps_field")
    if fps_field:
        per_sample: list = sel.values(fps_field, _allow_missing=True)
        fps = per_sample[0] if per_sample else None

    return {
        "frame_numbers": frame_numbers,
        "columns": columns,
        "fps": fps,
        "schema": schema,
    }
