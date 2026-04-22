import json
from pathlib import Path

import numpy as np
import soundfile as sf

from translip.dubbing.voice_bank import VoiceBankRequest, build_voice_bank


def _write_audio(path: Path, duration_sec: float, *, sample_rate: int = 16_000, amplitude: float = 0.05) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    waveform = np.ones(int(duration_sec * sample_rate), dtype=np.float32) * amplitude
    sf.write(path, waveform, sample_rate)


def test_build_voice_bank_scores_source_and_composite_references(tmp_path: Path) -> None:
    clip_a = tmp_path / "clip_a.wav"
    clip_b = tmp_path / "clip_b.wav"
    clip_c = tmp_path / "clip_c.wav"
    _write_audio(clip_a, 9.0, amplitude=0.05)
    _write_audio(clip_b, 6.0, amplitude=0.04)
    _write_audio(clip_c, 2.5, amplitude=0.03)
    profiles_path = tmp_path / "speaker_profiles.json"
    profiles_path.write_text(
        json.dumps(
            {
                "profiles": [
                    {
                        "profile_id": "profile_0000",
                        "speaker_id": "spk_0000",
                        "source_label": "SPEAKER_00",
                        "segment_count": 3,
                        "total_speech_sec": 17.5,
                        "reference_clips": [
                            {
                                "path": str(clip_a),
                                "duration": 9.0,
                                "text": "这是一个稳定清晰的参考音频片段",
                                "rms": 0.05,
                            },
                            {
                                "path": str(clip_b),
                                "duration": 6.0,
                                "text": "这是另一段参考音频",
                                "rms": 0.04,
                            },
                            {
                                "path": str(clip_c),
                                "duration": 2.5,
                                "text": "短参考",
                                "rms": 0.03,
                            },
                        ],
                    }
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    result = build_voice_bank(
        VoiceBankRequest(
            profiles_path=profiles_path,
            output_dir=tmp_path / "voice-bank",
            target_lang="en",
        )
    )

    assert result.artifacts.voice_bank_path.exists()
    assert result.artifacts.report_path.exists()
    speaker = result.voice_bank["speakers"][0]
    assert speaker["speaker_id"] == "spk_0000"
    assert speaker["bank_status"] in {"available", "review"}
    assert speaker["recommended_reference_id"]
    assert result.voice_bank["stats"]["composite_reference_count"] == 1
    composite = next(ref for ref in speaker["references"] if ref["type"] == "composite")
    assert Path(composite["audio_path"]).exists()
    assert composite["source_clip_count"] >= 2


def test_voice_bank_uses_task_d_attempt_metrics(tmp_path: Path) -> None:
    clip_a = tmp_path / "clip_a.wav"
    clip_b = tmp_path / "clip_b.wav"
    _write_audio(clip_a, 9.0)
    _write_audio(clip_b, 9.0)
    profiles_path = tmp_path / "speaker_profiles.json"
    profiles_path.write_text(
        json.dumps(
            {
                "profiles": [
                    {
                        "profile_id": "profile_0000",
                        "speaker_id": "spk_0000",
                        "source_label": "SPEAKER_00",
                        "segment_count": 2,
                        "total_speech_sec": 18.0,
                        "reference_clips": [
                            {"path": str(clip_a), "duration": 9.0, "text": "清晰参考音频一", "rms": 0.05},
                            {"path": str(clip_b), "duration": 9.0, "text": "清晰参考音频二", "rms": 0.05},
                        ],
                    }
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    report_path = tmp_path / "speaker_segments.en.json"
    report_path.write_text(
        json.dumps(
            {
                "segments": [
                    {
                        "segment_id": "seg-0001",
                        "attempts": [
                            {
                                "reference_path": str(clip_a),
                                "selected": False,
                                "duration_status": "failed",
                                "speaker_status": "failed",
                                "intelligibility_status": "failed",
                                "overall_status": "failed",
                                "duration_ratio": 3.2,
                                "speaker_similarity": 0.15,
                                "text_similarity": 0.4,
                            },
                            {
                                "reference_path": str(clip_b),
                                "selected": True,
                                "duration_status": "passed",
                                "speaker_status": "passed",
                                "intelligibility_status": "passed",
                                "overall_status": "passed",
                                "duration_ratio": 1.0,
                                "speaker_similarity": 0.5,
                                "text_similarity": 0.98,
                            },
                        ],
                    }
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    result = build_voice_bank(
        VoiceBankRequest(
            profiles_path=profiles_path,
            output_dir=tmp_path / "voice-bank",
            task_d_report_paths=[report_path],
            include_composites=False,
        )
    )

    speaker = result.voice_bank["speakers"][0]
    assert speaker["recommended_reference_path"] == str(clip_b.resolve())
    by_path = {ref["audio_path"]: ref for ref in speaker["references"]}
    assert by_path[str(clip_b.resolve())]["benchmark"]["selected_count"] == 1
    assert by_path[str(clip_b.resolve())]["quality_score"] > by_path[str(clip_a.resolve())]["quality_score"]


def test_voice_bank_marks_speaker_without_id_for_review(tmp_path: Path) -> None:
    profiles_path = tmp_path / "speaker_profiles.json"
    profiles_path.write_text(
        json.dumps(
            {
                "profiles": [
                    {
                        "profile_id": "profile_0001",
                        "speaker_id": None,
                        "source_label": "SPEAKER_01",
                        "segment_count": 1,
                        "total_speech_sec": 0.8,
                        "reference_clips": [],
                    }
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    result = build_voice_bank(
        VoiceBankRequest(
            profiles_path=profiles_path,
            output_dir=tmp_path / "voice-bank",
        )
    )

    speaker = result.voice_bank["speakers"][0]
    assert speaker["bank_status"] == "needs_speaker_review"
    assert speaker["references"] == []
