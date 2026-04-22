from __future__ import annotations

import json
import logging
import shutil
import time
from pathlib import Path
from typing import Any

from ..exceptions import TranslipError
from ..types import DubbingArtifacts, DubbingRequest, DubbingResult
from ..utils.files import ensure_directory, remove_tree, work_directory
from .backend import ReferencePackage, SynthSegmentInput, SynthSegmentOutput
from .export import build_dubbing_manifest, build_dubbing_report, now_iso, render_demo_audio, write_json
from .metrics import evaluate_segment
from .moss_tts_nano_backend import MossTtsNanoOnnxBackend
from .qwen_tts_backend import QwenTTSBackend
from .reference import (
    load_profiles_payload,
    prepare_reference_package,
    select_reference_candidates,
)

logger = logging.getLogger(__name__)


def synthesize_speaker(
    request: DubbingRequest,
    *,
    backend_override: object | None = None,
) -> DubbingResult:
    normalized_request = _validate_request(request)
    translation_payload = json.loads(Path(normalized_request.translation_path).read_text(encoding="utf-8"))
    profiles_payload = load_profiles_payload(Path(normalized_request.profiles_path))
    target_lang = str(translation_payload.get("backend", {}).get("target_lang") or "en")

    bundle_dir = ensure_directory(
        Path(normalized_request.output_dir)
        / Path(normalized_request.translation_path).parent.name
        / normalized_request.speaker_id
    )
    work_dir = work_directory(Path(normalized_request.output_dir))
    report_path = bundle_dir / f"speaker_segments.{translation_payload.get('backend', {}).get('output_tag', target_lang)}.json"
    manifest_path = bundle_dir / "task-d-manifest.json"

    started_at = now_iso()
    started_monotonic = time.monotonic()
    copied_intermediates: dict[str, Path] = {}

    try:
        segments = _filtered_segments(translation_payload, normalized_request)
        backend = backend_override if backend_override is not None else _build_backend(normalized_request)
        reference_candidates = select_reference_candidates(
            profiles_payload=profiles_payload,
            speaker_id=normalized_request.speaker_id,
            reference_clip_path=normalized_request.reference_clip_path,
        )
        succeeded_audio_paths: list[Path] = []
        report_segments: list[dict[str, Any]] = []
        prepared_references: dict[Path, ReferencePackage] = {}

        for index, segment_row in enumerate(segments, start=1):
            segment = SynthSegmentInput(
                segment_id=str(segment_row["segment_id"]),
                speaker_id=normalized_request.speaker_id,
                target_lang=target_lang,
                target_text=str(segment_row["target_text"]).strip(),
                source_duration_sec=float(segment_row["duration"]),
                duration_budget_sec=float(
                    segment_row["duration_budget"].get("estimated_target_sec")
                    or segment_row["duration_budget"].get("estimated_tts_duration_sec")
                    or 0.0
                ),
                qa_flags=[str(flag) for flag in segment_row.get("qa_flags", [])],
                metadata={"context_unit_id": segment_row.get("context_unit_id")},
            )
            output_path = bundle_dir / "segments" / f"{segment.segment_id}.wav"
            synth_output, selected_reference, evaluation, attempt_summary = _synthesize_with_quality_retry(
                backend=backend,
                segment=segment,
                output_path=output_path,
                reference_candidates=reference_candidates[:2],
                prepared_references=prepared_references,
                work_dir=work_dir,
                request=normalized_request,
                target_lang=target_lang,
            )
            succeeded_audio_paths.append(synth_output.audio_path)
            report_segments.append(
                {
                    "segment_id": segment.segment_id,
                    "speaker_id": normalized_request.speaker_id,
                    "target_text": segment.target_text,
                    "source_duration_sec": round(segment.source_duration_sec, 3),
                    "generated_duration_sec": round(synth_output.generated_duration_sec, 3),
                    "duration_ratio": round(evaluation.duration_ratio, 3),
                    "duration_status": evaluation.duration_status,
                    "speaker_similarity": (
                        round(evaluation.speaker_similarity, 4)
                        if evaluation.speaker_similarity is not None
                        else None
                    ),
                    "speaker_status": evaluation.speaker_status,
                    "backread_text": evaluation.backread_text,
                    "text_similarity": round(evaluation.text_similarity, 4),
                    "intelligibility_status": evaluation.intelligibility_status,
                    "overall_status": evaluation.overall_status,
                    "qa_flags": segment.qa_flags,
                    "reference_path": str(selected_reference.original_audio_path),
                    "audio_path": str(synth_output.audio_path),
                    "attempt_count": attempt_summary["attempt_count"],
                    "selected_attempt_index": attempt_summary["selected_attempt_index"],
                    "quality_retry_reasons": attempt_summary["quality_retry_reasons"],
                    "attempts": attempt_summary["attempts"],
                    "index": index,
                }
            )
            partial_report = build_dubbing_report(
                request=normalized_request,
                target_lang=target_lang,
                backend_name=backend.backend_name,
                resolved_model=backend.resolved_model,
                resolved_device=backend.resolved_device,
                reference={
                    "path": str(selected_reference.original_audio_path),
                    "selection_reason": selected_reference.selection_reason,
                },
                segments=report_segments,
            )
            write_json(partial_report, report_path)

        demo_audio_path = render_demo_audio(
            succeeded_audio_paths,
            bundle_dir / f"speaker_demo.{translation_payload.get('backend', {}).get('output_tag', target_lang)}.wav",
        )
        reference_used = report_segments[0]["reference_path"] if report_segments else None
        reference_reason = next(iter(prepared_references.values())).selection_reason if prepared_references else None
        report = build_dubbing_report(
            request=normalized_request,
            target_lang=target_lang,
            backend_name=backend.backend_name,
            resolved_model=backend.resolved_model,
            resolved_device=backend.resolved_device,
            reference={
                "path": reference_used,
                "selection_reason": reference_reason,
            },
            segments=report_segments,
        )
        write_json(report, report_path)
        stats = report["stats"] | {
            "selected_segment_count": len(segments),
            "backread_model": normalized_request.backread_model,
        }
        manifest = build_dubbing_manifest(
            request=normalized_request,
            target_lang=target_lang,
            report_path=report_path,
            demo_audio_path=demo_audio_path,
            started_at=started_at,
            finished_at=now_iso(),
            elapsed_sec=time.monotonic() - started_monotonic,
            resolved={
                "tts_backend": backend.backend_name,
                "model": backend.resolved_model,
                "device": backend.resolved_device,
            },
            stats=stats,
        )
        write_json(manifest, manifest_path)
        if normalized_request.keep_intermediate:
            for prepared in prepared_references.values():
                target = bundle_dir / "intermediate" / prepared.prepared_audio_path.name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(prepared.prepared_audio_path.read_bytes())
                copied_intermediates[prepared.prepared_audio_path.stem] = target
        else:
            remove_tree(work_dir)
        return DubbingResult(
            request=normalized_request,
            artifacts=DubbingArtifacts(
                bundle_dir=bundle_dir,
                segments_dir=bundle_dir / "segments",
                report_path=report_path,
                manifest_path=manifest_path,
                demo_audio_path=demo_audio_path,
                intermediate_paths=copied_intermediates,
            ),
            manifest=manifest,
            work_dir=work_dir,
        )
    except Exception as exc:
        logger.exception("Task D speaker synthesis failed.")
        ensure_directory(bundle_dir)
        manifest = build_dubbing_manifest(
            request=normalized_request,
            target_lang=target_lang,
            report_path=report_path,
            demo_audio_path=None,
            started_at=started_at,
            finished_at=now_iso(),
            elapsed_sec=time.monotonic() - started_monotonic,
            resolved={},
            stats={},
            error=str(exc),
        )
        write_json(manifest, manifest_path)
        raise


