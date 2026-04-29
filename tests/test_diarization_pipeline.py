from __future__ import annotations

import importlib

import numpy as np
import pytest

from translip.transcription.asr import AsrSegment
from translip.transcription.diarization import (
    DiarizedTurn,
    assign_turns_to_segments,
    create_backend,
    refine_with_change_detection,
    refine_with_min_turn,
    refine_with_neighbor_merge,
    refine_with_voice_voting,
)
from translip.transcription.diarization.threed_speaker import (
    ThreeDSpeakerBackend,
    _coerce_speaker,
    _ensure_mono_16k_wav,
    _extract_segments,
    _normalize_dict_segments,
    _normalize_triples,
)


def _segment(segment_id: str, start: float, end: float, text: str = "hi") -> AsrSegment:
    return AsrSegment(
        segment_id=segment_id,
        start=start,
        end=end,
        text=text,
        language="zh",
    )


def test_assign_turns_to_segments_prefers_largest_overlap() -> None:
    segments = [
        _segment("seg-0001", 0.0, 2.0),
        _segment("seg-0002", 2.0, 4.0),
    ]
    turns = [
        DiarizedTurn(start=0.0, end=1.9, speaker_id=0),
        DiarizedTurn(start=1.9, end=4.0, speaker_id=1),
    ]
    outcome = assign_turns_to_segments(segments, turns)
    assert outcome.segment_speaker_ids == [0, 1]
    assert outcome.stats["split_segment_count"] == 0
    assert outcome.stats["fallback_segment_count"] == 0


def test_assign_turns_to_segments_splits_long_multi_speaker_segment() -> None:
    segments = [_segment("seg-0001", 0.0, 12.0, text="long dialogue")]
    turns = [
        DiarizedTurn(start=0.0, end=5.0, speaker_id=0),
        DiarizedTurn(start=5.0, end=12.0, speaker_id=1),
    ]
    outcome = assign_turns_to_segments(segments, turns, long_segment_split_sec=10.0)
    assert outcome.stats["split_segment_count"] == 1
    assert len(outcome.segments) >= 2
    assert outcome.segment_speaker_ids[0] == 0
    assert outcome.segment_speaker_ids[-1] == 1
    assert outcome.segments[0].segment_id.startswith("seg-0001-")


def test_assign_turns_to_segments_fallback_when_no_turn_overlaps() -> None:
    segments = [_segment("seg-0001", 0.0, 2.0)]
    turns = [DiarizedTurn(start=5.0, end=6.0, speaker_id=7)]
    outcome = assign_turns_to_segments(segments, turns)
    assert outcome.segment_speaker_ids == [7]
    assert outcome.stats["fallback_segment_count"] == 1


def test_refine_with_change_detection_smooths_short_sandwich() -> None:
    segments = [
        _segment("seg-0001", 0.0, 1.0),
        _segment("seg-0002", 1.0, 2.0),
        _segment("seg-0003", 2.0, 3.0),
    ]
    turns = [
        DiarizedTurn(start=0.0, end=1.0, speaker_id=0),
        DiarizedTurn(start=1.0, end=2.0, speaker_id=1),
        DiarizedTurn(start=2.0, end=3.0, speaker_id=0),
    ]
    outcome = assign_turns_to_segments(segments, turns)
    outcome = refine_with_change_detection(outcome)
    assert outcome.segment_speaker_ids == [0, 0, 0]


def test_refine_leaves_long_middle_segment_untouched() -> None:
    segments = [
        _segment("seg-0001", 0.0, 1.0),
        _segment("seg-0002", 1.0, 5.0),
        _segment("seg-0003", 5.0, 6.0),
    ]
    turns = [
        DiarizedTurn(start=0.0, end=1.0, speaker_id=0),
        DiarizedTurn(start=1.0, end=5.0, speaker_id=1),
        DiarizedTurn(start=5.0, end=6.0, speaker_id=0),
    ]
    outcome = assign_turns_to_segments(segments, turns)
    outcome = refine_with_change_detection(outcome)
    assert outcome.segment_speaker_ids == [0, 1, 0]


def test_create_backend_returns_threed_speaker() -> None:
    backend = create_backend()
    assert isinstance(backend, ThreeDSpeakerBackend)
    assert backend.name == "threed_speaker"


