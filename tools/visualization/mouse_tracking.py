from __future__ import annotations

from dataclasses import dataclass
from html import escape
from pathlib import Path
from typing import Any, Iterable

from input.readers import SessionSource
from visualization.svg_utils import (
    build_grid,
    load_background_data_uri,
    normalize_file_stem,
    resolve_screenshot_path,
)


@dataclass(frozen=True)
class MousePoint:
    elapsed_ms: int
    x: int
    y: int
    view_index: int


@dataclass(frozen=True)
class ViewportChange:
    elapsed_ms: int
    width: int
    height: int
    device_pixel_ratio: float


@dataclass(frozen=True)
class ClickEvent:
    elapsed_ms: int
    x: int
    y: int
    view_index: int


@dataclass(frozen=True)
class ViewMetrics:
    index: int
    name: str
    points: list[MousePoint]
    clicks: list[ClickEvent]


def has_mouse_tracking_data(payload: dict[str, Any]) -> bool:
    mouse_tracking = payload.get("mouseTracking")

    if not isinstance(mouse_tracking, dict):
        return False

    if mouse_tracking.get("enabled") is False:
        return False

    return bool(mouse_tracking.get("points") or mouse_tracking.get("clickEvents"))


def parse_mouse_points(raw_points: Iterable[list[Any]]) -> list[MousePoint]:
    points: list[MousePoint] = []

    for raw_point in raw_points:
        if not isinstance(raw_point, list) or len(raw_point) < 4:
            continue

        elapsed_ms, x, y, view_index = raw_point[:4]
        points.append(
            MousePoint(
                elapsed_ms=_coerce_int(elapsed_ms, 0),
                x=_coerce_int(x, 0),
                y=_coerce_int(y, 0),
                view_index=_coerce_int(view_index, -1),
            ),
        )

    return points


def parse_viewport_changes(raw_changes: Iterable[list[Any]]) -> list[ViewportChange]:
    changes: list[ViewportChange] = []

    for raw_change in raw_changes:
        if not isinstance(raw_change, list) or len(raw_change) < 4:
            continue

        elapsed_ms, width, height, device_pixel_ratio = raw_change[:4]
        changes.append(
            ViewportChange(
                elapsed_ms=_coerce_int(elapsed_ms, 0),
                width=max(_coerce_int(width, 0), 0),
                height=max(_coerce_int(height, 0), 0),
                device_pixel_ratio=float(device_pixel_ratio or 1),
            ),
        )

    return changes


def parse_click_events(raw_clicks: Iterable[list[Any]]) -> list[ClickEvent]:
    clicks: list[ClickEvent] = []

    for raw_click in raw_clicks:
        if not isinstance(raw_click, list) or len(raw_click) < 4:
            continue

        elapsed_ms, x, y, view_index = raw_click[:4]
        clicks.append(
            ClickEvent(
                elapsed_ms=_coerce_int(elapsed_ms, 0),
                x=_coerce_int(x, 0),
                y=_coerce_int(y, 0),
                view_index=_coerce_int(view_index, -1),
            ),
        )

    return clicks


def generate_mouse_tracking_outputs(
    session_source: SessionSource,
    *,
    output_dir: Path,
    screenshots_dir: Path,
    stroke_width: float = 4.0,
    show_points: bool = False,
    single_output: bool = False,
) -> list[Path]:
    payload = session_source.payload
    if not has_mouse_tracking_data(payload):
        return []

    output_dir.mkdir(parents=True, exist_ok=True)
    if single_output:
        output_path = output_dir / f"{session_source.session_stem}-tracking.svg"
        svg = generate_svg(
            payload=payload,
            background_data_uri=None,
            stroke_width=stroke_width,
            show_points=show_points,
        )
        output_path.write_text(svg, encoding="utf-8")
        return [output_path]

    return generate_per_view_svgs(
        payload=payload,
        session_source=session_source,
        screenshots_dir=screenshots_dir,
        output_dir=output_dir,
        stroke_width=stroke_width,
        show_points=show_points,
    )


