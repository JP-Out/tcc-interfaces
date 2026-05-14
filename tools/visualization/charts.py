from __future__ import annotations

from html import escape
from pathlib import Path
from typing import Any

from analysis_labels import get_interface_label
from visualization.svg_utils import normalize_file_stem


INTERFACE_A_COLOR = "#b42121"
INTERFACE_B_COLOR = "#093a7b"
CHART_BACKGROUND_COLOR = "#fffcec"
AXIS_COLOR = "#4b5f77"
AXIS_DETAIL_COLOR = "#26384d"
BAR_TOP_RADIUS = 10

METRIC_LABELS = {
    "total_session_time_ms": "Tempo total da sessão",
    "avg_objective_time_ms": "Tempo médio por objetivo",
    "objective_completion_rate": "Taxa de conclusão de objetivos",
    "abandonment_rate": "Taxa de desistência",
    "error_count": "Número de erros",
    "click_count": "Número de cliques",
    "clicks_per_completed_objective": "Cliques por objetivo concluído",
    "unique_screens_visited": "Telas únicas visitadas",
    "navigation_revisits": "Revisitas de navegação",
    "avg_time_per_screen_ms": "Tempo médio por tela",
}


def write_metric_charts(
    comparison_rows: list[dict[str, Any]],
    *,
    output_dir: Path,
) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_paths: list[Path] = []

    for row in comparison_rows:
        metric = str(row.get("metric") or "metric")
        output_path = output_dir / f"{normalize_file_stem(metric)}.svg"
        output_path.write_text(render_metric_chart(row), encoding="utf-8")
        output_paths.append(output_path)

    return output_paths


def render_metric_chart(row: dict[str, Any]) -> str:
    metric = str(row.get("metric") or "metric")
    title = METRIC_LABELS.get(metric, metric.replace("_", " ").title())
    interface_a_mean = _coerce_float(row.get("interface_a_mean"))
    interface_b_mean = _coerce_float(row.get("interface_b_mean"))
    diff = _coerce_float(row.get("difference_interface_b_minus_a"))
    width = 760
    height = 440
    chart_top = 120
    chart_bottom = 340
    chart_height = chart_bottom - chart_top
    bar_width = 120
    bars = [
        (get_interface_label("v1"), interface_a_mean, 180, INTERFACE_A_COLOR, int(row.get("interface_a_n") or 0)),
        (get_interface_label("v2"), interface_b_mean, 460, INTERFACE_B_COLOR, int(row.get("interface_b_n") or 0)),
    ]
    existing_values = [value for _, value, _, _, _ in bars if value is not None]
    max_value = max(existing_values) if existing_values else 1.0
    max_value = max(max_value, 1.0)

    bar_elements: list[str] = []
    for label, value, x, color, sample_size in bars:
        bar_height = 0 if value is None else (value / max_value) * chart_height
        y = chart_bottom - bar_height
        value_label = _format_metric_value(metric, value)
        bar_elements.extend(
            [
                f'<text x="{x + (bar_width / 2)}" y="{chart_bottom + 34}" fill="#0f172a" '
                'font-family="Arial, sans-serif" font-size="16" font-weight="700" '
                'text-anchor="middle">'
                f"{escape(label)}</text>",
                f'<text x="{x + (bar_width / 2)}" y="{chart_bottom + 58}" fill="#475569" '
                'font-family="Arial, sans-serif" font-size="13" text-anchor="middle">'
                f"n = {sample_size}</text>",
                _render_top_rounded_bar(
                    x=x,
                    y=y,
                    width=bar_width,
                    height=bar_height,
                    radius=BAR_TOP_RADIUS,
                    color=color,
                    opacity=0.92,
                )
                if value is not None
                else _render_top_rounded_bar(
                    x=x,
                    y=chart_bottom - 12,
                    width=bar_width,
                    height=12,
                    radius=6,
                    color="#cbd5e1",
                    opacity=0.8,
                ),
                f'<text x="{x + (bar_width / 2)}" y="{max(y - 16, chart_top - 8):.2f}" fill="#0f172a" '
                'font-family="Arial, sans-serif" font-size="14" font-weight="700" '
                'text-anchor="middle">'
                f"{escape(value_label)}</text>",
            ],
        )

    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}">',
            f'<rect x="0" y="0" width="{width}" height="{height}" rx="28" fill="{CHART_BACKGROUND_COLOR}" />',
            f'<text x="48" y="68" fill="#0f172a" font-family="Arial, sans-serif" '
            'font-size="28" font-weight="700">'
            f"{escape(title)}</text>",
            _render_difference_label(metric, diff, x=48, y=94),
            _render_axes(
                x=90,
                y_top=chart_top,
                y_bottom=chart_bottom,
                x_end=width - 90,
            ),
            f'<text x="80" y="{chart_top + 4}" fill="{AXIS_COLOR}" font-family="Arial, sans-serif" '
            f'font-size="13" text-anchor="end">{escape(_format_metric_value(metric, max_value))}</text>',
            *bar_elements,
            "</svg>",
        ],
    )


