# Atomic Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Atomic Tools feature set across FastAPI and React, including reusable uploads/artifacts, seven tool workflows, unit tests, and Playwright verification.

**Architecture:** Add a new backend `translip.server.atomic_tools` subsystem that wraps existing runner/helper modules with thin adapters and an in-memory job manager rooted in `CACHE_ROOT/atomic-tools`. Add a new frontend `/tools` experience with shared upload/run/poll/result primitives, tool-specific parameter forms, and cross-tool artifact reuse using backend-issued `file_id` references.

**Tech Stack:** Python 3.11, FastAPI, Pydantic, pytest, React 19, React Router, TanStack Query, Vitest, Playwright CLI, ffmpeg helpers, existing translip pipeline/transcription/translation/dubbing/rendering modules

---

### Task 1: Define backend Atomic Tools contracts and failing API tests

**Files:**
- Create: `tests/test_atomic_tools_registry.py`
- Create: `tests/test_atomic_tools_job_manager.py`
- Create: `tests/test_atomic_tools_api.py`
- Create: `src/translip/server/atomic_tools/__init__.py`
- Create: `src/translip/server/atomic_tools/registry.py`
- Create: `src/translip/server/atomic_tools/schemas.py`
- Create: `src/translip/server/atomic_tools/job_manager.py`
- Create: `src/translip/server/routes/atomic_tools.py`
- Modify: `src/translip/server/app.py`

- [ ] **Step 1: Write failing registry/API tests**

```python
def test_atomic_tools_list_exposes_all_seven_tools():
    client = TestClient(app)
    response = client.get("/api/atomic-tools/tools")
    assert response.status_code == 200
    assert {item["tool_id"] for item in response.json()} == {
        "separation",
        "mixing",
        "transcription",
        "translation",
        "tts",
        "probe",
        "muxing",
    }
```

- [ ] **Step 2: Run backend tests to verify they fail**

Run: `uv run pytest tests/test_atomic_tools_registry.py tests/test_atomic_tools_job_manager.py tests/test_atomic_tools_api.py -q`
Expected: FAIL with missing modules or missing `/api/atomic-tools/*` routes.

- [ ] **Step 3: Implement minimal registry, schemas, job manager, and route mounting**

```python
@router.get("/tools", response_model=list[ToolInfo])
def list_tools() -> list[ToolInfo]:
    return [ToolInfo(**spec.model_dump()) for spec in get_all_tools()]
```

- [ ] **Step 4: Run the same backend tests to verify the core API passes**

Run: `uv run pytest tests/test_atomic_tools_registry.py tests/test_atomic_tools_job_manager.py tests/test_atomic_tools_api.py -q`
Expected: PASS for registry/job lifecycle/API wiring tests.

- [ ] **Step 5: Commit**

```bash
git add tests/test_atomic_tools_registry.py tests/test_atomic_tools_job_manager.py tests/test_atomic_tools_api.py src/translip/server/atomic_tools src/translip/server/routes/atomic_tools.py src/translip/server/app.py
git commit -m "feat: add atomic tools backend core"
```

### Task 2: Add adapter coverage and implement all seven backend tools

**Files:**
- Create: `src/translip/server/atomic_tools/adapters/__init__.py`
- Create: `src/translip/server/atomic_tools/adapters/separation.py`
- Create: `src/translip/server/atomic_tools/adapters/mixing.py`
- Create: `src/translip/server/atomic_tools/adapters/transcription.py`
- Create: `src/translip/server/atomic_tools/adapters/translation.py`
- Create: `src/translip/server/atomic_tools/adapters/tts.py`
- Create: `src/translip/server/atomic_tools/adapters/probe.py`
- Create: `src/translip/server/atomic_tools/adapters/muxing.py`
- Create: `tests/test_atomic_tools_adapters/test_separation_adapter.py`
- Create: `tests/test_atomic_tools_adapters/test_mixing_adapter.py`
- Create: `tests/test_atomic_tools_adapters/test_transcription_adapter.py`
- Create: `tests/test_atomic_tools_adapters/test_translation_adapter.py`
- Create: `tests/test_atomic_tools_adapters/test_tts_adapter.py`
- Create: `tests/test_atomic_tools_adapters/test_probe_adapter.py`
- Create: `tests/test_atomic_tools_adapters/test_muxing_adapter.py`

- [ ] **Step 1: Write failing adapter tests with monkeypatched runners/helpers**

