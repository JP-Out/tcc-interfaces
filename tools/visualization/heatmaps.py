from __future__ import annotations

from collections import defaultdict
from html import escape
from pathlib import Path

from input.readers import SessionSource
from visualization.mouse_tracking import parse_click_events, parse_viewport_changes
from visualization.svg_utils import (
    build_grid,
    get_image_size,
    load_background_data_uri,
    normalize_file_stem,
    resolve_screenshot_path,
)


DEFAULT_CANVAS_SIZE = (1920, 1080)


def generate_heatmaps(
    session_sources: list[SessionSource],
    *,
    output_dir: Path,
    screenshots_dir: Path,
    scope: str = "version",
) -> list[Path]:
    output_paths: list[Path] = []

    if scope in {"version", "both"}:
        output_paths.extend(
            generate_version_heatmaps(
                session_sources,
                output_dir=output_dir / "by-version",
                screenshots_dir=screenshots_dir,
            ),
        )

    if scope in {"session", "both"}:
        output_paths.extend(
            generate_session_heatmaps(
                session_sources,
                output_dir=output_dir / "by-session",
                screenshots_dir=screenshots_dir,
            ),
        )

    return output_paths


def generate_version_heatmaps(
    session_sources: list[SessionSource],
    *,
    output_dir: Path,
    screenshots_dir: Path,
) -> list[Path]:
    grouped_points: dict[tuple[str, str], list[tuple[float, float]]] = defaultdict(list)
    grouped_sessions: dict[tuple[str, str], set[str]] = defaultdict(set)
    output_paths: list[Path] = []

    for session_source in session_sources:
        per_view_points = _collect_scaled_clicks_by_view(session_source, screenshots_dir)
        for view_name, scaled_points in per_view_points.items():
            if not scaled_points:
                continue

            key = (session_source.ui_version, view_name)
            grouped_points[key].extend(scaled_points)
            grouped_sessions[key].add(session_source.session_stem)

    for (ui_version, view_name), points in sorted(grouped_points.items()):
        background_path = resolve_screenshot_path(
            screenshots_dir,
            view_name,
            ui_version=ui_version,
        )
        width, height = get_image_size(background_path) or DEFAULT_CANVAS_SIZE
        output_path = output_dir / ui_version / f"{normalize_file_stem(view_name)}.svg"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            render_heatmap_svg(
                width=width,
                height=height,
                background_path=background_path,
                title=f"Heatmap de cliques - {ui_version}",
                subtitle=f"View: {view_name}",
                points=points,
                total_clicks=len(points),
                session_count=len(grouped_sessions[(ui_version, view_name)]),
            ),
            encoding="utf-8",
        )
        output_paths.append(output_path)

    return output_paths


def generate_session_heatmaps(
    session_sources: list[SessionSource],
    *,
    output_dir: Path,
    screenshots_dir: Path,
) -> list[Path]:
    output_paths: list[Path] = []

    for session_source in session_sources:
        per_view_points = _collect_scaled_clicks_by_view(session_source, screenshots_dir)
        for view_name, points in sorted(per_view_points.items()):
            if not points:
                continue

            background_path = resolve_screenshot_path(
                screenshots_dir,
                view_name,
                ui_version=session_source.ui_version,
            )
            width, height = get_image_size(background_path) or DEFAULT_CANVAS_SIZE
            output_path = output_dir / session_source.session_stem / f"{normalize_file_stem(view_name)}.svg"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(
                render_heatmap_svg(
                    width=width,
                    height=height,
                    background_path=background_path,
                    title=f"Heatmap de cliques - {session_source.ui_version}",
                    subtitle=f"Sessao {session_source.session_stem} / view {view_name}",
                    points=points,
                    total_clicks=len(points),
                    session_count=1,
                ),
                encoding="utf-8",
            )
            output_paths.append(output_path)

    return output_paths


