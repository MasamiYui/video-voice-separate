from __future__ import annotations

from .base import DiarizationBackend
from .threed_speaker import ThreeDSpeakerBackend


def create_backend() -> DiarizationBackend:
    """Instantiate the diarization backend.

    Only the CAM++ / 3D-Speaker backend is supported; the caller is
    expected to have installed the ``modelscope`` / ``funasr`` stack.  Any
    loading error surfaces as a :class:`RuntimeError` from
    :meth:`ThreeDSpeakerBackend.diarize`.
    """

    return ThreeDSpeakerBackend()
