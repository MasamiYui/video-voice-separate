from __future__ import annotations

import tempfile
from functools import lru_cache
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

SPEAKER_EMBEDDING_SAMPLE_RATE = 16_000
MIN_EMBEDDING_SEC = 1.0
ERES2NETV2_MODEL_ID = "iic/speech_eres2netv2_sv_zh-cn_16k-common"


def resolve_speaker_device(requested_device: str) -> str:
    if requested_device == "cuda":
        if not torch.cuda.is_available():
            return "cpu"
        return "cuda"
    if requested_device == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    if requested_device == "mps":
        return "cpu"
    return "cpu"


def normalize_embedding(embedding: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(embedding)
    if norm <= 1e-12:
        return embedding.astype(np.float32)
    return (embedding / norm).astype(np.float32)


def read_audio_mono(audio_path: Path) -> tuple[np.ndarray, int]:
    waveform, sample_rate = sf.read(audio_path, dtype="float32", always_2d=False)
    if waveform.ndim == 2:
        waveform = waveform.mean(axis=1)
    return waveform.astype(np.float32), sample_rate


def extract_audio_clip(
    waveform: np.ndarray,
    sample_rate: int,
    *,
    start: float,
    end: float,
) -> np.ndarray:
    start_idx = max(0, int(start * sample_rate))
    end_idx = min(len(waveform), int(end * sample_rate))
    if end_idx <= start_idx:
        return np.zeros(0, dtype=np.float32)
    return waveform[start_idx:end_idx].astype(np.float32)


def _prepare_embedding_audio(clip: np.ndarray, sample_rate: int) -> np.ndarray:
    normalized = clip.astype(np.float32)
    if sample_rate <= 0:
        return normalized
    if sample_rate != SPEAKER_EMBEDDING_SAMPLE_RATE:
        normalized = _resample_linear(normalized, sample_rate, SPEAKER_EMBEDDING_SAMPLE_RATE)
    min_samples = int(MIN_EMBEDDING_SEC * SPEAKER_EMBEDDING_SAMPLE_RATE)
    if normalized.size == 0:
        return normalized
    if normalized.size < min_samples:
        repeats = (min_samples + normalized.size - 1) // normalized.size
        normalized = np.tile(normalized, repeats)[:min_samples]
    return normalized.astype(np.float32)


def _resample_linear(waveform: np.ndarray, original_rate: int, target_rate: int) -> np.ndarray:
    if waveform.size == 0 or original_rate == target_rate:
        return waveform.astype(np.float32)
    duration_sec = waveform.size / float(original_rate)
    target_size = max(1, int(round(duration_sec * target_rate)))
    source_index = np.linspace(0.0, waveform.size - 1, num=waveform.size, dtype=np.float32)
    target_index = np.linspace(0.0, waveform.size - 1, num=target_size, dtype=np.float32)
    return np.interp(target_index, source_index, waveform).astype(np.float32)


class SpeakerEmbedder:
    """Duck-typed base class for speaker embedders."""

    name: str = "eres2netv2"
    embedding_dim: int = 192

    def encode(self, clip: np.ndarray, sample_rate: int) -> np.ndarray | None:
        raise NotImplementedError


class _Eres2NetV2Embedder(SpeakerEmbedder):
    name = "eres2netv2"
    embedding_dim = 192

    def __init__(self) -> None:
        from modelscope.pipelines import pipeline as ms_pipeline

        self._pipeline = ms_pipeline(
            task="speaker-verification",
            model=ERES2NETV2_MODEL_ID,
        )

    def encode(self, clip: np.ndarray, sample_rate: int) -> np.ndarray | None:
        if clip.size == 0:
            return None
        prepared = _prepare_embedding_audio(clip, sample_rate)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
            wav_path = Path(handle.name)
        try:
            sf.write(wav_path, prepared, SPEAKER_EMBEDDING_SAMPLE_RATE, subtype="PCM_16")
            result = self._pipeline([str(wav_path)], output_emb=True)
        finally:
            wav_path.unlink(missing_ok=True)
        if not isinstance(result, dict):
            return None
        embs = result.get("embs")
        if embs is None:
            return None
        array = np.asarray(embs, dtype=np.float32)
        if array.ndim == 2:
            array = array[0]
        if array.size == 0:
            return None
        return normalize_embedding(array)


@lru_cache(maxsize=1)
def get_speaker_embedder(requested_device: str = "auto") -> SpeakerEmbedder:
    """Return the process-wide ERes2NetV2 embedder.

    The argument is accepted for parity with historic callers that need to
    thread a device preference through the pipeline, but the ModelScope
    pipeline auto-selects CPU/GPU internally.
    """

    _ = resolve_speaker_device(requested_device)
    return _Eres2NetV2Embedder()