def generate_per_view_svgs(
    *,
    payload: dict[str, Any],
    session_source: SessionSource,
    screenshots_dir: Path,
    output_dir: Path,
    stroke_width: float,
    show_points: bool,
) -> list[Path]:
    output_paths: list[Path] = []
    view_metrics = collect_view_metrics(payload)

    for view_metric in view_metrics:
        background_path = resolve_screenshot_path(
            screenshots_dir,
            view_metric.name,
            ui_version=session_source.ui_version,
        )
        background_data_uri = load_background_data_uri(background_path)
        output_path = output_dir / (
            f"{session_source.session_stem}-{normalize_file_stem(view_metric.name)}.svg"
        )

        svg = generate_svg(
            payload=payload,
            background_data_uri=background_data_uri,
            stroke_width=stroke_width,
            show_points=show_points,
            points=remap_points_for_single_view(view_metric.points, view_metric.index),
            clicks=remap_clicks_for_single_view(view_metric.clicks, view_metric.index),
            views=[view_metric.name],
            current_view_name=view_metric.name,
        )
        output_path.write_text(svg, encoding="utf-8")
        output_paths.append(output_path)

    return output_paths


def collect_view_metrics(payload: dict[str, Any]) -> list[ViewMetrics]:
    mouse_tracking = payload.get("mouseTracking") or {}
    views = [str(view) for view in (mouse_tracking.get("views") or [])]
    grouped_points: dict[int, list[MousePoint]] = {}
    grouped_clicks: dict[int, list[ClickEvent]] = {}

    for point in parse_mouse_points(mouse_tracking.get("points") or []):
        grouped_points.setdefault(point.view_index, []).append(point)

    for click in parse_click_events(mouse_tracking.get("clickEvents") or []):
        grouped_clicks.setdefault(click.view_index, []).append(click)

    view_indexes = sorted(set(grouped_points) | set(grouped_clicks))
    collected: list[ViewMetrics] = []

    for view_index in view_indexes:
        view_points = grouped_points.get(view_index, [])
        view_clicks = grouped_clicks.get(view_index, [])

        if not view_points and not view_clicks:
            continue

        if 0 <= view_index < len(views) and views[view_index]:
            view_name = views[view_index]
        else:
            view_name = f"view-{view_index}"

        collected.append(
            ViewMetrics(
                index=view_index,
                name=view_name,
                points=view_points,
                clicks=view_clicks,
            ),
        )

    return collected


def remap_points_for_single_view(points: Iterable[MousePoint], view_index: int) -> list[MousePoint]:
    return [
        MousePoint(
            elapsed_ms=point.elapsed_ms,
            x=point.x,
            y=point.y,
            view_index=0,
        )
        for point in points
        if point.view_index == view_index
    ]


def remap_clicks_for_single_view(clicks: Iterable[ClickEvent], view_index: int) -> list[ClickEvent]:
    return [
        ClickEvent(
            elapsed_ms=click.elapsed_ms,
            x=click.x,
            y=click.y,
            view_index=0,
        )
        for click in clicks
        if click.view_index == view_index
    ]


