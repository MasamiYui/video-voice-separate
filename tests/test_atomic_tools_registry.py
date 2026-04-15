from __future__ import annotations


def test_atomic_tools_registry_exposes_all_seven_tools() -> None:
    import translip.server.atomic_tools as atomic_tools  # noqa: F401
    from translip.server.atomic_tools.registry import get_all_tools

    tools = get_all_tools()

    assert [tool.tool_id for tool in tools] == [
        "separation",
        "mixing",
        "transcription",
        "translation",
        "tts",
        "probe",
        "muxing",
    ]
    assert {tool.category for tool in tools} == {"audio", "speech", "video"}
    assert next(tool for tool in tools if tool.tool_id == "probe").max_file_size_mb == 2000
