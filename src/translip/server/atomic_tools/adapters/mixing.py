from __future__ import annotations

from ..registry import ToolSpec, register_tool
from ..schemas import MixingToolRequest
from . import ToolAdapter


class MixingAdapter(ToolAdapter):
    def validate_params(self, params: dict) -> dict:
        return MixingToolRequest(**params).model_dump()

    def run(self, params, input_dir, output_dir, on_progress):
        raise NotImplementedError("Mixing adapter is not implemented yet")


register_tool(
    ToolSpec(
        tool_id="mixing",
        name_zh="音频混合",
        name_en="Audio Mixing",
        description_zh="将人声轨和背景轨混合为单一音频文件",
        description_en="Mix a vocal track and a background track into one output",
        category="audio",
        icon="Music",
        accept_formats=[".wav", ".mp3", ".flac", ".m4a", ".ogg"],
        max_file_size_mb=500,
        max_files=2,
    ),
    MixingAdapter,
)
