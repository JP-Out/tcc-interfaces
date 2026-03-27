#!/usr/bin/env python3
"""Generate a visual mouse-tracking report from an SGOA metrics JSON file.

The script outputs a self-contained SVG file. When a screenshot is provided,
it is embedded as a base64 data URI so the result can be shared as a single
file and opened directly in a browser.
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
from dataclasses import dataclass
from html import escape
from pathlib import Path
from typing import Iterable


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render a mouse-tracking SVG from an SGOA metrics JSON file.",
    )
    parser.add_argument("metrics_json", type=Path, help="Path to the metrics JSON file.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Path for the generated SVG. Defaults to the JSON name with -tracking.svg.",
    )
    parser.add_argument(
        "-b",
        "--background",
        type=Path,
        help=(
            "Optional screenshot of the interface. "
            "Best results come from a screenshot captured at the same viewport size."
        ),
    )
    parser.add_argument(
        "--stroke-width",
        type=float,
        default=4.0,
        help="Base stroke width for the rendered path.",
    )
    parser.add_argument(
        "--show-points",
        action="store_true",
        help="Draw small dots for every sampled mouse point.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_background_data_uri(path: Path | None) -> str | None:
    if path is None:
        return None

    mime_type, _ = mimetypes.guess_type(path.name)
    mime_type = mime_type or "image/png"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def parse_mouse_points(raw_points: Iterable[list]) -> list[MousePoint]:
    points: list[MousePoint] = []

    for raw_point in raw_points:
        if not isinstance(raw_point, list) or len(raw_point) < 4:
            continue

        elapsed_ms, x, y, view_index = raw_point[:4]
        points.append(
            MousePoint(
                elapsed_ms=int(elapsed_ms),
                x=int(x),
                y=int(y),
                view_index=int(view_index),
            ),
        )

    return points


def parse_viewport_changes(raw_changes: Iterable[list]) -> list[ViewportChange]:
    changes: list[ViewportChange] = []

    for raw_change in raw_changes:
        if not isinstance(raw_change, list) or len(raw_change) < 4:
            continue

        elapsed_ms, width, height, dpr = raw_change[:4]
        changes.append(
            ViewportChange(
                elapsed_ms=int(elapsed_ms),
                width=int(width),
                height=int(height),
                device_pixel_ratio=float(dpr),
            ),
        )

    return changes


def get_canvas_size(payload: dict) -> tuple[int, int]:
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


def build_grid(width: int, height: int) -> str:
    step = 120
    lines: list[str] = []

    for x in range(step, width, step):
        lines.append(
            f'<line x1="{x}" y1="0" x2="{x}" y2="{height}" '
            'stroke="rgba(15, 23, 42, 0.08)" stroke-width="1" />'
        )

    for y in range(step, height, step):
        lines.append(
            f'<line x1="0" y1="{y}" x2="{width}" y2="{y}" '
            'stroke="rgba(15, 23, 42, 0.08)" stroke-width="1" />'
        )

    return "\n".join(lines)


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
            f'stroke-linecap="round" opacity="{opacity:.3f}" />'
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
            f'fill="{interpolate_color(progress)}" opacity="0.65" />'
        )

    return "\n".join(circles)


def build_click_markers(raw_clicks: Iterable[list]) -> str:
    markers: list[str] = []

    for raw_click in raw_clicks:
        if not isinstance(raw_click, list) or len(raw_click) < 4:
            continue

        _, x, y, _ = raw_click[:4]
        x = int(x)
        y = int(y)
        markers.append(
            "\n".join(
                [
                    f'<circle cx="{x}" cy="{y}" r="10" fill="rgba(255,255,255,0.72)" '
                    'stroke="#0f172a" stroke-width="2" />',
                    f'<circle cx="{x}" cy="{y}" r="3.5" fill="#0f172a" />',
                ],
            )
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
            )
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
            'font-family="Arial, sans-serif" font-size="13" font-weight="700">Início</text>',
            f'<circle cx="{last.x}" cy="{last.y}" r="8" fill="#dc2626" stroke="#ffffff" stroke-width="3" />',
            f'<text x="{last.x + 14}" y="{last.y - 12}" fill="#991b1b" '
            'font-family="Arial, sans-serif" font-size="13" font-weight="700">Fim</text>',
        ],
    )


def build_info_panel(payload: dict, width: int, height: int) -> str:
    mouse_tracking = payload.get("mouseTracking") or {}
    points = mouse_tracking.get("points") or []
    clicks = mouse_tracking.get("clickEvents") or []
    views = mouse_tracking.get("views") or []

    panel_width = 330
    panel_x = max(width - panel_width - 24, 24)
    panel_y = max(height - 184, 24)
    lines = [
        f"Interface: {payload.get('uiVersion', '-')}",
        f"Sessão: {payload.get('sessionId', '-')}",
        f"Duração: {payload.get('durationMs', 0)} ms",
        f"Pontos do mouse: {len(points)}",
        f"Cliques com posição: {len(clicks)}",
        f"Views observadas: {', '.join(views) if views else '-'}",
    ]

    text_chunks: list[str] = []
    for index, line in enumerate(lines):
        y = panel_y + 52 + (index * 20)
        text_chunks.append(
            f'<text x="{panel_x + 18}" y="{y}" fill="#0f172a" '
            'font-family="Arial, sans-serif" font-size="13">'
            f"{escape(line)}</text>"
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


def generate_svg(
    payload: dict,
    background_data_uri: str | None,
    stroke_width: float,
    show_points: bool,
) -> str:
    mouse_tracking = payload.get("mouseTracking") or {}
    points = parse_mouse_points(mouse_tracking.get("points") or [])
    clicks = mouse_tracking.get("clickEvents") or []
    views = [str(view) for view in (mouse_tracking.get("views") or [])]
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
        "Trajeto plotado sobre a screenshot fornecida."
        if background_data_uri
        else "Trajeto plotado sobre um canvas neutro com a mesma viewport registrada."
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
            build_info_panel(payload, width, height),
            "</svg>",
        ],
    )


def main() -> int:
    args = parse_args()
    payload = load_json(args.metrics_json)
    mouse_tracking = payload.get("mouseTracking") or {}

    if not mouse_tracking.get("enabled"):
        raise SystemExit("O JSON informado não possui mouseTracking habilitado.")

    if not mouse_tracking.get("points") and not mouse_tracking.get("clickEvents"):
        raise SystemExit("O JSON não possui pontos ou cliques de mouse para renderizar.")

    background_data_uri = load_background_data_uri(args.background)
    output_path = args.output or args.metrics_json.with_name(
        f"{args.metrics_json.stem}-tracking.svg",
    )

    svg = generate_svg(
        payload=payload,
        background_data_uri=background_data_uri,
        stroke_width=args.stroke_width,
        show_points=args.show_points,
    )
    output_path.write_text(svg, encoding="utf-8")
    print(f"Tracking gerado em: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