```python
def test_translation_adapter_builds_temp_segments_and_profiles(tmp_path, monkeypatch):
    adapter = TranslationAdapter()
    captured = {}
    def fake_translate(request, *, backend_override=None):
        captured["request"] = request
        ...
    monkeypatch.setattr("translip.server.atomic_tools.adapters.translation.translate_script", fake_translate)
    ...
```

- [ ] **Step 2: Run adapter tests to verify they fail**

Run: `uv run pytest tests/test_atomic_tools_adapters -q`
Expected: FAIL because adapters do not exist yet.

- [ ] **Step 3: Implement adapter layer with thin reuse boundaries**

```python
class ProbeAdapter(ToolAdapter):
    def run(self, params, input_dir, output_dir, on_progress):
        input_file = self.require_input(input_dir, "file")
        on_progress(50.0, "probing")
        info = probe_media(input_file)
        return {...}
```

- [ ] **Step 4: Run adapter tests and the atomic API tests**

Run: `uv run pytest tests/test_atomic_tools_adapters tests/test_atomic_tools_api.py -q`
Expected: PASS with mocked runners/helpers only.

- [ ] **Step 5: Commit**

```bash
git add src/translip/server/atomic_tools/adapters tests/test_atomic_tools_adapters
git commit -m "feat: implement atomic tool adapters"
```

### Task 3: Add frontend Atomic Tools data layer and failing UI tests

**Files:**
- Create: `frontend/src/types/atomic-tools.ts`
- Create: `frontend/src/api/atomic-tools.ts`
- Create: `frontend/src/hooks/useAtomicTool.ts`
- Create: `frontend/src/test/atomic-tools/useAtomicTool.test.ts`
- Modify: `frontend/src/test/setup.ts`

- [ ] **Step 1: Write failing hook tests for upload, polling, and reset**

```tsx
it("polls until the atomic job completes and then loads artifacts", async () => {
  ...
  expect(result.current.job?.status).toBe("completed")
  expect(result.current.artifacts).toHaveLength(2)
})
```

- [ ] **Step 2: Run the hook test to verify it fails**

Run: `cd frontend && npm test -- --run src/test/atomic-tools/useAtomicTool.test.ts`
Expected: FAIL with missing module/import errors.

- [ ] **Step 3: Implement types, API client, and shared hook**

```ts
export function useAtomicTool({ toolId, pollInterval = 1000 }: UseAtomicToolOptions) {
  const [job, setJob] = useState<AtomicJob | null>(null)
  ...
}
```

- [ ] **Step 4: Run the hook test again**

Run: `cd frontend && npm test -- --run src/test/atomic-tools/useAtomicTool.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/atomic-tools.ts frontend/src/api/atomic-tools.ts frontend/src/hooks/useAtomicTool.ts frontend/src/test/atomic-tools/useAtomicTool.test.ts frontend/src/test/setup.ts
git commit -m "feat: add atomic tools frontend data layer"
```

### Task 4: Build Atomic Tools pages/components/navigation with component tests

**Files:**
- Create: `frontend/src/pages/ToolListPage.tsx`
- Create: `frontend/src/pages/ToolPage.tsx`
- Create: `frontend/src/components/atomic-tools/ToolCard.tsx`
- Create: `frontend/src/components/atomic-tools/ToolLayout.tsx`
- Create: `frontend/src/components/atomic-tools/FileUploadZone.tsx`
- Create: `frontend/src/components/atomic-tools/ResultPanel.tsx`
- Create: `frontend/src/components/atomic-tools/ToolProgressBar.tsx`
- Create: `frontend/src/components/atomic-tools/CrossToolAction.tsx`
- Create: `frontend/src/components/atomic-tools/tool-configs/*.tsx`
- Create: `frontend/src/test/atomic-tools/ToolListPage.test.tsx`
- Create: `frontend/src/test/atomic-tools/FileUploadZone.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/i18n/messages.ts`

- [ ] **Step 1: Write failing page/component tests**

