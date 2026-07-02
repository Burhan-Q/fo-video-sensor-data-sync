"""Shared config validator for ``sensor_schema`` dicts.

This module is the single source of truth for two things:

  - The MVP structural checks a ``sensor_schema`` config must satisfy
    (see ``validate``), used by the loader and by any UI that lets a
    user author/import a schema before it is attached to a dataset.
  - The ``<entity>_<channel>`` / ``<shared-channel>`` field-name
    convention (see ``_expected_columns``), reused verbatim by the
    loader so the convention is defined in exactly one place.

``validate`` never raises: it accumulates problems into a list of
human-readable strings and returns that list (``[]`` means valid).
"""

_GAUGES: set[str] = {"radial", "signed", "linear", "vector"}
_SCOPES: set[str] = {"entity", "shared"}


def _expected_columns(schema: dict) -> list[str]:
    """Return the per-frame source column names implied by ``schema``.

    For each channel: ``scope == "entity"`` expands to one column per
    entity (``f"{entity_name}_{channel_key}"``); ``scope == "shared"``
    produces a single column (``channel_key``). Malformed entries and
    channels whose scope is neither are skipped here (``validate``
    reports those separately). The frame index field itself is not
    included.

    Parameters
    ----------
    schema:
        A ``sensor_schema`` dict with ``entities`` and ``channels``.

    Returns
    -------
    list[str]
        Column names in schema order.
    """
    channels = schema.get("channels")
    entities = schema.get("entities")
    if not isinstance(channels, list):
        channels = []
    if not isinstance(entities, list):
        entities = []

    columns: list[str] = []
    for channel in channels:
        if not isinstance(channel, dict) or "key" not in channel:
            continue
        key = channel["key"]
        scope = channel.get("scope")
        if scope == "entity":
            for entity in entities:
                if isinstance(entity, dict) and "name" in entity:
                    columns.append(f"{entity['name']}_{key}")
        elif scope == "shared":
            columns.append(key)
    return columns


def _validate_range(key: str, value_range: object, errors: list[str]) -> None:
    """Append errors for a malformed channel ``range`` to ``errors``.

    Parameters
    ----------
    key:
        The owning channel's key (used in error messages).
    value_range:
        The channel's ``range`` value; ``None`` is valid (no range).
    errors:
        The accumulator list to append to.
    """
    if value_range is None:
        return
    if not isinstance(value_range, (list, tuple)) or len(value_range) != 2:
        errors.append(f"channel {key!r} range must be a length-2 [lo, hi]")
        return
    lo, hi = value_range
    if not isinstance(lo, (int, float)) or (
        hi is not None and not isinstance(hi, (int, float))
    ):
        errors.append(
            f"channel {key!r} range bounds must be numbers (or hi null for auto)"
        )
    elif hi is not None and not (lo <= hi):
        errors.append(f"channel {key!r} range must have lo <= hi (or hi null for auto)")


