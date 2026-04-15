from __future__ import annotations

from ..registry import ToolSpec, register_tool
from ..schemas import ProbeToolRequest
from . import ToolAdapter


class ProbeAdapter(ToolAdapter):
    def validate_params(self, params: dict) -> dict:
        return ProbeToolRequest(**params).model_dump()

    def run(self, params, input_dir, output_dir, on_progress):
        raise NotImplementedError("Probe adapter is not implemented yet")


register_tool(
    ToolSpec(
        tool_id="probe",
        name_zh="媒体信息探测",
        name_en="Media Probe",
        description_zh="检测音视频文件的格式、时长和编码信息",
        description_en="Inspect media format, duration, and stream metadata",
        category="video",
        icon="ScanSearch",
        accept_formats=[".mp4", ".mkv", ".avi", ".mov", ".wav", ".mp3", ".flac", ".m4a", ".ogg", ".webm", ".ts"],
        max_file_size_mb=2000,
        max_files=1,
    ),
    ProbeAdapter,
)
