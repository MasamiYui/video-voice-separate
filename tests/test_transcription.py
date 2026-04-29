import json
from pathlib import Path

from translip.transcription.export import (
    build_transcription_manifest,
    segments_payload,
    write_segments_srt,
)
from translip.transcription.speaker import _stable_relabel
from translip.types import MediaInfo, TranscriptionRequest, TranscriptionSegment
from translip.transcription.asr import (
    AsrSegment,
    merge_adjacent_segments,
    resolve_faster_whisper_model_path,
)


def test_stable_relabel_preserves_first_seen_order() -> None:
    assert _stable_relabel([5, 5, 7, 5, 3]) == [
        "SPEAKER_00",
        "SPEAKER_00",
        "SPEAKER_01",
        "SPEAKER_00",
        "SPEAKER_02",
    ]


def test_segments_payload_and_manifest_shape(tmp_path: Path) -> None:
    request = TranscriptionRequest(input_path="voice.wav").normalized()
    media_info = MediaInfo(
        path=Path("/tmp/voice.wav"),
        media_type="audio",
        format_name="wav",
        duration_sec=12.0,
        audio_stream_index=0,
        audio_stream_count=1,
        sample_rate=16000,
        channels=1,
    )
    segments = [
        TranscriptionSegment(
            segment_id="seg-0001",
            start=0.0,
            end=1.5,
            text="你好，世界。",
            speaker_label="SPEAKER_00",
            language="zh",
            duration=1.5,
        )
    ]
    payload = segments_payload(
        request=request,
        media_info=media_info,
        segments=segments,
        metadata={
            "asr_backend": "faster-whisper",
            "asr_model": "small",
            "asr_device": "cpu",
            "speaker_backend": "speechbrain-ecapa",
            "speaker_device": "cpu",
            "detected_language": "zh",
        },
    )
    manifest = build_transcription_manifest(
        request=request,
        media_info=media_info,
        segments_path=tmp_path / "segments.zh.json",
        srt_path=tmp_path / "segments.zh.srt",
        started_at="2026-04-11T22:00:00+08:00",
        finished_at="2026-04-11T22:00:01+08:00",
        elapsed_sec=1.0,
        metadata={"segment_count": 1, "speaker_count": 1},
    )
    payload_json = json.loads(json.dumps(payload, ensure_ascii=False))
    manifest_json = json.loads(json.dumps(manifest, ensure_ascii=False))
    assert payload_json["stats"]["segment_count"] == 1
    assert payload_json["segments"][0]["speaker_label"] == "SPEAKER_00"
    assert manifest_json["resolved"]["speaker_count"] == 1
    assert manifest_json["status"] == "succeeded"


def test_write_segments_srt(tmp_path: Path) -> None:
    output_path = tmp_path / "segments.zh.srt"
    write_segments_srt(
        [
            TranscriptionSegment(
                segment_id="seg-0001",
                start=0.0,
                end=1.0,
                text="你好",
                speaker_label="SPEAKER_00",
                language="zh",
                duration=1.0,
            )
        ],
        output_path,
    )
    content = output_path.read_text(encoding="utf-8")
    assert "00:00:00,000 --> 00:00:01,000" in content
    assert "[SPEAKER_00] 你好" in content


def test_resolve_faster_whisper_model_path_prefers_complete_local_cache(tmp_path: Path) -> None:
    hf_cache = tmp_path / "hub"
    model_cache = hf_cache / "models--Systran--faster-whisper-small"
    snapshot = model_cache / "snapshots" / "abc123"
    snapshot.mkdir(parents=True)
    (model_cache / "refs").mkdir()
    (model_cache / "refs" / "main").write_text("abc123", encoding="utf-8")

    for filename in ["model.bin", "config.json", "tokenizer.json", "vocabulary.txt"]:
        (snapshot / filename).write_text("cached", encoding="utf-8")

    assert resolve_faster_whisper_model_path("small", cache_dir=hf_cache) == str(snapshot)


def _asr(seg_id: str, start: float, end: float, text: str = "hi", lang: str = "zh") -> AsrSegment:
    return AsrSegment(segment_id=seg_id, start=start, end=end, text=text, language=lang)


def test_merge_adjacent_segments_joins_neighbours_under_gap_threshold() -> None:
    segments = [
        _asr("seg-0001", 0.0, 1.0, text="你好"),
        _asr("seg-0002", 1.10, 2.0, text="世界"),
        _asr("seg-0003", 5.00, 6.0, text="再见"),
    ]
    merged, stats = merge_adjacent_segments(segments, max_gap_sec=0.3, max_segment_sec=15.0)
    assert [s.segment_id for s in merged] == ["seg-0001", "seg-0002"]
    assert merged[0].text == "你好 世界"
    assert merged[0].start == 0.0 and merged[0].end == 2.0
    assert merged[1].text == "再见"
    assert stats == {
        "vad_merge_input": 3,
        "vad_merge_output": 2,
        "vad_merge_merged_pairs": 1,
        "vad_merge_max_gap_sec": 0.1,
    }


def test_merge_adjacent_segments_respects_max_segment_duration() -> None:
    # Even with tiny gaps, the combined span must not exceed the cap.
    segments = [
        _asr("seg-0001", 0.0, 8.0),
        _asr("seg-0002", 8.05, 14.0),
        _asr("seg-0003", 14.10, 18.0),
    ]
    merged, stats = merge_adjacent_segments(segments, max_gap_sec=0.5, max_segment_sec=15.0)
    # First two merge (span=14s <= 15), third would push span to 18s > 15 -> kept separate.
    assert len(merged) == 2
    assert merged[0].end == 14.0
    assert merged[1].start == 14.10
    assert stats["vad_merge_merged_pairs"] == 1


def test_merge_adjacent_segments_does_not_cross_language_boundary() -> None:
    segments = [
        _asr("seg-0001", 0.0, 1.0, text="hello", lang="en"),
        _asr("seg-0002", 1.05, 2.0, text="你好", lang="zh"),
    ]
    merged, stats = merge_adjacent_segments(segments, max_gap_sec=0.3, max_segment_sec=15.0)
    assert [s.segment_id for s in merged] == ["seg-0001", "seg-0002"]
    assert stats["vad_merge_merged_pairs"] == 0


def test_merge_adjacent_segments_empty_input_returns_zero_stats() -> None:
    merged, stats = merge_adjacent_segments([])
    assert merged == []
    assert stats == {
        "vad_merge_input": 0,
        "vad_merge_output": 0,
        "vad_merge_merged_pairs": 0,
        "vad_merge_max_gap_sec": 0.0,
    }
