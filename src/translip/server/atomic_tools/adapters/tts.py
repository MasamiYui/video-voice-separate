from __future__ import annotations

from ..registry import ToolSpec, register_tool
from ..schemas import TtsToolRequest
from . import ToolAdapter


class TtsAdapter(ToolAdapter):
    def validate_params(self, params: dict) -> dict:
        return TtsToolRequest(**params).model_dump()

    def run(self, params, input_dir, output_dir, on_progress):
        raise NotImplementedError("TTS adapter is not implemented yet")


register_tool(
    ToolSpec(
        tool_id="tts",
        name_zh="语音合成",
        name_en="Text to Speech",
        description_zh="将文本转为语音，并可选参考音色克隆",
        description_en="Synthesize speech from text with optional reference voice cloning",
        category="speech",
        icon="Mic",
        accept_formats=[".wav", ".mp3", ".flac", ".m4a", ".ogg", ".txt"],
        max_file_size_mb=100,
        max_files=1,
    ),
    TtsAdapter,
)
