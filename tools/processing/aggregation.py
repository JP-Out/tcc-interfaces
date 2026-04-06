from __future__ import annotations

from statistics import fmean
from typing import Any

from processing.session_metrics import AGGREGATE_METRIC_FIELDS


COMPARISON_FIELDNAMES = [
    "metric",
    "v1_mean",
    "v2_mean",
    "difference_v2_minus_v1",
    "v1_n",
    "v2_n",
]


def aggregate_version_metrics(
    session_rows: list[dict[str, Any]],
    *,
    metric_fields: list[str] | None = None,
) -> list[dict[str, Any]]:
    metric_fields = metric_fields or AGGREGATE_METRIC_FIELDS
    comparison_rows: list[dict[str, Any]] = []

    for metric in metric_fields:
        v1_values = _get_metric_values(session_rows, "v1", metric)
        v2_values = _get_metric_values(session_rows, "v2", metric)
        v1_mean = fmean(v1_values) if v1_values else None
        v2_mean = fmean(v2_values) if v2_values else None

        comparison_rows.append(
            {
                "metric": metric,
                "v1_mean": v1_mean,
                "v2_mean": v2_mean,
                "difference_v2_minus_v1": (
                    v2_mean - v1_mean
                    if v1_mean is not None and v2_mean is not None
                    else None
                ),
                "v1_n": len(v1_values),
                "v2_n": len(v2_values),
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
