from __future__ import annotations

import base64
import mimetypes
import struct
from pathlib import Path


def normalize_file_stem(value: str) -> str:
    allowed = {"-", "_"}
    normalized = "".join(
        character.lower()
        if character.isalnum() or character in allowed
        else "-"
        for character in value
    )
    return "-".join(part for part in normalized.split("-") if part)


def build_grid(width: int, height: int, *, step: int = 120) -> str:
    lines: list[str] = []

    for x in range(step, width, step):
        lines.append(
            f'<line x1="{x}" y1="0" x2="{x}" y2="{height}" '
            'stroke="rgba(15, 23, 42, 0.08)" stroke-width="1" />',
        )

    for y in range(step, height, step):
        lines.append(
            f'<line x1="0" y1="{y}" x2="{width}" y2="{y}" '
            'stroke="rgba(15, 23, 42, 0.08)" stroke-width="1" />',
        )

    return "\n".join(lines)


def load_background_data_uri(path: Path | None) -> str | None:
    if path is None:
        return None

    mime_type, _ = mimetypes.guess_type(path.name)
    mime_type = mime_type or "image/png"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def resolve_screenshot_path(
    screenshots_dir: Path,
    view_name: str,
    *,
    ui_version: str | None = None,
) -> Path | None:
    normalized_view_name = normalize_file_stem(view_name)
    candidate_dirs: list[Path] = []

    if ui_version:
        candidate_dirs.append(screenshots_dir / ui_version)

    candidate_dirs.append(screenshots_dir / "common")

    for candidate_dir in candidate_dirs:
        for extension in (".png", ".jpg", ".jpeg", ".webp"):
            direct_candidate = candidate_dir / f"{view_name}{extension}"
            if direct_candidate.exists():
                return direct_candidate

            normalized_candidate = candidate_dir / f"{normalized_view_name}{extension}"
            if normalized_candidate.exists():
                return normalized_candidate

    return None


def get_image_size(path: Path | None) -> tuple[int, int] | None:
    if path is None or not path.exists():
        return None

    if path.suffix.lower() == ".png":
        return _read_png_size(path)

    return None


def _read_png_size(path: Path) -> tuple[int, int] | None:
    data = path.read_bytes()

    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return None

    width, height = struct.unpack(">II", data[16:24])
    if width <= 0 or height <= 0:
        return None

    return width, height
