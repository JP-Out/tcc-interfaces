#!/usr/bin/env python3
"""Generate visual mouse-tracking reports from an SGOA metrics JSON file.

By default, the script asks the user to choose a metrics JSON file through a
native file picker, generates one SVG per view and tries to locate a matching
screenshot inside ``tools/mouse-tracking/screenshots`` using the view name as
the file stem, for example ``participante.png`` or
``gerenciar-detalhes.png``. Generated SVGs are written to
``tools/mouse-tracking/output``.

When ``--single-output`` is used, the script falls back to the old behavior
and produces a single SVG for the whole session. In that mode, an optional
background can be supplied explicitly.
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


LOG_WIDTH = 72


def get_default_paths() -> tuple[Path, Path, Path, Path]:
    repo_root = Path(__file__).resolve().parent.parent
    assets_dir = repo_root / "tools" / "mouse-tracking"
    screenshots_dir = assets_dir / "screenshots"
    output_dir = assets_dir / "output"
    return repo_root, assets_dir, screenshots_dir, output_dir


def parse_args() -> argparse.Namespace:
    _, _, default_screenshots_dir, default_output_dir = get_default_paths()
    parser = argparse.ArgumentParser(
        description="Render mouse-tracking SVG files from an SGOA metrics JSON file.",
    )
    parser.add_argument(
        "metrics_json",
        nargs="?",
        type=Path,
        help="Path to the metrics JSON file. If omitted, a file picker is opened.",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help=(
            "Output path for single-output mode. "
            "Defaults to tools/mouse-tracking/output/<json>-tracking.svg."
        ),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=default_output_dir,
        help=(
            "Directory used for generated SVGs in per-view mode. "
            "Defaults to tools/mouse-tracking/output."
        ),
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
        "--single-output",
        action="store_true",
        help="Generate a single SVG for the whole session instead of one SVG per view.",
    )
    parser.add_argument(
        "--screenshots-dir",
        type=Path,
        default=default_screenshots_dir,
        help=(
            "Directory containing screenshots named after each view "
            "(for example participante.png). Defaults to "
            "tools/mouse-tracking/screenshots."
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


def print_log_header(title: str) -> None:
    print("=" * LOG_WIDTH)
    print(title)
    print("=" * LOG_WIDTH)


def print_log_line(label: str, value: object) -> None:
    print(f"{label:<16}: {value}")


def print_log_divider() -> None:
    print("-" * LOG_WIDTH)


def print_run_context(
    metrics_json_path: Path,
    output_dir: Path,
    mode_label: str,
    views_count: int | None = None,
) -> None:
    print_log_header("Mouse Tracking Generator")
    print_log_line("Mode", mode_label)
    print_log_line("Metrics JSON", metrics_json_path.resolve())
    print_log_line("Output dir", output_dir.resolve())
    if views_count is not None:
        print_log_line("Views found", views_count)
    print_log_divider()


def print_view_progress(
    position: int,
    total: int,
    view_metric: ViewMetrics,
    background_path: Path | None,
    output_path: Path,
) -> None:
    background_label = background_path.name if background_path else "canvas neutro"
    print(f"[{position}/{total}] View: {view_metric.name}")
    print_log_line("Points", len(view_metric.points))
    print_log_line("Clicks", len(view_metric.clicks))
    print_log_line("Background", background_label)
    print_log_line("Output file", output_path.resolve())


def print_completion_summary(output_paths: list[Path]) -> None:
    print_log_header("Generation Complete")
    print_log_line("SVG files", len(output_paths))
    if output_paths:
        print_log_line("First file", output_paths[0].resolve())
    print_log_divider()


def get_metrics_picker_start_dir(repo_root: Path, assets_dir: Path) -> Path:
    downloads_dir = Path.home() / "Downloads"

    for candidate in (downloads_dir, assets_dir, repo_root):
        if candidate.exists():
            return candidate

    return Path.cwd()


def open_metrics_file_dialog(initial_dir: Path) -> Path | None:
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError:
        return None

    root = None
    try:
        root = tk.Tk()
        root.withdraw()
        try:
            root.attributes("-topmost", True)
        except Exception:
            pass
        root.update_idletasks()
        selected_path = filedialog.askopenfilename(
            title="Selecione o arquivo JSON de metricas",
            initialdir=str(initial_dir),
            filetypes=[
                ("Arquivos JSON", "*.json"),
                ("Todos os arquivos", "*.*"),
            ],
        )
        return Path(selected_path).expanduser() if selected_path else None
    except Exception:
        return None
    finally:
        if root is not None:
            root.destroy()


def prompt_metrics_json_path(initial_dir: Path) -> Path:
    print("[fallback] Nao foi possivel abrir o seletor grafico de arquivos nesta sessao.")
    print_log_line("Suggested dir", initial_dir)
    print_log_divider()

    try:
        typed_path = input("Caminho do arquivo JSON: ").strip()
    except EOFError as error:
        raise SystemExit("Nenhum arquivo de metricas foi informado.") from error

    if not typed_path:
        raise SystemExit("Nenhum arquivo de metricas foi selecionado.")

    return Path(typed_path).expanduser()


def resolve_metrics_json_path(cli_path: Path | None, repo_root: Path, assets_dir: Path) -> Path:
    if cli_path is not None:
        return cli_path.expanduser()

    initial_dir = get_metrics_picker_start_dir(repo_root, assets_dir)
    print_log_header("Metrics File Selection")
    print(f"[select] Abrindo seletor de arquivo em: {initial_dir}")
    print_log_divider()
    selected_path = open_metrics_file_dialog(initial_dir)

    if selected_path is not None:
        return selected_path

    return prompt_metrics_json_path(initial_dir)


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8-sig") as handle:
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


def parse_click_events(raw_clicks: Iterable[list]) -> list[ClickEvent]:
    clicks: list[ClickEvent] = []

    for raw_click in raw_clicks:
        if not isinstance(raw_click, list) or len(raw_click) < 4:
            continue

        elapsed_ms, x, y, view_index = raw_click[:4]
        clicks.append(
            ClickEvent(
                elapsed_ms=int(elapsed_ms),
                x=int(x),
                y=int(y),
                view_index=int(view_index),
            ),
        )

    return clicks


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
    return build_info_panel_for_view(payload, width, height)


def build_info_panel_for_view(
    payload: dict,
    width: int,
    height: int,
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
                f"Sessão: {payload.get('sessionId', '-')}",
                f"Duração: {payload.get('durationMs', 0)} ms",
                f"Pontos do mouse: {len(points)}",
                f"Cliques com posição: {len(clicks)}",
                f"Views observadas: {', '.join(views) if views else '-'}",
            ],
        )

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


def normalize_view_file_name(view_name: str) -> str:
    allowed = {"-", "_"}
    normalized = "".join(
        character.lower()
        if character.isalnum() or character in allowed
        else "-"
        for character in view_name
    )
    return "-".join(part for part in normalized.split("-") if part)


def find_background_for_view(view_name: str, screenshots_dir: Path) -> Path | None:
    normalized = normalize_view_file_name(view_name)
    for extension in (".png", ".jpg", ".jpeg", ".webp"):
        direct_candidate = screenshots_dir / f"{view_name}{extension}"
        if direct_candidate.exists():
            return direct_candidate

        normalized_candidate = screenshots_dir / f"{normalized}{extension}"
        if normalized_candidate.exists():
            return normalized_candidate

    return None


def collect_view_metrics(payload: dict) -> list[ViewMetrics]:
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


def generate_per_view_svgs(
    payload: dict,
    metrics_json_path: Path,
    screenshots_dir: Path,
    output_dir: Path,
    stroke_width: float,
    show_points: bool,
) -> list[Path]:
    view_metrics = collect_view_metrics(payload)
    output_paths: list[Path] = []
    output_dir.mkdir(parents=True, exist_ok=True)

    if not view_metrics:
        raise SystemExit("Nenhuma tela com metricas validas foi encontrada no JSON informado.")

    print_run_context(
        metrics_json_path=metrics_json_path,
        output_dir=output_dir,
        mode_label="per-view",
        views_count=len(view_metrics),
    )

    for position, view_metric in enumerate(view_metrics, start=1):
        background_path = find_background_for_view(view_metric.name, screenshots_dir)
        background_data_uri = load_background_data_uri(background_path)
        output_path = output_dir / f"{metrics_json_path.stem}-{normalize_view_file_name(view_metric.name)}.svg"
        print_view_progress(
            position=position,
            total=len(view_metrics),
            view_metric=view_metric,
            background_path=background_path,
            output_path=output_path,
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
        print_log_line("Status", "written")
        print_log_divider()

    return output_paths


def main() -> int:
    args = parse_args()
    repo_root, assets_dir, _, default_output_dir = get_default_paths()
    metrics_json_path = resolve_metrics_json_path(args.metrics_json, repo_root, assets_dir)
    payload = load_json(metrics_json_path)
    mouse_tracking = payload.get("mouseTracking") or {}

    if not mouse_tracking.get("enabled"):
        raise SystemExit("O JSON informado não possui mouseTracking habilitado.")

    if not mouse_tracking.get("points") and not mouse_tracking.get("clickEvents"):
        raise SystemExit("O JSON não possui pontos ou cliques de mouse para renderizar.")

    if args.single_output or args.background is not None:
        background_data_uri = load_background_data_uri(args.background)
        args.output_dir.mkdir(parents=True, exist_ok=True)
        output_path = args.output or (
            args.output_dir / f"{metrics_json_path.stem}-tracking.svg"
        )

        print_run_context(
            metrics_json_path=metrics_json_path,
            output_dir=args.output_dir,
            mode_label="single-output",
        )
        print_log_line("Output file", output_path.resolve())
        print_log_divider()

        svg = generate_svg(
            payload=payload,
            background_data_uri=background_data_uri,
            stroke_width=args.stroke_width,
            show_points=args.show_points,
        )
        output_path.write_text(svg, encoding="utf-8")
        print_completion_summary([output_path])
        return 0

    output_paths = generate_per_view_svgs(
        payload=payload,
        metrics_json_path=metrics_json_path,
        screenshots_dir=args.screenshots_dir,
        output_dir=args.output_dir or default_output_dir,
        stroke_width=args.stroke_width,
        show_points=args.show_points,
    )

    print_completion_summary(output_paths)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
