from __future__ import annotations

import csv
from pathlib import Path
from typing import Any


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()

        for row in rows:
            writer.writerow(
                {
                    fieldname: _format_csv_value(row.get(fieldname))
                    for fieldname in fieldnames
                },
            )


def _format_csv_value(value: Any) -> Any:
    if value is None:
        return ""

    if isinstance(value, float):
        formatted = f"{value:.6f}".rstrip("0").rstrip(".")
        return formatted or "0"

    return value
