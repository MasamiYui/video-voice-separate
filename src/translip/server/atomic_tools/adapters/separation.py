from __future__ import annotations

from ..registry import ToolSpec, register_tool
from ..schemas import SeparationToolRequest
from . import ToolAdapter


class SeparationAdapter(ToolAdapter):
    def validate_params(self, params: dict) -> dict:
        return SeparationToolRequest(**params).model_dump()

    def run(self, params, input_dir, output_dir, on_progress):
        raise NotImplementedError("Separation adapter is not implemented yet")


register_tool(
    ToolSpec(
        tool_id="separation",
        name_zh="人声/背景分离",
        name_en="Audio Separation",
        description_zh="从音视频中分离人声轨与背景轨",
        description_en="Separate vocal and background tracks from audio/video",
        category="audio",
        icon="AudioLines",
        accept_formats=[".mp4", ".mkv", ".avi", ".mov", ".wav", ".mp3", ".flac", ".m4a", ".ogg"],
        max_file_size_mb=500,
        max_files=1,
    ),
    SeparationAdapter,
)
