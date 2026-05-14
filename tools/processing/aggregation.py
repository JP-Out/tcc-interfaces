from __future__ import annotations

from statistics import fmean
from typing import Any

from processing.session_metrics import AGGREGATE_METRIC_FIELDS


COMPARISON_FIELDNAMES = [
    "metric",
    "interface_a_mean",
    "interface_b_mean",
    "difference_interface_b_minus_a",
    "interface_a_n",
    "interface_b_n",
]


def aggregate_version_metrics(
    session_rows: list[dict[str, Any]],
    *,
    metric_fields: list[str] | None = None,
) -> list[dict[str, Any]]:
    metric_fields = metric_fields or AGGREGATE_METRIC_FIELDS
    comparison_rows: list[dict[str, Any]] = []

    for metric in metric_fields:
        interface_a_values = _get_metric_values(session_rows, "v1", metric)
        interface_b_values = _get_metric_values(session_rows, "v2", metric)
        interface_a_mean = fmean(interface_a_values) if interface_a_values else None
        interface_b_mean = fmean(interface_b_values) if interface_b_values else None

        comparison_rows.append(
            {
                "metric": metric,
                "interface_a_mean": interface_a_mean,
                "interface_b_mean": interface_b_mean,
                "difference_interface_b_minus_a": (
                    interface_b_mean - interface_a_mean
                    if interface_a_mean is not None and interface_b_mean is not None
                    else None
                ),
                "interface_a_n": len(interface_a_values),
                "interface_b_n": len(interface_b_values),
            },
        )

    return comparison_rows


def _get_metric_values(
    session_rows: list[dict[str, Any]],
    version: str,
    metric_field: str,
) -> list[float]:
    values: list[float] = []

    for row in session_rows:
        if row.get("ui_version") != version:
            continue

        raw_value = row.get(metric_field)
        if raw_value in (None, ""):
            continue

        values.append(float(raw_value))

    return values
