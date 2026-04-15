# Template DAG Workflow Progress

## Completed

### Milestone 1

- Added workflow node registry and template registry:
  - `src/translip/orchestration/nodes.py`
  - `src/translip/orchestration/templates.py`
  - `src/translip/orchestration/graph.py`
- Added deterministic template plan resolution with `required` / `optional` metadata.
- Extended `PipelineRequest` with:
  - `template_id`
  - `delivery_policy`
- Added CLI inputs for:
  - `--template`
  - `--video-source`
  - `--audio-source`
  - `--subtitle-source`
- Added matching server config schema fields.

### Milestone 2

- Refactored pipeline execution from fixed stage sequence to template-resolved node plan execution.
- Preserved compatibility with `run_from_stage` / `run_to_stage` by filtering node execution through sequence hints.
- Added `partial_success` semantics for optional node failures.
- Added workflow manifest/report duplication:
  - legacy: `pipeline-manifest.json`, `pipeline-report.json`
  - new: `workflow-manifest.json`, `workflow-report.json`
- Added workflow graph export helper:
  - `src/translip/orchestration/graph_export.py`
- Added task graph route:
  - `GET /api/tasks/{task_id}/graph`
- Updated task manager to:
  - build `PipelineRequest` with template and delivery policy
  - pre-create task rows from resolved template nodes
  - sync node payloads from `nodes` or legacy `stages`
  - treat `partial_success` as a terminal workflow state

## Verification Run

The following commands were run after implementation:

```bash
uv run pytest -q tests/test_workflow_graph.py tests/test_cli.py::test_cli_run_pipeline_parser_accepts_template_and_policy tests/test_orchestration.py::test_build_pipeline_request_keeps_template_and_delivery_policy
uv run pytest -q tests/test_cli.py tests/test_orchestration.py
uv run pytest -q tests/test_orchestration.py::test_run_pipeline_executes_nodes_from_template_plan tests/test_orchestration.py::test_run_pipeline_marks_partial_success_when_optional_node_fails
uv run pytest -q tests/test_orchestration.py tests/test_cli.py tests/test_delivery.py
uv run pytest -q tests/test_server_graph.py
uv run pytest -q tests/test_orchestration.py tests/test_cli.py tests/test_delivery.py tests/test_server_graph.py tests/test_server_app.py
```

## Current Status

- Core graph kernel: complete
- Node-plan runner: complete
- Workflow graph payload and route: complete
- OCR detect / OCR translate bridge: not started
- Subtitle erasure bridge: not started
- Frontend workflow graph: not started

## Next Focus

Move to OCR integration:

1. Bridge `/Users/masamiyui/OpenSoureProjects/Forks/subtitle-ocr`
2. Add `ocr-detect` node execution and normalized OCR assets
3. Add `ocr-translate` subtitle generation
4. Run unit tests plus a local smoke test against sample media before touching subtitle erasure
