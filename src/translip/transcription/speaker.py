from __future__ import annotations

import logging
from pathlib import Path

from ..speaker_embedding import get_speaker_embedder
from .asr import AsrSegment
from .diarization import (
    assign_turns_to_segments,
    create_backend,
    refine_with_change_detection,
    refine_with_min_turn,
    refine_with_neighbor_merge,
    refine_with_voice_voting,
)

logger = logging.getLogger(__name__)


def _majority(values: list[int]) -> int:
    counts: dict[int, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return max(counts.items(), key=lambda item: (item[1], -item[0]))[0]


def _stable_relabel(cluster_ids: list[int]) -> list[str]:
    mapping: dict[int, str] = {}
    labels: list[str] = []
    next_id = 0
    for cluster_id in cluster_ids:
        if cluster_id not in mapping:
            mapping[cluster_id] = f"SPEAKER_{next_id:02d}"
            next_id += 1
        labels.append(mapping[cluster_id])
    return labels


def assign_speaker_labels(
    audio_path: Path,
    segments: list[AsrSegment],
    *,
    requested_device: str,
) -> tuple[list[str], dict[str, int | float | str]]:
    """Assign speaker labels by running CAM++ diarization and projecting onto
    ASR segments, then applying Path A post-processing (min-turn absorption,
    neighbour-merge bookkeeping, ERes2NetV2 voice voting).
    """

    if not segments:
        return [], {
            "speaker_backend": "eres2netv2",
            "diarization_backend": "threed_speaker",
            "speaker_count": 0,
        }

    diarizer = create_backend()
    result = diarizer.diarize(
        audio_path,
        segments=segments,
        requested_device=requested_device,
    )

    outcome = assign_turns_to_segments(segments, result.turns)
    outcome = refine_with_change_detection(outcome)
    outcome = refine_with_min_turn(outcome)
    outcome = refine_with_neighbor_merge(outcome)

    embedder = get_speaker_embedder(requested_device)
    outcome = refine_with_voice_voting(
        outcome,
        audio_path=audio_path,
        embedder=embedder,
    )

    # task-a's public contract guarantees a one-to-one mapping with the
    # original ASR segments; merge any turn-boundary splits back to the
    # dominant label of the parent segment.
    labels_by_index: dict[str, list[int]] = {}
    for seg, speaker_id in zip(outcome.segments, outcome.segment_speaker_ids, strict=True):
        parent_id = seg.segment_id.split("-")[0:2]
        key = "-".join(parent_id)
        labels_by_index.setdefault(key, []).append(speaker_id)

    speaker_ids_per_segment: list[int] = []
    for segment in segments:
        votes = labels_by_index.get(segment.segment_id, [])
        if not votes:
            votes = [0]
        speaker_ids_per_segment.append(_majority(votes))

    labels = _stable_relabel(speaker_ids_per_segment)
    metadata: dict[str, int | float | str] = {
        "speaker_backend": str(result.metadata.get("speaker_backend", "eres2netv2")),
        "diarization_backend": diarizer.name,
        "speaker_count": len(set(labels)),
    }
    for key, value in result.metadata.items():
        if key in {"speaker_backend", "speaker_count"}:
            continue
        if isinstance(value, (int, float, str)):
            metadata[f"diarization_{key}"] = value
    metadata["diarization_turn_count"] = len(result.turns)
    metadata["diarization_split_segments"] = int(outcome.stats.get("split_segment_count", 0))
    metadata["diarization_fallback_segments"] = int(outcome.stats.get("fallback_segment_count", 0))
    for key in (
        "speaker_run_count",
        "max_run_length",
        "neighbor_merge_candidates",
        "min_turn_absorbed",
        "voice_voting_low_conf",
        "voice_voting_reassigned",
        "voice_voting_coverage",
    ):
        if key in outcome.stats:
            metadata[f"diarization_{key}"] = outcome.stats[key]
    return labels, metadata
