from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

import translip.server.atomic_tools as atomic_tools  # noqa: F401

from ..atomic_tools.job_manager import job_manager
from ..atomic_tools.registry import TOOL_REGISTRY, get_all_tools
from ..atomic_tools.schemas import ArtifactInfo, FileUploadResponse, JobResponse, ToolInfo

router = APIRouter(prefix="/api/atomic-tools", tags=["atomic-tools"])


@router.get("/tools", response_model=list[ToolInfo])
def list_tools() -> list[ToolInfo]:
    return [ToolInfo(**asdict(spec)) for spec in get_all_tools()]


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...)) -> FileUploadResponse:
    return await job_manager.save_upload(file)


@router.post("/{tool_id}/run", response_model=JobResponse)
async def run_tool(tool_id: str, params: dict, background_tasks: BackgroundTasks) -> JobResponse:
    if tool_id not in TOOL_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Unknown tool: {tool_id}")
    try:
        job = job_manager.create_job(tool_id, params)
    except RuntimeError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    background_tasks.add_task(job_manager.execute_job, job.job_id)
    return job


@router.get("/{tool_id}/jobs/{job_id}", response_model=JobResponse)
def get_job_status(tool_id: str, job_id: str) -> JobResponse:
    return job_manager.get_job(job_id)


@router.get("/{tool_id}/jobs/{job_id}/artifacts", response_model=list[ArtifactInfo])
def list_job_artifacts(tool_id: str, job_id: str) -> list[ArtifactInfo]:
    return job_manager.list_artifacts(job_id)


@router.get("/{tool_id}/jobs/{job_id}/artifacts/{artifact_path:path}")
def download_artifact(tool_id: str, job_id: str, artifact_path: str):
    path = job_manager.get_artifact_path(job_id, artifact_path)
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return FileResponse(path, filename=path.name)