def _render_axes(*, x: int, y_top: int, y_bottom: int, x_end: int) -> str:
    return "\n".join(
        [
            f'<line x1="{x}" y1="{y_bottom}" x2="{x_end}" y2="{y_bottom}" '
            f'stroke="{AXIS_COLOR}" stroke-width="2.5" stroke-linecap="round" />',
            f'<line x1="{x}" y1="{y_top}" x2="{x}" y2="{y_bottom}" '
            f'stroke="{AXIS_COLOR}" stroke-width="2.5" stroke-linecap="round" />',
            f'<circle cx="{x}" cy="{y_bottom}" r="4.5" fill="{CHART_BACKGROUND_COLOR}" '
            f'stroke="{AXIS_DETAIL_COLOR}" stroke-width="2.2" />',
            f'<circle cx="{x_end}" cy="{y_bottom}" r="4" fill="{AXIS_DETAIL_COLOR}" />',
            f'<circle cx="{x}" cy="{y_top}" r="4" fill="{AXIS_DETAIL_COLOR}" />',
        ],
    )


def _render_top_rounded_bar(
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    radius: float,
    color: str,
    opacity: float,
) -> str:
    if height <= 0:
        return (
            f'<rect x="{x}" y="{y:.2f}" width="{width}" height="0" '
            f'fill="{color}" opacity="{opacity}" />'
        )

    bottom = y + height
    right = x + width
    adjusted_radius = min(radius, width / 2, height)

    path = " ".join(
        [
            f"M {x:.2f} {bottom:.2f}",
            f"L {x:.2f} {y + adjusted_radius:.2f}",
            f"Q {x:.2f} {y:.2f} {x + adjusted_radius:.2f} {y:.2f}",
            f"L {right - adjusted_radius:.2f} {y:.2f}",
            f"Q {right:.2f} {y:.2f} {right:.2f} {y + adjusted_radius:.2f}",
            f"L {right:.2f} {bottom:.2f}",
            "Z",
        ],
    )

    return f'<path d="{path}" fill="{color}" opacity="{opacity}" />'


def _render_difference_label(metric: str, diff: float | None, *, x: int, y: int) -> str:
    value = _format_metric_value(metric, diff) if diff is not None else "indisponível"

    return (
        f'<text x="{x}" y="{y}" fill="#475569" font-family="Arial, sans-serif" font-size="14">'
        '<tspan>Diferença (</tspan>'
        f'<tspan fill="{INTERFACE_B_COLOR}" font-weight="700">Interface B</tspan>'
        '<tspan> - </tspan>'
        f'<tspan fill="{INTERFACE_A_COLOR}" font-weight="700">Interface A</tspan>'
        '<tspan>): </tspan>'
        f'<tspan fill="#0f172a" font-weight="700">{escape(value)}</tspan>'
        "</text>"
    )


def _coerce_float(value: Any) -> float | None:
    if value in (None, ""):
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _format_metric_value(metric: str, value: float | None) -> str:
    if value is None:
        return "n/d"

    if metric.endswith("_rate"):
        return f"{_format_decimal(value * 100, 1)}%"

    if metric.endswith("_ms"):
        if abs(value) >= 1000:
            return f"{_format_decimal(value / 1000, 2)} s"
        return f"{value:.0f} ms"

    rounded = round(value, 2)
    if abs(rounded - round(rounded)) < 0.01:
        return str(int(round(rounded)))

    return _format_decimal(rounded, 2)


def _format_decimal(value: float, decimal_places: int) -> str:
    return f"{value:.{decimal_places}f}".replace(".", ",")
