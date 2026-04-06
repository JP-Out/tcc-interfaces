from __future__ import annotations

from datetime import datetime
from math import isfinite
from typing import Any

from input.readers import SessionSource, infer_ui_version


SESSION_METRIC_FIELDNAMES = [
    "source_file",
    "session_id",
    "ui_version",
    "task_id",
    "started_at",
    "finished_at",
    "total_session_time_ms",
    "total_objectives",
    "completed_objectives",
    "manual_abandonments",
    "avg_objective_time_ms",
    "objective_completion_rate",
    "abandonment_rate",
    "error_count",
    "click_count",
    "clicks_per_completed_objective",
    "unique_screens_visited",
    "navigation_revisits",
    "avg_time_per_screen_ms",
]


AGGREGATE_METRIC_FIELDS = [
    "total_session_time_ms",
    "avg_objective_time_ms",
    "objective_completion_rate",
    "abandonment_rate",
    "error_count",
    "click_count",
    "clicks_per_completed_objective",
    "unique_screens_visited",
    "navigation_revisits",
    "avg_time_per_screen_ms",
]


def compute_session_metrics(session_source: SessionSource) -> dict[str, Any]:
    payload = session_source.payload
    total_session_time_ms = _get_session_duration_ms(payload)
    objectives = _flatten_objectives(payload.get("objectiveSets"))
    completed_objectives = sum(1 for objective in objectives if objective.get("status") == "concluido")
    manual_abandonments = sum(
        1
        for objective in objectives
        if objective.get("resolutionReason") == "desistencia_manual"
    )
    avg_objective_time_ms = _get_average_objective_time_ms(objectives)
    total_objectives = len(objectives)
    unique_screens = _get_unique_screens(payload)
    click_count = _coerce_int(payload.get("clickCount"), default=0)
    completed_divisor = completed_objectives if completed_objectives > 0 else None
    objective_divisor = total_objectives if total_objectives > 0 else None
    screen_divisor = unique_screens if unique_screens > 0 else None

    navigation_path = _get_navigation_path(payload)

    return {
        "source_file": str(session_source.source_path.resolve()),
        "session_id": payload.get("sessionId") or session_source.session_stem,
        "ui_version": infer_ui_version(payload, session_source.source_path),
        "task_id": payload.get("taskId") or "",
        "started_at": payload.get("startedAt") or "",
        "finished_at": payload.get("finishedAt") or "",
        "total_session_time_ms": total_session_time_ms,
        "total_objectives": total_objectives,
        "completed_objectives": completed_objectives,
        "manual_abandonments": manual_abandonments,
        "avg_objective_time_ms": avg_objective_time_ms,
        "objective_completion_rate": _safe_divide(completed_objectives, objective_divisor),
        "abandonment_rate": _safe_divide(manual_abandonments, objective_divisor),
        "error_count": _get_error_count(payload),
        "click_count": click_count,
        "clicks_per_completed_objective": _safe_divide(click_count, completed_divisor),
        "unique_screens_visited": unique_screens,
        "navigation_revisits": _count_navigation_revisits(navigation_path),
        "avg_time_per_screen_ms": _safe_divide(total_session_time_ms, screen_divisor),
    }


def _get_session_duration_ms(payload: dict[str, Any]) -> int:
    raw_duration = payload.get("durationMs")
    coerced_duration = _coerce_int(raw_duration)

    if coerced_duration is not None and coerced_duration >= 0:
        return coerced_duration

    started_at = _parse_iso_datetime(payload.get("startedAt"))
    finished_at = _parse_iso_datetime(payload.get("finishedAt"))

    if started_at and finished_at:
        delta_ms = round((finished_at - started_at).total_seconds() * 1000)
        return max(delta_ms, 0)

    return 0


def _flatten_objectives(raw_objective_sets: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_objective_sets, list):
        return []

    objectives: list[dict[str, Any]] = []

    for objective_set in raw_objective_sets:
        if not isinstance(objective_set, dict):
            continue

        raw_objectives = objective_set.get("objectives")
        if not isinstance(raw_objectives, list):
            continue

        for objective in raw_objectives:
            if isinstance(objective, dict):
                objectives.append(objective)

    return objectives


def _get_average_objective_time_ms(objectives: list[dict[str, Any]]) -> float | None:
    durations: list[int] = []

    for objective in objectives:
        if not _should_include_in_average_objective_time(objective):
            continue

        started_at = _parse_iso_datetime(objective.get("startedAt"))
        finished_at = _parse_iso_datetime(objective.get("completedAt")) or _parse_iso_datetime(
            objective.get("failedAt"),
        )

        if not started_at or not finished_at:
            continue

        duration_ms = round((finished_at - started_at).total_seconds() * 1000)
        if duration_ms < 0:
            continue

        durations.append(duration_ms)

    if not durations:
        return None

    return sum(durations) / len(durations)


def _should_include_in_average_objective_time(objective: dict[str, Any]) -> bool:
    if not isinstance(objective, dict):
        return False

    if objective.get("resolutionReason") == "dependencia_bloqueada":
        return False

    if objective.get("status") == "pendente":
        return False

    started_at = _parse_iso_datetime(objective.get("startedAt"))
    if not started_at:
        return False

    finished_at = _parse_iso_datetime(objective.get("completedAt")) or _parse_iso_datetime(
        objective.get("failedAt"),
    )
    return finished_at is not None


def _get_error_count(payload: dict[str, Any]) -> int:
    raw_error_count = _coerce_int(payload.get("errorCount"))

    if raw_error_count is not None:
        return max(raw_error_count, 0)

    raw_errors = payload.get("errors")
    if isinstance(raw_errors, list):
        return len(raw_errors)

    return 0


def _get_unique_screens(payload: dict[str, Any]) -> int:
    navigation_path = _get_navigation_path(payload)
    if navigation_path:
        return len(set(navigation_path))

    mouse_tracking = payload.get("mouseTracking")
    if not isinstance(mouse_tracking, dict):
        return 0

    raw_views = mouse_tracking.get("views")
    if not isinstance(raw_views, list):
        return 0

    filtered_views = [
        str(view).strip()
        for view in raw_views
        if isinstance(view, str) and view.strip()
    ]
    return len(set(filtered_views))


def _get_navigation_path(payload: dict[str, Any]) -> list[str]:
    raw_navigation_path = payload.get("navigationPath")

    if not isinstance(raw_navigation_path, list):
        return []

    return [
        str(screen).strip()
        for screen in raw_navigation_path
        if isinstance(screen, str) and screen.strip()
    ]


def _count_navigation_revisits(navigation_path: list[str]) -> int:
    if not navigation_path:
        return 0

    return max(len(navigation_path) - len(set(navigation_path)), 0)


def _parse_iso_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None

    normalized = value.strip().replace("Z", "+00:00")

    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _coerce_int(value: Any, *, default: int | None = None) -> int | None:
    if isinstance(value, bool):
        return default

    if isinstance(value, int):
        return value

    if isinstance(value, float) and isfinite(value):
        return round(value)

    return default


def _safe_divide(numerator: int | float, denominator: int | float | None) -> float | None:
    if denominator in (None, 0):
        return None

    return numerator / denominator