def test_threed_speaker_normalizers() -> None:
    triples = _normalize_triples([[0.1, 0.5, 0], (0.5, 1.0, "spk_1"), "bad"])
    assert triples == [(0.1, 0.5, 0), (0.5, 1.0, 1)]
    dicts = _normalize_dict_segments(
        [
            {"start": 0.0, "end": 1.0, "speaker": "spk_2"},
            {"begin": 1.0, "end": 2.0, "speaker": 3},
            "not-a-dict",
        ]
    )
    assert dicts == [(0.0, 1.0, 2), (1.0, 2.0, 3)]
    assert _extract_segments({"segments": [{"start": 0, "end": 1, "speaker": 0}]}) == [
        (0.0, 1.0, 0)
    ]
    assert _extract_segments({"text": [[0.0, 1.0, 1]]}) == [(0.0, 1.0, 1)]
    assert _extract_segments("bogus") == []
    assert _coerce_speaker("SPEAKER_07") == 7
    assert _coerce_speaker(True) == 1
    assert _coerce_speaker(None) == 0
    # Regression: modelscope returns numpy scalar types; ``_coerce_speaker``
    # must not silently collapse them to zero.  Missing this broke CAM++
    # integration by turning every turn into SPEAKER_00.
    assert _coerce_speaker(np.int64(5)) == 5
    assert _coerce_speaker(np.int32(2)) == 2
    assert _coerce_speaker(np.float64(3.0)) == 3
    assert _normalize_triples([[np.float64(1.0), np.float64(2.0), np.int64(4)]]) == [
        (1.0, 2.0, 4)
    ]


def test_projection_handles_no_turns_gracefully() -> None:
    segments = [_segment("seg-0001", 0.0, 1.0)]
    outcome = assign_turns_to_segments(segments, [])
    assert outcome.segment_speaker_ids == [0]
    assert outcome.stats["fallback_segment_count"] == 1


def test_projection_preserves_input_for_short_multi_speaker_segment() -> None:
    segments = [_segment("seg-0001", 0.0, 4.0)]
    turns = [
        DiarizedTurn(start=0.0, end=2.0, speaker_id=0),
        DiarizedTurn(start=2.0, end=4.0, speaker_id=1),
    ]
    # Short segment should not be split.
    outcome = assign_turns_to_segments(segments, turns, long_segment_split_sec=10.0)
    assert outcome.stats["split_segment_count"] == 0
    assert len(outcome.segments) == 1
    # Speaker should match whichever turn overlaps the most.
    assert outcome.segment_speaker_ids[0] in {0, 1}


def test_assign_speaker_labels_empty_segments() -> None:
    from pathlib import Path

    from translip.transcription.speaker import assign_speaker_labels

    labels, meta = assign_speaker_labels(
        Path("/tmp/does-not-matter.wav"), [], requested_device="cpu"
    )
    assert labels == []
    assert meta["speaker_count"] == 0
    assert meta["diarization_backend"] == "threed_speaker"


def test_ensure_mono_16k_wav_returns_valid_wav(tmp_path) -> None:
    """The ffmpeg-based resampler must yield a 16 kHz mono WAV readable by
    soundfile so CAM++ does not re-enter torchaudio's missing ``sox_effects``.
    """

    import soundfile as sf

    src = tmp_path / "src.wav"
    sample_rate = 22050
    duration_sec = 0.5
    audio = np.zeros(int(sample_rate * duration_sec), dtype=np.float32)
    sf.write(src, audio, sample_rate)

    out = _ensure_mono_16k_wav(src)
    assert out.exists()
    assert out.suffix == ".wav"
    data, sr = sf.read(out)
    assert sr == 16000
    assert data.ndim == 1
    if out != src:
        out.unlink(missing_ok=True)


def test_ensure_mono_16k_wav_handles_missing_ffmpeg(monkeypatch, tmp_path) -> None:
    src = tmp_path / "src.wav"
    src.write_bytes(b"not-a-wav")
    monkeypatch.setattr(
        "translip.transcription.diarization.threed_speaker.shutil.which",
        lambda _cmd: None,
    )
    out = _ensure_mono_16k_wav(src)
    assert out == src  # falls back gracefully without raising


@pytest.mark.skipif(
    importlib.util.find_spec("modelscope") is None,
    reason="modelscope not installed; skipping live CAM++ integration probe",
)
def test_threed_speaker_can_instantiate_pipeline() -> None:
    """Integration guard: when modelscope is available, ``_ensure_pipeline``
    must successfully load the CAM++ pipeline without raising.

    This does not run diarization (no audio fixture ≥30 s in tests/), but it
    ensures the optional dependency + pipeline id combination stays healthy.
    """

    backend = ThreeDSpeakerBackend()
    backend._ensure_pipeline()
    assert backend._pipeline is not None


def test_refine_with_neighbor_merge_counts_adjacent_same_speaker() -> None:
    segments = [
        _segment("seg-0001", 0.0, 1.0),
        _segment("seg-0002", 1.05, 2.0),
        _segment("seg-0003", 2.1, 3.0),
        _segment("seg-0004", 4.0, 5.0),
    ]
    turns = [
        DiarizedTurn(start=0.0, end=3.0, speaker_id=0),
        DiarizedTurn(start=4.0, end=5.0, speaker_id=1),
    ]
    outcome = assign_turns_to_segments(segments, turns)
    outcome = refine_with_neighbor_merge(outcome, max_gap_sec=0.3)
    assert outcome.stats["neighbor_merge_candidates"] == 2
    assert outcome.stats["speaker_run_count"] == 2
    assert outcome.stats["max_run_length"] == 3
    assert outcome.segment_speaker_ids == [0, 0, 0, 1]


