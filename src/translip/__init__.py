from __future__ import annotations

from importlib import import_module
from typing import TYPE_CHECKING, Any

__all__ = ["separate_file", "SeparationRequest", "SeparationResult"]

if TYPE_CHECKING:
    from .pipeline.runner import separate_file
    from .types import SeparationRequest, SeparationResult


def __getattr__(name: str) -> Any:
    if name == "separate_file":
        return import_module(".pipeline.runner", __name__).separate_file
    if name in {"SeparationRequest", "SeparationResult"}:
        return getattr(import_module(".types", __name__), name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(set(globals()) | set(__all__))