def render_heatmap_svg(
    *,
    width: int,
    height: int,
    background_path: Path | None,
    title: str,
    subtitle: str,
    points: list[tuple[float, float]],
    total_clicks: int,
    session_count: int,
) -> str:
    background_data_uri = load_background_data_uri(background_path)
    background_layer = (
        f'<image href="{background_data_uri}" x="0" y="0" width="{width}" height="{height}" '
        'preserveAspectRatio="none" opacity="0.97" />'
        if background_data_uri
        else (
            f'<rect x="0" y="0" width="{width}" height="{height}" fill="#f8fafc" />\n'
            f"{build_grid(width, height)}"
        )
    )

    heat_opacity = _get_heat_opacity(len(points))
    heat_layer = "\n".join(
        [
            f'<circle cx="{x:.2f}" cy="{y:.2f}" r="72" fill="url(#heat-core)" '
            f'opacity="{heat_opacity:.3f}" filter="url(#heat-blur)" />'
            for x, y in points
        ],
    )
    point_layer = "\n".join(
        [
            f'<circle cx="{x:.2f}" cy="{y:.2f}" r="5" fill="#7f1d1d" opacity="0.18" />'
            for x, y in points
        ],
    )

    panel_x = 24
    panel_y = 24
    panel_height = 138

    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}">',
            "<defs>",
            '<radialGradient id="heat-core" cx="50%" cy="50%" r="50%">',
            '<stop offset="0%" stop-color="#fde047" stop-opacity="0.98" />',
            '<stop offset="35%" stop-color="#fb923c" stop-opacity="0.72" />',
            '<stop offset="70%" stop-color="#ef4444" stop-opacity="0.38" />',
            '<stop offset="100%" stop-color="#991b1b" stop-opacity="0" />',
            "</radialGradient>",
            '<filter id="heat-blur" x="-30%" y="-30%" width="160%" height="160%">',
            '<feGaussianBlur stdDeviation="18" />',
            "</filter>",
            "</defs>",
            background_layer,
            f'<rect x="0" y="0" width="{width}" height="{height}" fill="rgba(15, 23, 42, 0.12)" />',
            heat_layer,
            point_layer,
            f'<rect x="{panel_x}" y="{panel_y}" width="470" height="{panel_height}" rx="22" '
            'fill="rgba(255,255,255,0.90)" stroke="rgba(15,23,42,0.10)" stroke-width="1.5" />',
            f'<text x="{panel_x + 22}" y="{panel_y + 34}" fill="#0f172a" '
            'font-family="Arial, sans-serif" font-size="24" font-weight="700">'
            f"{escape(title)}</text>",
            f'<text x="{panel_x + 22}" y="{panel_y + 62}" fill="#334155" '
            'font-family="Arial, sans-serif" font-size="14">'
            f"{escape(subtitle)}</text>",
            f'<text x="{panel_x + 22}" y="{panel_y + 92}" fill="#0f172a" '
            'font-family="Arial, sans-serif" font-size="14">Cliques agregados: '
            f"{total_clicks}</text>",
            f'<text x="{panel_x + 22}" y="{panel_y + 114}" fill="#0f172a" '
            'font-family="Arial, sans-serif" font-size="14">Sessoes consideradas: '
            f"{session_count}</text>",
            "</svg>",
        ],
    )


def _collect_scaled_clicks_by_view(
    session_source: SessionSource,
    screenshots_dir: Path,
) -> dict[str, list[tuple[float, float]]]:
    payload = session_source.payload
    mouse_tracking = payload.get("mouseTracking") or {}
    raw_views = mouse_tracking.get("views") or []
    views = [str(view) for view in raw_views]
    clicks = parse_click_events(mouse_tracking.get("clickEvents") or [])

    if not clicks:
        return {}

    grouped_points: dict[str, list[tuple[float, float]]] = defaultdict(list)

    for click in clicks:
        view_name = _resolve_view_name(views, click.view_index)
        background_path = resolve_screenshot_path(
            screenshots_dir,
            view_name,
            ui_version=session_source.ui_version,
        )
        background_width, background_height = get_image_size(background_path) or DEFAULT_CANVAS_SIZE
        viewport_width, viewport_height = _get_session_viewport_size(
            payload,
            fallback_width=background_width,
            fallback_height=background_height,
        )

        normalized_x = _clamp_ratio(click.x, viewport_width)
        normalized_y = _clamp_ratio(click.y, viewport_height)
        grouped_points[view_name].append(
            (
                normalized_x * background_width,
                normalized_y * background_height,
            ),
        )

    return grouped_points


def _get_session_viewport_size(
    payload: dict,
    *,
    fallback_width: int,
    fallback_height: int,
) -> tuple[int, int]:
    mouse_tracking = payload.get("mouseTracking") or {}
    viewport_changes = parse_viewport_changes(mouse_tracking.get("viewportChanges") or [])

    for change in viewport_changes:
        if change.width > 0 and change.height > 0:
            return change.width, change.height

    if viewport_changes:
        width = max(change.width for change in viewport_changes)
        height = max(change.height for change in viewport_changes)
        if width > 0 and height > 0:
            return width, height

    return fallback_width, fallback_height


def _resolve_view_name(views: list[str], view_index: int) -> str:
    if 0 <= view_index < len(views) and views[view_index]:
        return views[view_index]

    return f"view-{view_index}"


def _clamp_ratio(value: int, divisor: int) -> float:
    if divisor <= 0:
        return 0.0

    return min(max(value / divisor, 0.0), 1.0)


def _get_heat_opacity(points_count: int) -> float:
    if points_count <= 8:
        return 0.34
    if points_count <= 24:
        return 0.24
    return 0.16
