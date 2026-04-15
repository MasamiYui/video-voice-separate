from __future__ import annotations

from ..registry import ToolSpec, register_tool
from ..schemas import TranscriptionToolRequest
from . import ToolAdapter


class TranscriptionAdapter(ToolAdapter):
    def validate_params(self, params: dict) -> dict:
        return TranscriptionToolRequest(**params).model_dump()

    def run(self, params, input_dir, output_dir, on_progress):
        raise NotImplementedError("Transcription adapter is not implemented yet")


register_tool(
    ToolSpec(
        tool_id="transcription",
        name_zh="语音转文字",
        name_en="Speech to Text",
        description_zh="语音识别并生成带时间戳的文字与字幕",
        description_en="Transcribe audio/video into timestamped text and subtitles",
        category="speech",
        icon="MessageSquareText",
        accept_formats=[".mp4", ".mkv", ".avi", ".mov", ".wav", ".mp3", ".flac", ".m4a", ".ogg"],
        max_file_size_mb=500,
        max_files=1,
    ),
    TranscriptionAdapter,
)
