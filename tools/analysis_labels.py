from __future__ import annotations


INTERFACE_LABELS = {
    "v1": "Interface A",
    "v2": "Interface B",
}

INTERFACE_SLUGS = {
    "v1": "interface-a",
    "v2": "interface-b",
}


def get_interface_label(ui_version: str | None) -> str:
    normalized = str(ui_version or "").strip().lower()
    return INTERFACE_LABELS.get(normalized, normalized or "Interface desconhecida")


def get_interface_slug(ui_version: str | None) -> str:
    normalized = str(ui_version or "").strip().lower()
    return INTERFACE_SLUGS.get(normalized, normalized or "interface-desconhecida")
