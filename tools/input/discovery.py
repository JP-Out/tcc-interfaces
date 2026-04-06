from __future__ import annotations

from pathlib import Path
from typing import Iterable


def discover_json_files(
    raw_inputs: Iterable[str | Path],
    *,
    recursive: bool = False,
) -> tuple[list[Path], list[str]]:
    files: list[Path] = []
    warnings: list[str] = []
    seen: set[Path] = set()

    for raw_input in raw_inputs:
        candidate = Path(raw_input).expanduser()

        if not candidate.exists():
            warnings.append(f"Entrada nao encontrada: {candidate}")
            continue

        if candidate.is_file():
            if candidate.suffix.lower() != ".json":
                warnings.append(f"Arquivo ignorado por nao ser JSON: {candidate}")
                continue

            resolved = candidate.resolve()
            if resolved not in seen:
                seen.add(resolved)
                files.append(candidate)
            continue

        pattern = "**/*.json" if recursive else "*.json"
        for json_path in sorted(candidate.glob(pattern)):
            if not json_path.is_file():
                continue

            resolved = json_path.resolve()
            if resolved in seen:
                continue

            seen.add(resolved)
            files.append(json_path)

    return sorted(files, key=lambda path: (path.name.lower(), str(path))), warnings
