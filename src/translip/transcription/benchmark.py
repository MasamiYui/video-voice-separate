from __future__ import annotations

import difflib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from statistics import median
from typing import Any

from ..transcription.runner import transcribe_file
from ..types import TranscriptionRequest
from .export import now_iso, write_manifest


@dataclass(slots=True)
class ReferenceSubtitle:
    index: int
    start: float
    end: float
    text: str


@dataclass(slots=True)
class BenchmarkRunSpec:
    slug: str
    label: str
    request: TranscriptionRequest


@dataclass(slots=True)
class BenchmarkRunResult:
    slug: str
    label: str
    output_dir: Path
    segments_path: Path
    manifest_path: Path
    metrics: dict[str, Any]
    request: dict[str, Any]


@dataclass(slots=True)
class BenchmarkArtifacts:
    output_dir: Path
    summary_path: Path


@dataclass(slots=True)
class BenchmarkResult:
    artifacts: BenchmarkArtifacts
    summary: dict[str, Any]
    runs: list[BenchmarkRunResult]


def parse_srt(path: Path) -> list[ReferenceSubtitle]:
    content = path.read_text(encoding="utf-8").strip()
    if not content:
        return []
    blocks = re.split(r"\n\s*\n", content)
    subtitles: list[ReferenceSubtitle] = []
    for block in blocks:
        lines = [line.strip("\ufeff") for line in block.splitlines() if line.strip()]
        if len(lines) < 3:
            continue
        try:
            index = int(lines[0])
        except ValueError:
            continue
        if "-->" not in lines[1]:
            continue
        start_text, end_text = [part.strip() for part in lines[1].split("-->", maxsplit=1)]
        subtitles.append(
            ReferenceSubtitle(
                index=index,
                start=_parse_srt_timestamp(start_text),
                end=_parse_srt_timestamp(end_text),
                text=" ".join(lines[2:]).strip(),
            )
        )
    return subtitles


def benchmark_transcription_runs(
    *,
    media_path: Path,
    reference_srt_path: Path,
    output_dir: Path,
    runs: list[BenchmarkRunSpec],
) -> BenchmarkResult:
    output_dir.mkdir(parents=True, exist_ok=True)
    references = parse_srt(reference_srt_path)
    reference_text = "".join(subtitle.text for subtitle in references)
    normalized_reference = normalize_text(reference_text)

    run_results: list[BenchmarkRunResult] = []
    for spec in runs:
        result = transcribe_file(spec.request)
        hypothesis_payload = json.loads(result.artifacts.segments_json_path.read_text(encoding="utf-8"))
        manifest_payload = json.loads(result.artifacts.manifest_path.read_text(encoding="utf-8"))
        metrics = score_transcription_against_reference(
            reference_subtitles=references,
            hypothesis_payload=hypothesis_payload,
            manifest_payload=manifest_payload,
        )
        run_results.append(
            BenchmarkRunResult(
                slug=spec.slug,
                label=spec.label,
                output_dir=Path(spec.request.output_dir),
                segments_path=result.artifacts.segments_json_path,
                manifest_path=result.artifacts.manifest_path,
                metrics=metrics,
                request=_request_payload(spec.request),
            )
        )

    sorted_runs = sorted(
        run_results,
        key=lambda item: (-float(item.metrics["text_similarity"]), float(item.metrics["cer"]), float(item.metrics["elapsed_sec"])),
    )
    summary = {
        "input": {
            "media_path": str(media_path),
            "reference_srt_path": str(reference_srt_path),
            "reference_subtitle_count": len(references),
            "reference_text_length": len(reference_text),
            "normalized_reference_length": len(normalized_reference),
        },
        "timing": {
            "generated_at": now_iso(),
        },
        "runs": [
            {
                "rank": index,
                "slug": run.slug,
                "label": run.label,
                "metrics": run.metrics,
                "request": run.request,
                "artifacts": {
                    "output_dir": str(run.output_dir),
                    "segments_json": str(run.segments_path),
                    "manifest": str(run.manifest_path),
                },
            }
            for index, run in enumerate(sorted_runs, start=1)
        ],
        "best_run": sorted_runs[0].slug if sorted_runs else None,
    }
    summary_path = output_dir / "benchmark-summary.json"
    write_manifest(summary, summary_path)
    return BenchmarkResult(
        artifacts=BenchmarkArtifacts(output_dir=output_dir, summary_path=summary_path),
        summary=summary,
        runs=sorted_runs,
    )


