#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from typing import Any

from input.discovery import discover_json_files
from input.readers import load_session_sources
from processing.aggregation import COMPARISON_FIELDNAMES, aggregate_version_metrics
from processing.session_metrics import SESSION_METRIC_FIELDNAMES, compute_session_metrics
from reports.csv_export import write_csv
from visualization.charts import write_metric_charts
from visualization.heatmaps import generate_heatmaps
from visualization.mouse_tracking import generate_mouse_tracking_outputs


ALL_SECTIONS = ["sessions", "comparison", "charts", "mouse", "heatmaps"]


def parse_args() -> argparse.Namespace:
    tools_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description="Processa um ou varios JSONs de metricas da pesquisa de usabilidade.",
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        help="Arquivos JSON ou pastas contendo JSONs.",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Busca JSONs em subpastas quando a entrada for um diretorio.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Diretorio raiz de saida. Por padrao cria uma pasta nova em tools/output.",
    )
    parser.add_argument(
        "--screenshots-dir",
        type=Path,
        default=tools_dir / "assets" / "screenshots",
        help="Diretorio base das screenshots usadas em mouse tracking e heatmaps.",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        choices=ALL_SECTIONS,
        default=ALL_SECTIONS,
        help="Escolhe quais saídas gerar.",
    )
    parser.add_argument(
        "--heatmap-scope",
        choices=("version", "session", "both"),
        default="version",
        help="Escopo dos heatmaps de clique.",
    )
    parser.add_argument(
        "--show-points",
        action="store_true",
        help="Mostra tambem os pontos individuais no SVG de mouse tracking.",
    )
    parser.add_argument(
        "--mouse-single-output",
        action="store_true",
        help="Gera um unico SVG por sessao para mouse tracking.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    discovered_paths, discovery_warnings = discover_json_files(
        args.inputs,
        recursive=args.recursive,
    )

    for warning in discovery_warnings:
        print(f"[warn] {warning}")

    if not discovered_paths:
        raise SystemExit("Nenhum arquivo JSON valido foi encontrado nas entradas informadas.")

    session_sources, load_warnings = load_session_sources(discovered_paths)
    for warning in load_warnings:
        print(f"[warn] {warning}")

    if not session_sources:
        raise SystemExit("Nenhuma sessao valida foi carregada.")

    output_dir = build_output_dir(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"[run] Sessoes carregadas: {len(session_sources)}")
    print(f"[run] Pasta de saida: {output_dir.resolve()}")

    session_rows = [compute_session_metrics(session_source) for session_source in session_sources]
    comparison_rows = aggregate_version_metrics(session_rows)
    selected_sections = set(args.only)

    if "sessions" in selected_sections:
        session_csv_path = output_dir / "csv" / "session_metrics.csv"
        write_csv(session_csv_path, session_rows, SESSION_METRIC_FIELDNAMES)
        print(f"[ok] CSV por sessao: {session_csv_path.resolve()}")

    if "comparison" in selected_sections:
        comparison_csv_path = output_dir / "csv" / "version_comparison.csv"
        write_csv(comparison_csv_path, comparison_rows, COMPARISON_FIELDNAMES)
        print(f"[ok] CSV comparativo: {comparison_csv_path.resolve()}")

    if "charts" in selected_sections:
        chart_paths = write_metric_charts(comparison_rows, output_dir=output_dir / "charts")
        print(f"[ok] Graficos SVG gerados: {len(chart_paths)}")

    if "mouse" in selected_sections:
        mouse_paths = generate_all_mouse_tracking_outputs(
            session_sources,
            output_dir=output_dir / "mouse-tracking",
            screenshots_dir=args.screenshots_dir.expanduser(),
            show_points=args.show_points,
            single_output=args.mouse_single_output,
        )
        print(f"[ok] SVGs de mouse tracking gerados: {len(mouse_paths)}")

    if "heatmaps" in selected_sections:
        heatmap_paths = generate_heatmaps(
            session_sources,
            output_dir=output_dir / "heatmaps",
            screenshots_dir=args.screenshots_dir.expanduser(),
            scope=args.heatmap_scope,
        )
        print(f"[ok] Heatmaps SVG gerados: {len(heatmap_paths)}")

    return 0


def build_output_dir(cli_output_dir: Path | None) -> Path:
    if cli_output_dir is not None:
        return cli_output_dir.expanduser()

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    return Path(__file__).resolve().parent / "output" / f"{timestamp}-metrics-analysis"


def generate_all_mouse_tracking_outputs(
    session_sources: list[Any],
    *,
    output_dir: Path,
    screenshots_dir: Path,
    show_points: bool,
    single_output: bool,
) -> list[Path]:
    output_paths: list[Path] = []

    for session_source in session_sources:
        session_output_dir = output_dir / session_source.session_stem
        output_paths.extend(
            generate_mouse_tracking_outputs(
                session_source,
                output_dir=session_output_dir,
                screenshots_dir=screenshots_dir,
                show_points=show_points,
                single_output=single_output,
            ),
        )

    return output_paths


if __name__ == "__main__":
    raise SystemExit(main())
