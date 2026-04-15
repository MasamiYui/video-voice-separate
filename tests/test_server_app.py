from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from translip.server import app as app_module


def test_frontend_dist_path_points_to_repo_frontend_dist() -> None:
    expected = Path(__file__).resolve().parents[1] / "frontend" / "dist"

    assert app_module._FRONTEND_DIST == expected
    assert app_module._FRONTEND_DIST.exists()


def test_frontend_spa_fallback_serves_index_html_for_task_routes() -> None:
    client = TestClient(app_module.app)

    response = client.get("/tasks/smoke-workflow-120")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<!doctype html>" in response.text.lower()