def generate_svg(
    *,
    payload: dict[str, Any],
    background_data_uri: str | None,
    stroke_width: float,
    show_points: bool,
    points: list[MousePoint] | None = None,
    clicks: list[ClickEvent] | None = None,
    views: list[str] | None = None,
    current_view_name: str | None = None,
) -> str:
    mouse_tracking = payload.get("mouseTracking") or {}
    points = points if points is not None else parse_mouse_points(mouse_tracking.get("points") or [])
    clicks = clicks if clicks is not None else parse_click_events(mouse_tracking.get("clickEvents") or [])
    views = views if views is not None else [str(view) for view in (mouse_tracking.get("views") or [])]
    width, height = get_canvas_size(payload)

    background_layer = (
        f'<image href="{background_data_uri}" x="0" y="0" width="{width}" height="{height}" '
        'preserveAspectRatio="none" opacity="0.96" />'
        if background_data_uri
        else (
            f'<rect x="0" y="0" width="{width}" height="{height}" fill="#f8fafc" />\n'
            f"{build_grid(width, height)}"
        )
    )

    subtitle = (
        (
            f"Trajeto da view {current_view_name} plotado sobre a screenshot correspondente."
            if current_view_name
            else "Trajeto plotado sobre a screenshot fornecida."
        )
        if background_data_uri
        else (
            f"Trajeto da view {current_view_name} plotado sobre um canvas neutro."
            if current_view_name
            else "Trajeto plotado sobre um canvas neutro com a mesma viewport registrada."
        )
    )

    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}">',
            "<defs>",
            '<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">',
            '<feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="rgba(15,23,42,0.18)" />',
            "</filter>",
            "</defs>",
            background_layer,
            f'<rect x="16" y="16" width="420" height="80" rx="18" fill="rgba(255,255,255,0.86)" '
            'filter="url(#shadow)" />',
            '<text x="34" y="48" fill="#0f172a" font-family="Arial, sans-serif" '
            'font-size="22" font-weight="700">Mouse Tracking</text>',
            f'<text x="34" y="74" fill="#334155" font-family="Arial, sans-serif" '
            f'font-size="13">{escape(subtitle)}</text>',
            build_path_segments(points, stroke_width),
            build_click_markers(clicks),
            build_point_dots(points) if show_points else "",
            build_start_end_markers(points),
            build_view_labels(points, views),
            build_info_panel_for_view(
                payload,
                width,
                height,
                view_name=current_view_name,
                points_count=len(points),
                clicks_count=len(clicks),
            ),
            "</svg>",
        ],
    )


def get_canvas_size(payload: dict[str, Any]) -> tuple[int, int]:
    mouse_tracking = payload.get("mouseTracking") or {}
    viewport_changes = parse_viewport_changes(mouse_tracking.get("viewportChanges") or [])

    if viewport_changes:
        width = max(change.width for change in viewport_changes)
        height = max(change.height for change in viewport_changes)
        return max(width, 1), max(height, 1)

    points = parse_mouse_points(mouse_tracking.get("points") or [])
    if points:
        width = max(point.x for point in points) + 40
        height = max(point.y for point in points) + 40
        return max(width, 1), max(height, 1)

    return 1366, 768


def interpolate_color(progress: float) -> str:
    progress = min(max(progress, 0.0), 1.0)

    start_rgb = (43, 108, 176)
    end_rgb = (220, 38, 38)
    red = round(start_rgb[0] + (end_rgb[0] - start_rgb[0]) * progress)
    green = round(start_rgb[1] + (end_rgb[1] - start_rgb[1]) * progress)
    blue = round(start_rgb[2] + (end_rgb[2] - start_rgb[2]) * progress)
    return f"rgb({red},{green},{blue})"


def build_path_segments(points: list[MousePoint], stroke_width: float) -> str:
    if len(points) < 2:
        return ""

    max_elapsed = max(point.elapsed_ms for point in points) or 1
    segments: list[str] = []

    for index in range(1, len(points)):
        previous = points[index - 1]
        current = points[index]
        progress = current.elapsed_ms / max_elapsed
        color = interpolate_color(progress)
        opacity = 0.35 + (0.45 * progress)
        segment_width = stroke_width + (1.4 * progress)

        segments.append(
            "<line "
            f'x1="{previous.x}" y1="{previous.y}" '
            f'x2="{current.x}" y2="{current.y}" '
            f'stroke="{color}" stroke-width="{segment_width:.2f}" '
            f'stroke-linecap="round" opacity="{opacity:.3f}" />',
        )

    return "\n".join(segments)


def build_point_dots(points: list[MousePoint]) -> str:
    if not points:
        return ""

    max_elapsed = max(point.elapsed_ms for point in points) or 1
    circles: list[str] = []

    for point in points:
        progress = point.elapsed_ms / max_elapsed
        circles.append(
            "<circle "
            f'cx="{point.x}" cy="{point.y}" r="2.2" '
            f'fill="{interpolate_color(progress)}" opacity="0.65" />',
        )

    return "\n".join(circles)


