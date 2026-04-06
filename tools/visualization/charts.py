from __future__ import annotations

from html import escape
from pathlib import Path
from typing import Any

from visualization.svg_utils import normalize_file_stem


METRIC_LABELS = {
    "total_session_time_ms": "Tempo total da sessao",
    "avg_objective_time_ms": "Tempo medio por objetivo",
    "objective_completion_rate": "Taxa de conclusao de objetivos",
    "abandonment_rate": "Taxa de desistencia",
    "error_count": "Numero de erros",
    "click_count": "Numero de cliques",
    "clicks_per_completed_objective": "Cliques por objetivo concluido",
    "unique_screens_visited": "Telas unicas visitadas",
    "navigation_revisits": "Revisitas de navegacao",
    "avg_time_per_screen_ms": "Tempo medio por tela",
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
    v1_mean = _coerce_float(row.get("v1_mean"))
    v2_mean = _coerce_float(row.get("v2_mean"))
    diff = _coerce_float(row.get("difference_v2_minus_v1"))
    width = 760
    height = 440
    chart_top = 120
    chart_bottom = 340
    chart_height = chart_bottom - chart_top
    bar_width = 120
    bars = [
        ("v1", v1_mean, 180, "#64748b", int(row.get("v1_n") or 0)),
        ("v2", v2_mean, 460, "#0f766e", int(row.get("v2_n") or 0)),
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
                f"{label.upper()}</text>",
                f'<text x="{x + (bar_width / 2)}" y="{chart_bottom + 58}" fill="#475569" '
                'font-family="Arial, sans-serif" font-size="13" text-anchor="middle">'
                f"n = {sample_size}</text>",
                f'<rect x="{x}" y="{y:.2f}" width="{bar_width}" height="{bar_height:.2f}" '
                f'rx="18" fill="{color}" opacity="0.92" />'
                if value is not None
                else f'<rect x="{x}" y="{chart_bottom - 12}" width="{bar_width}" height="12" '
                'rx="6" fill="#cbd5e1" opacity="0.8" />',
                f'<text x="{x + (bar_width / 2)}" y="{max(y - 16, chart_top - 8):.2f}" fill="#0f172a" '
                'font-family="Arial, sans-serif" font-size="14" font-weight="700" '
                'text-anchor="middle">'
                f"{escape(value_label)}</text>",
            ],
        )

    diff_label = (
        f"Diferenca v2 - v1: {_format_metric_value(metric, diff)}"
        if diff is not None
        else "Diferenca v2 - v1: indisponivel"
    )

    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}">',
            f'<rect x="0" y="0" width="{width}" height="{height}" fill="#f8fafc" />',
            f'<rect x="24" y="24" width="{width - 48}" height="{height - 48}" rx="28" '
            'fill="#ffffff" stroke="rgba(15,23,42,0.10)" stroke-width="1.5" />',
            f'<text x="48" y="68" fill="#0f172a" font-family="Arial, sans-serif" '
            'font-size="28" font-weight="700">'
            f"{escape(title)}</text>",
            f'<text x="48" y="94" fill="#475569" font-family="Arial, sans-serif" font-size="14">'
            f"{escape(diff_label)}</text>",
            f'<line x1="90" y1="{chart_bottom}" x2="{width - 90}" y2="{chart_bottom}" '
            'stroke="#cbd5e1" stroke-width="2" />',
            f'<line x1="90" y1="{chart_top}" x2="90" y2="{chart_bottom}" '
            'stroke="#e2e8f0" stroke-width="2" />',
            f'<text x="80" y="{chart_top + 4}" fill="#64748b" font-family="Arial, sans-serif" '
            f'font-size="13" text-anchor="end">{escape(_format_metric_value(metric, max_value))}</text>',
            *bar_elements,
            "</svg>",
        ],
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
        return f"{value * 100:.1f}%"

    if metric.endswith("_ms"):
        if value >= 1000:
            return f"{value / 1000:.2f} s"
        return f"{value:.0f} ms"

    rounded = round(value, 2)
    if abs(rounded - round(rounded)) < 0.01:
        return str(int(round(rounded)))

    return f"{rounded:.2f}"
