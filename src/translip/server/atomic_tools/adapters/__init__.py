from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Callable


ProgressCallback = Callable[[float, str | None], None]


class ToolAdapter(ABC):
    @abstractmethod
    def validate_params(self, params: dict) -> dict:
        raise NotImplementedError

    @abstractmethod
    def run(
        self,
        params: dict,
        input_dir: Path,
        output_dir: Path,
        on_progress: ProgressCallback,
    ) -> dict[str, Any]:
        raise NotImplementedError

    @staticmethod
    def first_input(input_dir: Path, stem: str | None = None) -> Path:
        base_dir = input_dir / stem if stem else input_dir
        return next(path for path in base_dir.rglob("*") if path.is_file())


from .separation import SeparationAdapter  # noqa: E402,F401
from .mixing import MixingAdapter  # noqa: E402,F401
from .transcription import TranscriptionAdapter  # noqa: E402,F401
from .translation import TranslationAdapter  # noqa: E402,F401
from .tts import TtsAdapter  # noqa: E402,F401
from .probe import ProbeAdapter  # noqa: E402,F401
from .muxing import MuxingAdapter  # noqa: E402,F401