def build_click_markers(clicks: Iterable[ClickEvent]) -> str:
    markers: list[str] = []

    for click in clicks:
        x = click.x
        y = click.y
        markers.append(
            "\n".join(
                [
                    f'<circle cx="{x}" cy="{y}" r="10" fill="rgba(255,255,255,0.72)" '
                    'stroke="#0f172a" stroke-width="2" />',
                    f'<circle cx="{x}" cy="{y}" r="3.5" fill="#0f172a" />',
                ],
            ),
        )

    return "\n".join(markers)


def build_view_labels(points: list[MousePoint], views: list[str]) -> str:
    labels: list[str] = []
    rendered_view_indexes: set[int] = set()

    for point in points:
        if point.view_index < 0 or point.view_index >= len(views):
            continue

        if point.view_index in rendered_view_indexes:
            continue

        rendered_view_indexes.add(point.view_index)
        label = escape(views[point.view_index])
        labels.append(
            "\n".join(
                [
                    f'<rect x="{point.x + 10}" y="{point.y - 28}" width="{len(label) * 8 + 20}" '
                    'height="24" rx="12" fill="rgba(15, 23, 42, 0.82)" />',
                    f'<text x="{point.x + 20}" y="{point.y - 12}" fill="#ffffff" '
                    'font-family="Arial, sans-serif" font-size="12">'
                    f"{label}</text>",
                ],
            ),
        )

    return "\n".join(labels)


def build_start_end_markers(points: list[MousePoint]) -> str:
    if not points:
        return ""

    first = points[0]
    last = points[-1]

    return "\n".join(
        [
            f'<circle cx="{first.x}" cy="{first.y}" r="8" fill="#16a34a" stroke="#ffffff" stroke-width="3" />',
            f'<text x="{first.x + 14}" y="{first.y - 12}" fill="#166534" '
            'font-family="Arial, sans-serif" font-size="13" font-weight="700">Inicio</text>',
            f'<circle cx="{last.x}" cy="{last.y}" r="8" fill="#dc2626" stroke="#ffffff" stroke-width="3" />',
            f'<text x="{last.x + 14}" y="{last.y - 12}" fill="#991b1b" '
            'font-family="Arial, sans-serif" font-size="13" font-weight="700">Fim</text>',
        ],
    )


def build_info_panel_for_view(
    payload: dict[str, Any],
    width: int,
    height: int,
    *,
    view_name: str | None = None,
    points_count: int | None = None,
    clicks_count: int | None = None,
) -> str:
    mouse_tracking = payload.get("mouseTracking") or {}
    points = mouse_tracking.get("points") or []
    clicks = mouse_tracking.get("clickEvents") or []
    views = mouse_tracking.get("views") or []

    panel_width = 330
    panel_x = max(width - panel_width - 24, 24)
    panel_y = max(height - 184, 24)
    lines = [f"Interface: {payload.get('uiVersion', '-')}"]

    if view_name:
        lines.extend(
            [
                f"View: {view_name}",
                f"Pontos desta view: {points_count or 0}",
                f"Cliques desta view: {clicks_count or 0}",
            ],
        )
    else:
        lines.extend(
            [
                f"Sessao: {payload.get('sessionId', '-')}",
                f"Duracao: {payload.get('durationMs', 0)} ms",
                f"Pontos do mouse: {len(points)}",
                f"Cliques com posicao: {len(clicks)}",
                f"Views observadas: {', '.join(views) if views else '-'}",
            ],
        )

    text_chunks: list[str] = []
    for index, line in enumerate(lines):
        y = panel_y + 52 + (index * 20)
        text_chunks.append(
            f'<text x="{panel_x + 18}" y="{y}" fill="#0f172a" '
            'font-family="Arial, sans-serif" font-size="13">'
            f"{escape(line)}</text>",
        )

    return "\n".join(
        [
            f'<rect x="{panel_x}" y="{panel_y}" width="{panel_width}" height="154" rx="16" '
            'fill="rgba(255,255,255,0.88)" stroke="rgba(15,23,42,0.12)" stroke-width="1.5" />',
            f'<text x="{panel_x + 18}" y="{panel_y + 28}" fill="#0f172a" '
            'font-family="Arial, sans-serif" font-size="15" font-weight="700">Resumo do rastreio</text>',
            *text_chunks,
        ],
    )


def _coerce_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