def _validate_request(request: DubbingRequest) -> DubbingRequest:
    normalized = request.normalized()
    if not Path(normalized.translation_path).exists():
        raise TranslipError(f"Translation file does not exist: {normalized.translation_path}")
    if not Path(normalized.profiles_path).exists():
        raise TranslipError(f"Profiles file does not exist: {normalized.profiles_path}")
    if not normalized.speaker_id:
        raise TranslipError("speaker_id is required for Task D")
    if normalized.max_segments is not None and normalized.max_segments <= 0:
        raise TranslipError("max_segments must be greater than 0 when provided")
    return normalized


def _filtered_segments(
    translation_payload: dict[str, Any],
    request: DubbingRequest,
) -> list[dict[str, Any]]:
    rows = [
        row
        for row in translation_payload.get("segments", [])
        if isinstance(row, dict) and str(row.get("speaker_id")) == request.speaker_id
    ]
    if request.segment_ids:
        allowed = set(request.segment_ids)
        rows = [row for row in rows if str(row.get("segment_id")) in allowed]
    rows = sorted(rows, key=lambda item: (float(item.get("start", 0.0)), str(item.get("segment_id"))))
    if request.max_segments is not None:
        rows = rows[: request.max_segments]
    if not rows:
        raise TranslipError(f"No translation segments found for speaker {request.speaker_id}")
    return rows


