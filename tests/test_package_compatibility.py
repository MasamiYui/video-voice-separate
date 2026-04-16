from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"


def _run_without_site_packages(code: str) -> subprocess.CompletedProcess[str]:
    env = dict(os.environ)
    env["PYTHONPATH"] = str(SRC_ROOT)
    return subprocess.run(
        [sys.executable, "-S", "-c", code],
        cwd=PROJECT_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_translip_config_can_be_imported_without_optional_dependencies() -> None:
    result = _run_without_site_packages(
        "from translip.config import DEFAULT_SUBTITLE_FONT_CJK; print(DEFAULT_SUBTITLE_FONT_CJK)"
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "Noto Sans CJK SC"


def test_translip_top_level_types_can_be_imported_without_optional_dependencies() -> None:
    result = _run_without_site_packages(
        "from translip import SeparationRequest, SeparationResult; print(SeparationRequest.__name__); print(SeparationResult.__name__)"
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == ["SeparationRequest", "SeparationResult"]


def test_legacy_entrypoints_still_resolve_to_translip_modules() -> None:
    from translip.cli import build_parser, main
    from translip.server.app import app, run_server
    from video_voice_separate.cli import build_parser as legacy_build_parser
    from video_voice_separate.cli import main as legacy_main
    from video_voice_separate.server.app import app as legacy_app
    from video_voice_separate.server.app import run_server as legacy_run_server

    assert legacy_build_parser is build_parser
    assert legacy_main is main
    assert legacy_app is app
    assert legacy_run_server is run_server
