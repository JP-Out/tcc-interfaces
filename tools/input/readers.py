from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


UI_VERSION_PATTERN = re.compile(r"metrics-(v\d+)-", re.IGNORECASE)


@dataclass(frozen=True)
class SessionSource:
    source_path: Path
    payload: dict[str, Any]

    @property
    def session_stem(self) -> str:
        return self.source_path.stem

    @property
    def ui_version(self) -> str:
        return infer_ui_version(self.payload, self.source_path)


def read_json_file(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8-sig") as handle:
        loaded = json.load(handle)

    if not isinstance(loaded, dict):
        raise ValueError("O arquivo JSON precisa conter um objeto na raiz.")

    return loaded


def load_session_sources(paths: list[Path]) -> tuple[list[SessionSource], list[str]]:
    session_sources: list[SessionSource] = []
    warnings: list[str] = []

    for path in paths:
        try:
            payload = read_json_file(path)
        except Exception as error:  # noqa: BLE001 - surface warnings and continue.
            warnings.append(f"Falha ao ler {path}: {error}")
            continue

        session_sources.append(SessionSource(source_path=path, payload=payload))

    return session_sources, warnings


def infer_ui_version(payload: dict[str, Any], source_path: Path) -> str:
    raw_ui_version = payload.get("uiVersion")

    if isinstance(raw_ui_version, str) and raw_ui_version.strip():
        return raw_ui_version.strip().lower()

    match = UI_VERSION_PATTERN.search(source_path.name)
    if match:
        return match.group(1).lower()

    return "unknown"