def _synthesize_with_quality_retry(
    *,
    backend: object,
    segment: SynthSegmentInput,
    output_path: Path,
    reference_candidates: list[object],
    prepared_references: dict[Path, ReferencePackage],
    work_dir: Path,
    request: DubbingRequest,
    target_lang: str,
) -> tuple[SynthSegmentOutput, ReferencePackage, object, dict[str, Any]]:
    attempts: list[dict[str, Any]] = []
    retry_reasons: list[str] = []
    synthesis_error: Exception | None = None

    for candidate_index, candidate in enumerate(reference_candidates, start=1):
        prepared = prepared_references.get(candidate.path)
        if prepared is None:
            prepared = prepare_reference_package(
                candidate,
                output_path=work_dir / "reference" / f"{candidate.path.stem}_prepared.wav",
            )
            prepared_references[candidate.path] = prepared
        attempt_path = work_dir / "attempts" / segment.segment_id / f"ref-{candidate_index:02d}.wav"
        try:
            synth_output = backend.synthesize(reference=prepared, segment=segment, output_path=attempt_path)
            evaluation = evaluate_segment(
                reference_audio_path=prepared.original_audio_path,
                generated_audio_path=synth_output.audio_path,
                target_text=segment.target_text,
                target_lang=target_lang,
                source_duration_sec=segment.source_duration_sec,
                requested_device=request.device,
                backread_model_name=request.backread_model,
            )
        except Exception as exc:  # pragma: no cover - covered by real pipeline run
            synthesis_error = exc
            logger.warning(
                "Task D synthesis failed for %s with reference %s: %s",
                segment.segment_id,
                candidate.path,
                exc,
            )
            attempts.append(
                {
                    "attempt_index": candidate_index,
                    "reference_path": str(candidate.path),
                    "status": "failed",
                    "error": str(exc),
                }
            )
            continue

        attempt = {
            "attempt_index": candidate_index,
            "reference_path": str(prepared.original_audio_path),
            "status": "candidate",
            "audio_path": str(synth_output.audio_path),
            "sample_rate": synth_output.sample_rate,
            "generated_duration_sec": round(float(synth_output.generated_duration_sec), 3),
            "duration_ratio": round(float(evaluation.duration_ratio), 3),
            "duration_status": evaluation.duration_status,
            "speaker_similarity": (
                round(float(evaluation.speaker_similarity), 4)
                if evaluation.speaker_similarity is not None
                else None
            ),
            "speaker_status": evaluation.speaker_status,
            "text_similarity": round(float(evaluation.text_similarity), 4),
            "intelligibility_status": evaluation.intelligibility_status,
            "overall_status": evaluation.overall_status,
            "_prepared": prepared,
            "_synth_output": synth_output,
            "_evaluation": evaluation,
        }
        attempts.append(attempt)
        if candidate_index == 1:
            retry_reasons = _quality_retry_reasons(evaluation)
            if not retry_reasons:
                break

    successful_attempts = [attempt for attempt in attempts if attempt.get("status") == "candidate"]
    if not successful_attempts:
        raise TranslipError(f"Failed to synthesize segment {segment.segment_id}: {synthesis_error}")

    selected = max(successful_attempts, key=lambda attempt: _attempt_score(attempt["_evaluation"]))
    selected["status"] = "selected"
    selected_output = selected["_synth_output"]
    selected_reference = selected["_prepared"]
    selected_evaluation = selected["_evaluation"]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(selected_output.audio_path, output_path)

    report_attempts: list[dict[str, Any]] = []
    for attempt in attempts:
        public = {key: value for key, value in attempt.items() if not key.startswith("_")}
        public["selected"] = attempt is selected
        if attempt is selected:
            public["audio_path"] = str(output_path)
        else:
            public.pop("audio_path", None)
        report_attempts.append(public)

    final_output = SynthSegmentOutput(
        segment_id=selected_output.segment_id,
        audio_path=output_path,
        sample_rate=int(selected_output.sample_rate),
        generated_duration_sec=float(selected_output.generated_duration_sec),
        backend_metadata=dict(getattr(selected_output, "backend_metadata", {}) or {}),
    )
    return (
        final_output,
        selected_reference,
        selected_evaluation,
        {
            "attempt_count": len(attempts),
            "selected_attempt_index": int(selected["attempt_index"]),
            "quality_retry_reasons": retry_reasons,
            "attempts": report_attempts,
        },
    )


