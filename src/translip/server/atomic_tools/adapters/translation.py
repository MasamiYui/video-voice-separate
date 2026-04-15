from __future__ import annotations

from ..registry import ToolSpec, register_tool
from ..schemas import TranslationToolRequest
from . import ToolAdapter


class TranslationAdapter(ToolAdapter):
    def validate_params(self, params: dict) -> dict:
        return TranslationToolRequest(**params).model_dump()

    def run(self, params, input_dir, output_dir, on_progress):
        raise NotImplementedError("Translation adapter is not implemented yet")


register_tool(
    ToolSpec(
        tool_id="translation",
        name_zh="文本翻译",
        name_en="Text Translation",
        description_zh="翻译文本或字幕文件",
        description_en="Translate plain text or subtitle files",
        category="speech",
        icon="Languages",
        accept_formats=[".txt", ".srt", ".json"],
        max_file_size_mb=20,
        max_files=2,
    ),
    TranslationAdapter,
)
