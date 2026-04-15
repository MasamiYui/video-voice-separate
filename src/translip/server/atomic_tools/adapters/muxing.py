from __future__ import annotations

from ..registry import ToolSpec, register_tool
from ..schemas import MuxingToolRequest
from . import ToolAdapter


class MuxingAdapter(ToolAdapter):
    def validate_params(self, params: dict) -> dict:
        return MuxingToolRequest(**params).model_dump()

    def run(self, params, input_dir, output_dir, on_progress):
        raise NotImplementedError("Muxing adapter is not implemented yet")


register_tool(
    ToolSpec(
        tool_id="muxing",
        name_zh="音视频合并",
        name_en="Video Audio Muxing",
        description_zh="将音频轨合并到视频中生成新的 MP4 文件",
        description_en="Mux an audio track into a video to produce a new MP4 file",
        category="video",
        icon="Clapperboard",
        accept_formats=[".mp4", ".mkv", ".mov", ".wav", ".mp3", ".m4a", ".aac"],
        max_file_size_mb=2000,
        max_files=2,
    ),
    MuxingAdapter,
)