def score_transcription_against_reference(
    *,
    reference_subtitles: list[ReferenceSubtitle],
    hypothesis_payload: dict[str, Any],
    manifest_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    hypothesis_segments = hypothesis_payload.get("segments", [])
    raw_reference_text = "".join(subtitle.text for subtitle in reference_subtitles)
    raw_hypothesis_text = "".join(str(segment.get("text", "")) for segment in hypothesis_segments)
    normalized_reference = normalize_text(raw_reference_text)
    normalized_hypothesis = normalize_text(raw_hypothesis_text)
    text_similarity = _text_similarity(normalized_reference, normalized_hypothesis)
    cer = _character_error_rate(normalized_reference, normalized_hypothesis)
    segment_durations = [float(segment.get("duration", 0.0)) for segment in hypothesis_segments]
    speaker_labels = [str(segment.get("speaker_label", "")) for segment in hypothesis_segments if segment.get("speaker_label")]
    speaker_switches = sum(
        1 for previous, current in zip(speaker_labels, speaker_labels[1:], strict=False) if previous != current
    )
    short_segment_count = sum(1 for duration in segment_durations if duration <= 1.0)
    manifest_timing = (manifest_payload or {}).get("timing", {})
    elapsed_sec = float(hypothesis_payload.get("elapsed_sec", 0.0))
    if not elapsed_sec and isinstance(manifest_timing, dict):
        elapsed_sec = float(manifest_timing.get("elapsed_sec", 0.0) or 0.0)
    return {
        "reference_char_count": len(normalized_reference),
        "hypothesis_char_count": len(normalized_hypothesis),
        "text_similarity": round(text_similarity, 6),
        "cer": round(cer, 6),
        "coverage": round(_coverage(normalized_reference, normalized_hypothesis), 6),
        "segment_count": len(hypothesis_segments),
        "median_segment_duration": round(median(segment_durations), 3) if segment_durations else 0.0,
        "short_segment_ratio": round(short_segment_count / len(segment_durations), 6) if segment_durations else 0.0,
        "speaker_count": len(set(speaker_labels)),
        "speaker_switch_rate": round(speaker_switches / max(1, len(speaker_labels) - 1), 6) if len(speaker_labels) > 1 else 0.0,
        "elapsed_sec": round(elapsed_sec, 3),
    }


def normalize_text(text: str) -> str:
    text = re.sub(r"\[speaker_\d+\]\s*", "", text, flags=re.IGNORECASE)
    text = text.strip().lower()
    text = re.sub(r"\s+", "", text)
    return re.sub(r"[^\w\u4e00-\u9fff]+", "", text)


def build_phase1_benchmark_runs(
    *,
    media_path: Path,
    output_root: Path,
    language: str,
    model_name: str,
    device: str,
    audio_stream_index: int,
) -> list[BenchmarkRunSpec]:
    definitions = [
        ("baseline", "baseline", {"vad_filter": True, "vad_min_silence_duration_ms": 400, "beam_size": 5, "best_of": 5, "condition_on_previous_text": False}),
        ("vad-600", "vad min silence 600ms", {"vad_filter": True, "vad_min_silence_duration_ms": 600, "beam_size": 5, "best_of": 5, "condition_on_previous_text": False}),
        ("vad-250", "vad min silence 250ms", {"vad_filter": True, "vad_min_silence_duration_ms": 250, "beam_size": 5, "best_of": 5, "condition_on_previous_text": False}),
        ("no-vad", "no vad", {"vad_filter": False, "vad_min_silence_duration_ms": 400, "beam_size": 5, "best_of": 5, "condition_on_previous_text": False}),
        ("context-on", "condition on previous text", {"vad_filter": True, "vad_min_silence_duration_ms": 400, "beam_size": 5, "best_of": 5, "condition_on_previous_text": True}),
        ("lightweight", "beam 1 best_of 1", {"vad_filter": True, "vad_min_silence_duration_ms": 400, "beam_size": 1, "best_of": 1, "condition_on_previous_text": False}),
    ]
    runs: list[BenchmarkRunSpec] = []
    for slug, label, overrides in definitions:
        runs.append(
            BenchmarkRunSpec(
                slug=slug,
                label=label,
                request=TranscriptionRequest(
                    input_path=media_path,
                    output_dir=output_root / slug,
                    language=language,
                    asr_model=model_name,
                    device=device,
                    audio_stream_index=audio_stream_index,
                    keep_intermediate=False,
                    write_srt=True,
                    temperature=0.0,
                    **overrides,
                ),
            )
        )
    return runs


def _request_payload(request: TranscriptionRequest) -> dict[str, Any]:
    normalized = request.normalized()
    return {
        "input_path": str(normalized.input_path),
        "output_dir": str(normalized.output_dir),
        "language": normalized.language,
        "asr_model": normalized.asr_model,
        "device": normalized.device,
        "audio_stream_index": normalized.audio_stream_index,
        "vad_filter": normalized.vad_filter,
        "vad_min_silence_duration_ms": normalized.vad_min_silence_duration_ms,
        "beam_size": normalized.beam_size,
        "best_of": normalized.best_of,
        "temperature": normalized.temperature,
        "condition_on_previous_text": normalized.condition_on_previous_text,
    }


def _parse_srt_timestamp(value: str) -> float:
    hours, minutes, remainder = value.split(":", maxsplit=2)
    seconds, millis = remainder.split(",", maxsplit=1)
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds) + int(millis) / 1000.0


