from __future__ import annotations

from .base import DiarizationBackend, DiarizationResult, DiarizedTurn
from .factory import create_backend
from .projection import (
    assign_turns_to_segments,
    refine_with_change_detection,
    refine_with_min_turn,
    refine_with_neighbor_merge,
    refine_with_voice_voting,
)

__all__ = [
    "DiarizationBackend",
    "DiarizationResult",
    "DiarizedTurn",
    "assign_turns_to_segments",
    "create_backend",
    "refine_with_change_detection",
    "refine_with_min_turn",
    "refine_with_neighbor_merge",
    "refine_with_voice_voting",
]
