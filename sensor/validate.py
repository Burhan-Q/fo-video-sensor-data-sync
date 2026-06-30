"""Shared config validator for ``sensor_schema`` dicts.

This module is the single source of truth for two things:

  - The MVP structural checks a ``sensor_schema`` config must satisfy
    (see ``validate``), used by the loader and by any UI that lets a
    user author/import a schema before it is attached to a dataset.
  - The ``<entity>_<channel>`` / ``<shared-channel>`` field-name
    convention (see ``_expected_columns``), reused verbatim by the
    loader (Task 3) so the convention is defined in exactly one place.

``validate`` never raises: it accumulates problems into a list of
human-readable strings and returns that list (``[]`` means valid).
"""

from __future__ import annotations

_GAUGES: set[str] = {"radial", "signed", "linear", "vector"}
_SCOPES: set[str] = {"entity", "shared"}


def _expected_columns(schema: dict) -> list[str]:
    """Return the per-frame source column names implied by ``schema``.

    For each channel: ``scope == "entity"`` expands to one column per
    entity (``f"{entity_name}_{channel_key}"``); ``scope == "shared"``
    produces a single column (``channel_key``). Channels whose scope is
    neither are skipped here (``validate`` reports those separately).
    The frame index field itself is not included.

    Parameters
    ----------
    schema:
        A ``sensor_schema`` dict with ``entities`` and ``channels``.

    Returns
    -------
    list[str]
        Column names in schema order.
    """
    columns: list[str] = []
    for channel in schema.get("channels", []):
        try:
            scope = channel.get("scope")
            key = channel["key"]
        except (KeyError, TypeError, AttributeError):
            continue
        if scope == "entity":
            for entity in schema.get("entities", []):
                try:
                    columns.append(f"{entity['name']}_{key}")
                except (KeyError, TypeError, AttributeError):
                    continue
        elif scope == "shared":
            columns.append(key)
    return columns


def validate(config: dict, sample_record: dict | None = None) -> list[str]:
    """Validate a ``sensor_schema`` config, accumulating all errors found.

    Never raises. Every problem is appended as a human-readable string
    to the returned list; an empty list means the config is valid.

    Parameters
    ----------
    config:
        The candidate ``sensor_schema`` dict.
    sample_record:
        Optional dict of an actual per-frame record (e.g. one row of
        parsed source data) to cross-check against the columns the
        schema implies (see ``_expected_columns``) and the configured
        frame field.

    Returns
    -------
    list[str]
        Accumulated error messages, in check order. ``[]`` if valid.
    """
    errors: list[str] = []

    if not isinstance(config, dict):
        return ["config must be a mapping/dict"]

    for key in ("version", "frame_field", "entities", "channels"):
        if key not in config:
            errors.append(f"missing required top-level key: {key!r}")

    frame_base = config.get("frame_base", 1)
    if frame_base not in (0, 1):
        errors.append(f"frame_base must be 0 or 1, got {frame_base!r}")

    entities = config.get("entities")
    entity_names: list[str] = []
    if "entities" in config:
        if not isinstance(entities, list):
            errors.append("entities must be a list")
        else:
            for entity in entities:
                try:
                    name = entity["name"]
                except (KeyError, TypeError, AttributeError):
                    errors.append(f"malformed entity (missing 'name'): {entity!r}")
                    continue
                entity_names.append(name)
            duplicates = {n for n in entity_names if entity_names.count(n) > 1}
            for name in duplicates:
                errors.append(f"duplicate entity name: {name!r}")

    channels = config.get("channels")
    channel_keys: list[str] = []
    if "channels" in config:
        if not isinstance(channels, list):
            errors.append("channels must be a list")
        else:
            for channel in channels:
                try:
                    key = channel["key"]
                except (KeyError, TypeError, AttributeError):
                    errors.append(f"malformed channel (missing 'key'): {channel!r}")
                    continue
                channel_keys.append(key)

                try:
                    scope = channel.get("scope")
                except (KeyError, TypeError, AttributeError):
                    scope = None
                if scope not in _SCOPES:
                    errors.append(
                        f"channel {key!r} has invalid scope {scope!r}; "
                        f"must be one of {sorted(_SCOPES)}"
                    )

                try:
                    gauge = channel.get("gauge")
                except (KeyError, TypeError, AttributeError):
                    gauge = None
                if gauge is not None and gauge not in _GAUGES:
                    errors.append(
                        f"channel {key!r} has invalid gauge {gauge!r}; "
                        f"must be one of {sorted(_GAUGES)} or null"
                    )

                try:
                    value_range = channel.get("range")
                except (KeyError, TypeError, AttributeError):
                    value_range = None
                if value_range is not None:
                    if (
                        not isinstance(value_range, (list, tuple))
                        or len(value_range) != 2
                    ):
                        errors.append(
                            f"channel {key!r} range must be a length-2 [lo, hi]"
                        )
                    else:
                        lo, hi = value_range
                        if not isinstance(lo, (int, float)) or (
                            hi is not None and not isinstance(hi, (int, float))
                        ):
                            errors.append(
                                f"channel {key!r} range bounds must be numbers "
                                "(or hi null for auto)"
                            )
                        elif hi is not None and not (lo <= hi):
                            errors.append(
                                f"channel {key!r} range must have lo <= hi (or hi null for auto)"
                            )

                try:
                    value_labels = channel.get("value_labels")
                except (KeyError, TypeError, AttributeError):
                    value_labels = None
                if value_labels is not None:
                    if not isinstance(value_labels, dict):
                        errors.append(f"channel {key!r} value_labels must be a mapping")
                    else:
                        for label_key, label_value in value_labels.items():
                            if not isinstance(label_key, (int, float, str)):
                                errors.append(
                                    f"channel {key!r} value_labels key {label_key!r} "
                                    "must be int, float, or str"
                                )
                            if not isinstance(label_value, str):
                                errors.append(
                                    f"channel {key!r} value_labels value {label_value!r} "
                                    "must be a str"
                                )

            duplicates = {k for k in channel_keys if channel_keys.count(k) > 1}
            for key in duplicates:
                errors.append(f"duplicate channel key: {key!r}")

    if sample_record is not None:
        frame_field = config.get("frame_field")
        if frame_field is not None and frame_field not in sample_record:
            errors.append(f"sample_record missing frame field: {frame_field!r}")
        for column in _expected_columns(config):
            if column not in sample_record:
                errors.append(f"sample_record missing expected column: {column!r}")

    return errors