def _coverage(reference_text: str, hypothesis_text: str) -> float:
    if not reference_text:
        return 1.0 if not hypothesis_text else 0.0
    matcher = difflib.SequenceMatcher(a=reference_text, b=hypothesis_text)
    matched = sum(block.size for block in matcher.get_matching_blocks())
    return matched / len(reference_text)


def _character_error_rate(reference_text: str, hypothesis_text: str) -> float:
    if not reference_text:
        return 0.0 if not hypothesis_text else 1.0
    distance = _levenshtein_distance(reference_text, hypothesis_text)
    return distance / len(reference_text)


def _text_similarity(reference_text: str, hypothesis_text: str) -> float:
    if not reference_text and not hypothesis_text:
        return 1.0
    if not reference_text or not hypothesis_text:
        return 0.0
    return float(difflib.SequenceMatcher(a=reference_text, b=hypothesis_text).ratio())


def _levenshtein_distance(reference_text: str, hypothesis_text: str) -> int:
    if reference_text == hypothesis_text:
        return 0
    if not reference_text:
        return len(hypothesis_text)
    if not hypothesis_text:
        return len(reference_text)

    previous_row = list(range(len(hypothesis_text) + 1))
    for index, reference_char in enumerate(reference_text, start=1):
        current_row = [index]
        for hypothesis_index, hypothesis_char in enumerate(hypothesis_text, start=1):
            insert_cost = current_row[hypothesis_index - 1] + 1
            delete_cost = previous_row[hypothesis_index] + 1
            replace_cost = previous_row[hypothesis_index - 1] + (reference_char != hypothesis_char)
            current_row.append(min(insert_cost, delete_cost, replace_cost))
        previous_row = current_row
    return previous_row[-1]


__all__ = [
    "BenchmarkResult",
    "BenchmarkRunResult",
    "BenchmarkRunSpec",
    "ReferenceSubtitle",
    "benchmark_transcription_runs",
    "build_phase1_benchmark_runs",
    "normalize_text",
    "parse_srt",
    "score_transcription_against_reference",
]