def test_refine_with_min_turn_absorbs_short_sandwich() -> None:
    segments = [
        _segment("seg-0001", 0.0, 2.0),
        _segment("seg-0002", 2.0, 2.4),
        _segment("seg-0003", 2.4, 4.5),
    ]
    turns = [
        DiarizedTurn(start=0.0, end=2.0, speaker_id=0),
        DiarizedTurn(start=2.0, end=2.4, speaker_id=1),
        DiarizedTurn(start=2.4, end=4.5, speaker_id=0),
    ]
    outcome = assign_turns_to_segments(segments, turns)
    outcome = refine_with_min_turn(outcome, min_turn_sec=0.8)
    assert outcome.segment_speaker_ids == [0, 0, 0]
    assert outcome.stats["min_turn_absorbed"] == 1


def test_refine_with_min_turn_folds_into_longer_neighbour() -> None:
    segments = [
        _segment("seg-0001", 0.0, 3.0),
        _segment("seg-0002", 3.0, 3.3),
        _segment("seg-0003", 3.3, 4.0),
    ]
    turns = [
        DiarizedTurn(start=0.0, end=3.0, speaker_id=0),
        DiarizedTurn(start=3.0, end=3.3, speaker_id=1),
        DiarizedTurn(start=3.3, end=4.0, speaker_id=2),
    ]
    outcome = assign_turns_to_segments(segments, turns)
    outcome = refine_with_min_turn(outcome, min_turn_sec=0.8)
    # Middle 0.3s island should fold into the longer neighbour (speaker 0).
    assert outcome.segment_speaker_ids == [0, 0, 2]
    assert outcome.stats["min_turn_absorbed"] == 1


def test_refine_with_voice_voting_reassigns_low_similarity(tmp_path) -> None:
    import soundfile as sf

    sample_rate = 16_000
    duration_sec = 0.5
    waveform = np.zeros(int(sample_rate * duration_sec * 5), dtype=np.float32)
    audio_path = tmp_path / "voting.wav"
    sf.write(audio_path, waveform, sample_rate, subtype="PCM_16")

    segments = [
        _segment("seg-0001", 0.0, 0.5),
        _segment("seg-0002", 0.5, 1.0),
        _segment("seg-0003", 1.0, 1.5),
        _segment("seg-0004", 1.5, 2.0),
        _segment("seg-0005", 2.0, 2.5),
    ]
    turns = [
        DiarizedTurn(start=0.0, end=0.5, speaker_id=0),
        DiarizedTurn(start=0.5, end=1.0, speaker_id=0),
        DiarizedTurn(start=1.0, end=1.5, speaker_id=1),
        DiarizedTurn(start=1.5, end=2.0, speaker_id=1),
        DiarizedTurn(start=2.0, end=2.5, speaker_id=1),
    ]
    outcome = assign_turns_to_segments(segments, turns)

    speaker_zero = np.array([1.0, 0.0], dtype=np.float32)
    speaker_one = np.array([0.0, 1.0], dtype=np.float32)
    # Seg-0003 is labelled as speaker 1 but actually resembles speaker 0.
    ordered_embeddings = [
        speaker_zero,
        speaker_zero,
        speaker_zero,
        speaker_one,
        speaker_one,
    ]

    class _StubEmbedder:
        def __init__(self) -> None:
            self._index = 0

        def encode(self, clip: np.ndarray, sr: int) -> np.ndarray:
            embedding = ordered_embeddings[self._index]
            self._index += 1
            return embedding.astype(np.float32)

    outcome = refine_with_voice_voting(
        outcome,
        audio_path=audio_path,
        embedder=_StubEmbedder(),
        low_conf_threshold=0.5,
        reassign_threshold=0.8,
    )
    assert outcome.stats["voice_voting_reassigned"] == 1
    assert outcome.stats["voice_voting_low_conf"] >= 1
    assert outcome.segment_speaker_ids == [0, 0, 0, 1, 1]


def test_refine_with_voice_voting_keeps_labels_when_embedder_fails(tmp_path) -> None:
    import soundfile as sf

    waveform = np.zeros(16_000, dtype=np.float32)
    audio_path = tmp_path / "silence.wav"
    sf.write(audio_path, waveform, 16_000, subtype="PCM_16")

    segments = [
        _segment("seg-0001", 0.0, 0.5),
        _segment("seg-0002", 0.5, 1.0),
    ]
    turns = [
        DiarizedTurn(start=0.0, end=0.5, speaker_id=0),
        DiarizedTurn(start=0.5, end=1.0, speaker_id=1),
    ]
    outcome = assign_turns_to_segments(segments, turns)

    class _NullEmbedder:
        def encode(self, clip: np.ndarray, sr: int) -> None:
            return None

    before = list(outcome.segment_speaker_ids)
    outcome = refine_with_voice_voting(
        outcome,
        audio_path=audio_path,
        embedder=_NullEmbedder(),
    )
    assert outcome.segment_speaker_ids == before
    assert outcome.stats["voice_voting_reassigned"] == 0