def _quality_retry_reasons(evaluation: object) -> list[str]:
    reasons: list[str] = []
    duration_ratio = float(getattr(evaluation, "duration_ratio", 0.0) or 0.0)
    text_similarity = float(getattr(evaluation, "text_similarity", 0.0) or 0.0)
    if getattr(evaluation, "duration_status", "") == "failed" and (
        duration_ratio >= 2.0 or 0.0 < duration_ratio <= 0.45
    ):
        reasons.append("pathological_duration")
    if getattr(evaluation, "intelligibility_status", "") == "failed" and text_similarity < 0.6:
        reasons.append("poor_backread")
    return reasons


def _attempt_score(evaluation: object) -> float:
    overall = _status_score(str(getattr(evaluation, "overall_status", ""))) * 100.0
    duration = _status_score(str(getattr(evaluation, "duration_status", ""))) * 24.0
    intelligibility = _status_score(str(getattr(evaluation, "intelligibility_status", ""))) * 18.0
    speaker = _status_score(str(getattr(evaluation, "speaker_status", ""))) * 10.0
    duration_ratio = float(getattr(evaluation, "duration_ratio", 0.0) or 0.0)
    duration_proximity = max(0.0, 1.0 - abs(1.0 - duration_ratio))
    text = float(getattr(evaluation, "text_similarity", 0.0) or 0.0)
    speaker_similarity = getattr(evaluation, "speaker_similarity", None)
    speaker_score = float(speaker_similarity) if speaker_similarity is not None else 0.0
    return overall + duration + intelligibility + speaker + duration_proximity + text + speaker_score


def _status_score(status: str) -> float:
    return {"passed": 2.0, "review": 1.0, "failed": 0.0}.get(status, 0.0)


def _build_backend(request: DubbingRequest) -> object:
    if request.backend == "moss-tts-nano-onnx":
        return MossTtsNanoOnnxBackend(requested_device=request.device)
    if request.backend == "qwen3tts":
        return QwenTTSBackend(requested_device=request.device)
    raise TranslipError(f"Unsupported dubbing backend: {request.backend}")