def _validate_value_labels(key: str, value_labels: object, errors: list[str]) -> None:
    """Append errors for a malformed channel ``value_labels`` to ``errors``.

    Parameters
    ----------
    key:
        The owning channel's key (used in error messages).
    value_labels:
        The channel's ``value_labels`` value; ``None`` is valid (no labels).
    errors:
        The accumulator list to append to.
    """
    if value_labels is None:
        return
    if not isinstance(value_labels, dict):
        errors.append(f"channel {key!r} value_labels must be a mapping")
        return
    for label_key, label_value in value_labels.items():
        if not isinstance(label_key, (int, float, str)):
            errors.append(
                f"channel {key!r} value_labels key {label_key!r} "
                "must be int, float, or str"
            )
        if not isinstance(label_value, str):
            errors.append(
                f"channel {key!r} value_labels value {label_value!r} must be a str"
            )


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
        schema implies (see ``_expected_columns``), the configured
        frame field, and any declared ``sample_fields``.

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
    if "entities" in config:
        if not isinstance(entities, list):
            errors.append("entities must be a list")
        else:
            entity_names: list[str] = []
            for entity in entities:
                if not isinstance(entity, dict) or "name" not in entity:
                    errors.append(f"malformed entity (missing 'name'): {entity!r}")
                    continue
                name = entity["name"]
                if not isinstance(name, str):
                    errors.append(f"entity name must be a string: {name!r}")
                    continue
                entity_names.append(name)
            for name in {n for n in entity_names if entity_names.count(n) > 1}:
                errors.append(f"duplicate entity name: {name!r}")

    channels = config.get("channels")
    if "channels" in config:
        if not isinstance(channels, list):
            errors.append("channels must be a list")
        else:
            channel_keys: list[str] = []
            for channel in channels:
                if not isinstance(channel, dict) or "key" not in channel:
                    errors.append(f"malformed channel (missing 'key'): {channel!r}")
                    continue
                key = channel["key"]
                if not isinstance(key, str):
                    errors.append(f"channel key must be a string: {key!r}")
                    continue
                channel_keys.append(key)

                if "label" not in channel:
                    errors.append(f"channel {key!r} missing required 'label'")
                elif not isinstance(channel["label"], str):
                    errors.append(f"channel {key!r} label must be a string")

                scope = channel.get("scope")
                if scope not in _SCOPES:
                    errors.append(
                        f"channel {key!r} has invalid scope {scope!r}; "
                        f"must be one of {sorted(_SCOPES)}"
                    )

                gauge = channel.get("gauge")
                if gauge is not None and gauge not in _GAUGES:
                    errors.append(
                        f"channel {key!r} has invalid gauge {gauge!r}; "
                        f"must be one of {sorted(_GAUGES)} or null"
                    )

                _validate_range(key, channel.get("range"), errors)
                _validate_value_labels(key, channel.get("value_labels"), errors)

            for key in {k for k in channel_keys if channel_keys.count(k) > 1}:
                errors.append(f"duplicate channel key: {key!r}")

    sample_fields = config.get("sample_fields")
    if sample_fields is not None and (
        not isinstance(sample_fields, list)
        or not all(isinstance(f, str) for f in sample_fields)
    ):
        errors.append("sample_fields must be a list of strings")
        sample_fields = None

    if sample_record is not None:
        frame_field = config.get("frame_field")
        if frame_field is not None and frame_field not in sample_record:
            errors.append(f"sample_record missing frame field: {frame_field!r}")
        for column in _expected_columns(config):
            if column not in sample_record:
                errors.append(f"sample_record missing expected column: {column!r}")
        for field in sample_fields or []:
            if field not in sample_record:
                errors.append(f"sample_record missing sample field: {field!r}")

    return errors


def main(argv: list[str] | None = None) -> int:
    """CLI entry point: ``python sensor/validate.py config.yaml [data.json]``.

    Parameters
    ----------
    argv:
        Argument list to parse; ``None`` uses ``sys.argv[1:]``.

    Returns
    -------
    int
        Process exit code: ``0`` if the config validates, ``1`` otherwise
        (one error per line is printed first).
    """
    import argparse
    import json
    from pathlib import Path

    import yaml

    parser = argparse.ArgumentParser(
        description="Validate a sensor_schema YAML config."
    )
    parser.add_argument("config", help="Path to the sensor_schema YAML config.")
    parser.add_argument(
        "data",
        nargs="?",
        help="Optional JSON data file; row 0 is checked against the schema.",
    )
    args = parser.parse_args(argv)

    config = yaml.safe_load(Path(args.config).read_text())
    sample_record = None
    if args.data:
        rows = json.loads(Path(args.data).read_text())
        sample_record = rows[0] if isinstance(rows, list) and rows else None
    errors = validate(config, sample_record)
    if errors:
        for e in errors:
            print(e)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
