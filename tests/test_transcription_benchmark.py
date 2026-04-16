from pathlib import Path

from translip.transcription.benchmark import (
    build_phase1_benchmark_runs,
    normalize_text,
    parse_srt,
    score_transcription_against_reference,
)


def test_normalize_text_removes_speaker_prefixes_and_punctuation() -> None:
    assert normalize_text("[SPEAKER_00] 哈利法塔，excuse me！") == "哈利法塔excuseme"


def test_parse_srt_reads_blocks(tmp_path: Path) -> None:
    srt_path = tmp_path / "sample.srt"
    srt_path.write_text(
        "1\n00:00:01,000 --> 00:00:02,500\n你好\n\n2\n00:00:03,000 --> 00:00:04,000\n迪拜\n",
        encoding="utf-8",
    )
    subtitles = parse_srt(srt_path)
    assert len(subtitles) == 2
    assert subtitles[0].start == 1.0
    assert subtitles[0].end == 2.5
    assert subtitles[1].text == "迪拜"


def test_score_transcription_against_reference_uses_normalized_text() -> None:
    reference_subtitles = parse_srt_from_text(
        "1\n00:00:01,000 --> 00:00:02,000\n哈利法塔\n\n2\n00:00:02,100 --> 00:00:03,000\nexcuse me\n"
    )
    hypothesis_payload = {
        "segments": [
            {"text": "[SPEAKER_00] 哈利法塔！", "duration": 1.0, "speaker_label": "SPEAKER_00"},
            {"text": "Excuse me", "duration": 1.2, "speaker_label": "SPEAKER_00"},
        ]
    }
    manifest_payload = {"timing": {"elapsed_sec": 3.25}}
    metrics = score_transcription_against_reference(
        reference_subtitles=reference_subtitles,
        hypothesis_payload=hypothesis_payload,
        manifest_payload=manifest_payload,
    )
    assert metrics["text_similarity"] == 1.0
    assert metrics["cer"] == 0.0
    assert metrics["speaker_count"] == 1
    assert metrics["elapsed_sec"] == 3.25


def test_build_phase1_benchmark_runs_creates_expected_variants(tmp_path: Path) -> None:
    runs = build_phase1_benchmark_runs(
        media_path=tmp_path / "sample.mp4",
        output_root=tmp_path / "benchmark-runs",
        language="zh",
        model_name="small",
        device="cpu",
        audio_stream_index=0,
    )
    assert [run.slug for run in runs] == [
        "baseline",
        "vad-600",
        "vad-250",
        "no-vad",
        "context-on",
        "lightweight",
    ]
    assert runs[3].request.vad_filter is False
    assert runs[4].request.condition_on_previous_text is True
    assert runs[5].request.beam_size == 1
    assert runs[5].request.best_of == 1


def parse_srt_from_text(content: str):
    temp_path = Path("/tmp/translip-benchmark-test.srt")
    temp_path.write_text(content, encoding="utf-8")
    try:
        return parse_srt(temp_path)
    finally:
        temp_path.unlink(missing_ok=True)