```tsx
it("renders the tools navigation group and tool list page cards", async () => {
  ...
  expect(screen.getByRole("link", { name: /人声\\/背景分离/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the frontend Atomic Tools test suite to verify it fails**

Run: `cd frontend && npm test -- --run src/test/atomic-tools/ToolListPage.test.tsx src/test/atomic-tools/FileUploadZone.test.tsx src/components/layout/__tests__/Sidebar.test.tsx`
Expected: FAIL because routes/messages/components are missing.

- [ ] **Step 3: Implement routes, sidebar group, pages, and reusable UI**

```tsx
<Route path="/tools" element={<ToolListPage />} />
<Route path="/tools/:toolId" element={<ToolPage />} />
```

- [ ] **Step 4: Run the targeted frontend tests again**

Run: `cd frontend && npm test -- --run src/test/atomic-tools/ToolListPage.test.tsx src/test/atomic-tools/FileUploadZone.test.tsx src/components/layout/__tests__/Sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages frontend/src/components/atomic-tools frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx frontend/src/i18n/messages.ts frontend/src/test/atomic-tools
git commit -m "feat: add atomic tools UI"
```

### Task 5: Integrate real backend/frontend behavior and regression suites

**Files:**
- Modify: `tests/test_atomic_tools_api.py`
- Modify: `frontend/src/test/atomic-tools/useAtomicTool.test.ts`
- Modify: `frontend/src/test/atomic-tools/ToolListPage.test.tsx`
- Modify: `frontend/src/test/atomic-tools/FileUploadZone.test.tsx`
- Modify: any adapter/job manager/frontend files needed from earlier tasks

- [ ] **Step 1: Write failing regression tests for cross-tool reuse and result rendering**

```python
def test_artifacts_are_re_registered_as_reusable_file_ids(...):
    ...
    assert artifacts[0]["file_id"]
```

- [ ] **Step 2: Run the focused backend/frontend suites**

Run: `uv run pytest tests/test_atomic_tools_registry.py tests/test_atomic_tools_job_manager.py tests/test_atomic_tools_api.py tests/test_atomic_tools_adapters -q && cd frontend && npm test -- --run src/test/atomic-tools/useAtomicTool.test.ts src/test/atomic-tools/ToolListPage.test.tsx src/test/atomic-tools/FileUploadZone.test.tsx`
Expected: at least one new regression failure.

- [ ] **Step 3: Implement minimal fixes for artifact reuse, query-param prefill, and UI regressions**

```ts
const prefilledFileId = searchParams.get("file_id")
if (prefilledFileId) {
  setSelectedInput({ fileId: prefilledFileId, filename: searchParams.get("filename") ?? "artifact" })
}
```

- [ ] **Step 4: Re-run the focused suites**

Run: `uv run pytest tests/test_atomic_tools_registry.py tests/test_atomic_tools_job_manager.py tests/test_atomic_tools_api.py tests/test_atomic_tools_adapters -q && cd frontend && npm test -- --run src/test/atomic-tools/useAtomicTool.test.ts src/test/atomic-tools/ToolListPage.test.tsx src/test/atomic-tools/FileUploadZone.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/test_atomic_tools_registry.py tests/test_atomic_tools_job_manager.py tests/test_atomic_tools_api.py tests/test_atomic_tools_adapters frontend/src/test/atomic-tools
git commit -m "test: cover atomic tool regressions"
```

### Task 6: Full verification with repo tests, build, and Playwright on the real app

**Files:**
- Modify only if verification exposes bugs
- Capture artifacts under: `output/playwright/`

- [ ] **Step 1: Run backend verification**

Run: `uv run pytest tests/test_atomic_tools_registry.py tests/test_atomic_tools_job_manager.py tests/test_atomic_tools_api.py tests/test_atomic_tools_adapters tests/test_server_app.py tests/test_server_graph.py -q`
Expected: PASS.

- [ ] **Step 2: Run frontend verification**

Run: `cd frontend && npm test -- --run src/test/atomic-tools/useAtomicTool.test.ts src/test/atomic-tools/ToolListPage.test.tsx src/test/atomic-tools/FileUploadZone.test.tsx src/components/layout/__tests__/Sidebar.test.tsx && npm run build`
Expected: tests PASS, build exits 0.

- [ ] **Step 3: Run the real local app**

```bash
uv run uvicorn translip.server.app:app --host 127.0.0.1 --port 8765
cd frontend && npm run dev -- --host 127.0.0.1 --port 5173
```

- [ ] **Step 4: Verify Atomic Tools flows with Playwright using `test_video/我在迪拜等你.mp4`**

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" open http://127.0.0.1:5173 --headed
```

Expected manual coverage:
- `/tools` renders all seven tools
- `probe` can upload `test_video/我在迪拜等你.mp4` and show media metadata
- `separation` accepts the same video and starts a job
- result panel exposes downloads and cross-tool action(s)

- [ ] **Step 5: Fix any bugs found, rerun verification, and prepare final status**

Run after fixes: same commands as Steps 1-4.
Expected: green verification plus captured screenshots under `output/playwright/`.
