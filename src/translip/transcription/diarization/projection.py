from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np
import soundfile as sf

from ..asr import AsrSegment
from .base import DiarizedTurn

logger = logging.getLogger(__name__)

DEFAULT_LONG_SEGMENT_SPLIT_SEC = 10.0
DEFAULT_MIN_SPLIT_GAP_SEC = 0.6
DEFAULT_OVERLAP_TIE_BREAKER_SEC = 0.05
DEFAULT_NEIGHBOR_MERGE_GAP_SEC = 0.3
DEFAULT_MIN_TURN_SEC = 0.8
DEFAULT_VOICE_VOTING_LOW_CONF = 0.35
DEFAULT_VOICE_VOTING_REASSIGN = 0.55


class _EmbedderLike(Protocol):
    """Duck-typed speaker embedder used by :func:`refine_with_voice_voting`."""

    def encode(self, clip: np.ndarray, sample_rate: int) -> np.ndarray | None: ...


@dataclass(slots=True)
class ProjectionOutcome:
    """Result of projecting a diarization timeline onto ASR segments."""

    segments: list[AsrSegment]
    segment_speaker_ids: list[int]
    stats: dict[str, int | float]


def _overlap(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    return max(0.0, min(a_end, b_end) - max(a_start, b_start))


def _turns_within(segment: AsrSegment, turns: list[DiarizedTurn]) -> list[DiarizedTurn]:
    hits: list[DiarizedTurn] = []
    for turn in turns:
        if turn.end <= segment.start or turn.start >= segment.end:
            continue
        if turn.duration <= 0.0:
            continue
        hits.append(turn)
    return hits


def _best_turn_for(segment: AsrSegment, turns: list[DiarizedTurn]) -> DiarizedTurn | None:
    best: DiarizedTurn | None = None
    best_overlap = -1.0
    for turn in turns:
        overlap = _overlap(segment.start, segment.end, turn.start, turn.end)
        if overlap > best_overlap + DEFAULT_OVERLAP_TIE_BREAKER_SEC:
            best = turn
            best_overlap = overlap
    return best


def _nearest_turn(segment: AsrSegment, turns: list[DiarizedTurn]) -> DiarizedTurn | None:
    if not turns:
        return None
    center = 0.5 * (segment.start + segment.end)
    return min(
        turns,
        key=lambda turn: abs(0.5 * (turn.start + turn.end) - center),
    )


def _split_segment(
    segment: AsrSegment,
    hits: list[DiarizedTurn],
    *,
    min_split_gap_sec: float,
) -> list[tuple[AsrSegment, int]]:
    """Split an ASR segment along diarization boundaries inside it."""

    if not hits:
        return [(segment, -1)]

    ordered = sorted(hits, key=lambda turn: turn.start)
    sub_segments: list[tuple[AsrSegment, int]] = []
    cursor = segment.start
    current_speaker = ordered[0].speaker_id

    def flush(new_start: float, new_end: float, speaker_id: int) -> None:
        if new_end - new_start < min_split_gap_sec:
            return
        suffix = f"-{len(sub_segments) + 1:02d}"
        sub_segments.append(
            (
                AsrSegment(
                    segment_id=f"{segment.segment_id}{suffix}",
                    start=round(new_start, 3),
                    end=round(new_end, 3),
                    text=segment.text,
                    language=segment.language,
                ),
                speaker_id,
            )
        )

    for idx, turn in enumerate(ordered):
        turn_end = min(segment.end, turn.end)
        turn_start = max(segment.start, turn.start)
        if turn.speaker_id != current_speaker and turn_start > cursor:
            flush(cursor, turn_start, current_speaker)
            cursor = turn_start
            current_speaker = turn.speaker_id
        if idx == len(ordered) - 1:
            flush(cursor, max(turn_end, segment.end), current_speaker)
            cursor = segment.end
    if cursor < segment.end:
        flush(cursor, segment.end, current_speaker)

    if not sub_segments:
        return [(segment, current_speaker)]
    return sub_segments


def assign_turns_to_segments(
    segments: list[AsrSegment],
    turns: list[DiarizedTurn],
    *,
    long_segment_split_sec: float = DEFAULT_LONG_SEGMENT_SPLIT_SEC,
    min_split_gap_sec: float = DEFAULT_MIN_SPLIT_GAP_SEC,
) -> ProjectionOutcome:
    """Project a diarization timeline onto ASR segments.

    Long segments (>= ``long_segment_split_sec``) that straddle multiple
    speakers are split at turn boundaries so low-frequency speakers are
    preserved instead of being absorbed by the dominant turn.
    """

    emitted_segments: list[AsrSegment] = []
    emitted_speakers: list[int] = []
    fallback_speaker = turns[0].speaker_id if turns else 0
    split_count = 0
    fallback_count = 0

    for segment in segments:
        hits = _turns_within(segment, turns)
        if not hits:
            nearest = _nearest_turn(segment, turns)
            speaker = nearest.speaker_id if nearest is not None else fallback_speaker
            emitted_segments.append(segment)
            emitted_speakers.append(speaker)
            fallback_count += 1
            continue

        speakers_in_hits = {turn.speaker_id for turn in hits}
        if (
            len(speakers_in_hits) > 1
            and segment.duration >= long_segment_split_sec
        ):
            parts = _split_segment(segment, hits, min_split_gap_sec=min_split_gap_sec)
            if len(parts) > 1:
                split_count += 1
            for sub_segment, speaker_id in parts:
                emitted_segments.append(sub_segment)
                emitted_speakers.append(speaker_id)
            continue

        best = _best_turn_for(segment, hits)
        speaker = best.speaker_id if best is not None else fallback_speaker
        emitted_segments.append(segment)
        emitted_speakers.append(speaker)

    stats = {
        "input_segment_count": len(segments),
        "output_segment_count": len(emitted_segments),
        "split_segment_count": split_count,
        "fallback_segment_count": fallback_count,
    }
    return ProjectionOutcome(
        segments=emitted_segments,
        segment_speaker_ids=emitted_speakers,
        stats=stats,
    )


def refine_with_change_detection(
    outcome: ProjectionOutcome,
    *,
    sandwich_max_sec: float = 1.5,
) -> ProjectionOutcome:
    """Stabilize speaker assignments by smoothing short sandwiched segments.

    If speaker ids form a pattern ``A B A`` and the middle segment is short,
    collapse it to ``A`` to remove jitter introduced by overlapping music or
    non-speech noise.  This mirrors ``_smooth_cluster_ids`` but runs on the
    projected output rather than raw cluster ids.
    """

    ids = list(outcome.segment_speaker_ids)
    if len(ids) < 3:
        return outcome
    for index in range(1, len(ids) - 1):
        prev_id = ids[index - 1]
        curr_id = ids[index]
        next_id = ids[index + 1]
        duration = outcome.segments[index].duration
        if prev_id == next_id and curr_id != prev_id and duration <= sandwich_max_sec:
            ids[index] = prev_id
    outcome.segment_speaker_ids = ids
    return outcome


def _speaker_runs(ids: list[int]) -> list[tuple[int, int, int]]:
    """Return ``[(speaker_id, start_index, end_index_exclusive), ...]`` runs."""

    if not ids:
        return []
    runs: list[tuple[int, int, int]] = []
    run_start = 0
    current = ids[0]
    for index in range(1, len(ids)):
        if ids[index] != current:
            runs.append((current, run_start, index))
            run_start = index
            current = ids[index]
    runs.append((current, run_start, len(ids)))
    return runs


def refine_with_neighbor_merge(
    outcome: ProjectionOutcome,
    *,
    max_gap_sec: float = DEFAULT_NEIGHBOR_MERGE_GAP_SEC,
) -> ProjectionOutcome:
    """Annotate adjacent same-speaker runs separated by only a tiny gap.

    task-a's public contract requires a 1:1 mapping between ASR segments and
    speaker labels, so we *do not* merge ``AsrSegment`` objects here; instead
    we walk the emitted sequence, count how many adjacent pairs share the
    same speaker id with a gap shorter than ``max_gap_sec``, and surface the
    result in ``outcome.stats`` under ``neighbor_merge_candidates``.  The
    counter is a useful regression signal: a healthy diarization pass after
    the Path A refinements should push this number down.

    The function still runs length-independent bookkeeping (``speaker_run_count``
    and ``max_run_length``) so downstream dashboards can reason about label
    churn without having to re-walk the list.
    """

    ids = outcome.segment_speaker_ids
    segments = outcome.segments
    stats = outcome.stats

    runs = _speaker_runs(ids)
    stats["speaker_run_count"] = len(runs)
    stats["max_run_length"] = max((end - start for _, start, end in runs), default=0)

    if len(segments) < 2:
        stats["neighbor_merge_candidates"] = 0
        return outcome

    candidates = 0
    for index in range(1, len(segments)):
        if ids[index] != ids[index - 1]:
            continue
        gap = max(0.0, segments[index].start - segments[index - 1].end)
        if gap <= max_gap_sec:
            candidates += 1
    stats["neighbor_merge_candidates"] = candidates
    return outcome


def refine_with_min_turn(
    outcome: ProjectionOutcome,
    *,
    min_turn_sec: float = DEFAULT_MIN_TURN_SEC,
) -> ProjectionOutcome:
    """Absorb single-segment sandwich speaker flips shorter than ``min_turn_sec``.

    ``refine_with_change_detection`` already collapses ``A B A`` when the
    middle segment is <= 1.5s; this refinement goes further by:

    * absorbing ``A B A`` sandwiches where ``B`` is very short
      (``< min_turn_sec``) even when ``B`` happens to line up with a real
      turn boundary from the backend,
    * absorbing ``A B C`` patterns where ``B`` is shorter than
      ``min_turn_sec`` by folding ``B`` into whichever neighbour (``A`` or
      ``C``) is longer, because sub-second "islands" inside a run of real
      speech are almost always diarization glitches (laughter, coughs,
      interjections mis-attributed to a wrong cluster).

    We only operate on single-segment islands; multi-segment short runs are
    left for voice voting to resolve because they are more likely to
    represent a genuine, if short, speaker change.
    """

    ids = list(outcome.segment_speaker_ids)
    segments = outcome.segments
    if len(ids) < 3:
        outcome.stats.setdefault("min_turn_absorbed", 0)
        return outcome

    absorbed = 0
    for index in range(1, len(ids) - 1):
        prev_id = ids[index - 1]
        curr_id = ids[index]
        next_id = ids[index + 1]
        if curr_id == prev_id or curr_id == next_id:
            continue
        duration = segments[index].duration
        if duration >= min_turn_sec:
            continue
        if prev_id == next_id:
            ids[index] = prev_id
            absorbed += 1
            continue
        prev_duration = segments[index - 1].duration
        next_duration = segments[index + 1].duration
        ids[index] = prev_id if prev_duration >= next_duration else next_id
        absorbed += 1

    outcome.segment_speaker_ids = ids
    outcome.stats["min_turn_absorbed"] = absorbed
    return outcome


def _per_segment_embeddings(
    outcome: ProjectionOutcome,
    *,
    embedder: _EmbedderLike,
    waveform: np.ndarray,
    sample_rate: int,
    margin_sec: float,
    min_window_sec: float,
) -> list[np.ndarray | None]:
    audio_duration = len(waveform) / float(sample_rate) if sample_rate > 0 else 0.0
    embeddings: list[np.ndarray | None] = []
    for segment in outcome.segments:
        start = max(0.0, segment.start - margin_sec)
        end = min(audio_duration, segment.end + margin_sec)
        if end - start < min_window_sec:
            pad = (min_window_sec - (end - start)) / 2.0
            start = max(0.0, start - pad)
            end = min(audio_duration, end + pad)
        start_idx = max(0, int(start * sample_rate))
        end_idx = min(len(waveform), int(end * sample_rate))
        if end_idx <= start_idx:
            embeddings.append(None)
            continue
        clip = waveform[start_idx:end_idx].astype(np.float32)
        embedding = embedder.encode(clip, sample_rate)
        embeddings.append(embedding)
    return embeddings


def _median_centroids(
    embeddings: list[np.ndarray | None],
    speaker_ids: list[int],
) -> dict[int, np.ndarray]:
    buckets: dict[int, list[np.ndarray]] = {}
    for embedding, speaker_id in zip(embeddings, speaker_ids, strict=True):
        if embedding is None:
            continue
        buckets.setdefault(speaker_id, []).append(embedding)
    centroids: dict[int, np.ndarray] = {}
    for speaker_id, vectors in buckets.items():
        stacked = np.stack(vectors, axis=0)
        centroid = np.median(stacked, axis=0)
        norm = float(np.linalg.norm(centroid))
        if norm > 1e-12:
            centroid = centroid / norm
        centroids[speaker_id] = centroid.astype(np.float32)
    return centroids


def refine_with_voice_voting(
    outcome: ProjectionOutcome,
    *,
    audio_path: Path,
    embedder: _EmbedderLike,
    low_conf_threshold: float = DEFAULT_VOICE_VOTING_LOW_CONF,
    reassign_threshold: float = DEFAULT_VOICE_VOTING_REASSIGN,
    margin_sec: float = 0.2,
    min_window_sec: float = 1.6,
) -> ProjectionOutcome:
    """Reassign low-confidence segments using per-speaker median centroids.

    The CAM++ pipeline occasionally snaps a short segment to a wrong cluster
    when the target speaker only appears a couple of times (this is exactly
    what Dubai v4 showed: SPEAKER_03 fragmenting into 40 sub-1s islands).
    Voice voting works as follows:

    1. Extract a speaker embedding for every emitted segment using the
       configured embedder.
    2. Compute a ``median`` centroid per speaker id — medians are far more
       robust to outliers than means when a speaker has noisy/polluted
       segments mixed in.
    3. For every segment whose cosine similarity to *its own* centroid is
       below ``low_conf_threshold``, reassign it to the speaker whose
       centroid is most similar, *provided* the similarity exceeds
       ``reassign_threshold``.  If no candidate is confident enough the
       segment keeps its original label.

    The function is intentionally conservative: it never introduces new
    speaker ids, never reassigns segments with strong self-similarity, and
    always records an audit trail in ``outcome.stats`` so regressions are
    easy to spot.
    """

    stats = outcome.stats
    stats["voice_voting_reassigned"] = 0
    stats["voice_voting_low_conf"] = 0
    stats["voice_voting_coverage"] = 0.0

    if len(outcome.segments) < 2:
        return outcome

    waveform, sample_rate = sf.read(audio_path, dtype="float32", always_2d=False)
    if waveform.ndim == 2:
        waveform = waveform.mean(axis=1)
    waveform = waveform.astype(np.float32)

    embeddings = _per_segment_embeddings(
        outcome,
        embedder=embedder,
        waveform=waveform,
        sample_rate=int(sample_rate),
        margin_sec=margin_sec,
        min_window_sec=min_window_sec,
    )
    covered = sum(1 for embedding in embeddings if embedding is not None)
    if covered < 2:
        return outcome
    stats["voice_voting_coverage"] = round(covered / len(embeddings), 4)

    centroids = _median_centroids(embeddings, outcome.segment_speaker_ids)
    if len(centroids) < 2:
        return outcome

    updated_ids = list(outcome.segment_speaker_ids)
    low_conf = 0
    reassigned = 0
    for index, embedding in enumerate(embeddings):
        if embedding is None:
            continue
        current_id = updated_ids[index]
        own_centroid = centroids.get(current_id)
        own_sim = float(embedding @ own_centroid) if own_centroid is not None else -1.0
        if own_sim >= low_conf_threshold:
            continue
        low_conf += 1
        best_id = current_id
        best_sim = own_sim
        for speaker_id, centroid in centroids.items():
            if speaker_id == current_id:
                continue
            sim = float(embedding @ centroid)
            if sim > best_sim:
                best_sim = sim
                best_id = speaker_id
        if best_id != current_id and best_sim >= reassign_threshold:
            updated_ids[index] = best_id
            reassigned += 1

    outcome.segment_speaker_ids = updated_ids
    stats["voice_voting_low_conf"] = low_conf
    stats["voice_voting_reassigned"] = reassigned
    return outcome
