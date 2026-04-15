from __future__ import annotations

import asyncio
import io
from pathlib import Path

from fastapi import UploadFile


class FakeAdapter:
    def __init__(self, *, should_fail: bool = False) -> None:
        self.should_fail = should_fail

    def validate_params(self, params: dict) -> dict:
        return dict(params)

    def run(self, params: dict, input_dir: Path, output_dir: Path, on_progress) -> dict:
        input_file = next(path for path in input_dir.rglob("*") if path.is_file())
        on_progress(35.0, "fake-running")
        if self.should_fail:
            raise RuntimeError("adapter boom")
        output_path = output_dir / "result.txt"
        output_path.write_text(input_file.read_text(encoding="utf-8").upper(), encoding="utf-8")
        return {
            "echo_file": output_path.name,
            "input_name": input_file.name,
        }


def test_job_manager_executes_job_and_registers_artifacts(tmp_path: Path) -> None:
    from translip.server.atomic_tools.job_manager import JobManager

    manager = JobManager(root=tmp_path / "atomic-tools")
    manager.register_adapter("probe", FakeAdapter())

    upload = asyncio.run(
        manager.save_upload(
            UploadFile(
                filename="sample.txt",
                file=io.BytesIO(b"hello atomic tools"),
                headers={"content-type": "text/plain"},
            )
        )
    )

    job = manager.create_job("probe", {"file_id": upload.file_id})
    asyncio.run(manager.execute_job(job.job_id))

    stored_job = manager.get_job(job.job_id)
    artifacts = manager.list_artifacts(job.job_id)

    assert stored_job.status == "completed"
    assert stored_job.progress_percent == 100.0
    assert stored_job.result == {
        "echo_file": "result.txt",
        "input_name": "sample.txt",
    }
    assert len(artifacts) == 1
    assert artifacts[0].filename == "result.txt"
    assert artifacts[0].file_id is not None
    artifact_path = manager.get_artifact_path(job.job_id, "result.txt")
    assert artifact_path is not None
    assert artifact_path.read_text(encoding="utf-8") == "HELLO ATOMIC TOOLS"


def test_job_manager_marks_job_failed_when_adapter_raises(tmp_path: Path) -> None:
    from translip.server.atomic_tools.job_manager import JobManager

    manager = JobManager(root=tmp_path / "atomic-tools")
    manager.register_adapter("probe", FakeAdapter(should_fail=True))

    upload = asyncio.run(
        manager.save_upload(
            UploadFile(
                filename="sample.txt",
                file=io.BytesIO(b"broken"),
                headers={"content-type": "text/plain"},
            )
        )
    )

    job = manager.create_job("probe", {"file_id": upload.file_id})
    asyncio.run(manager.execute_job(job.job_id))

    stored_job = manager.get_job(job.job_id)
    assert stored_job.status == "failed"
    assert stored_job.error_message == "adapter boom"
