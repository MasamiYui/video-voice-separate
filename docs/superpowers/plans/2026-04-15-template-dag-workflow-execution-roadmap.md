# Template DAG Workflow Execution Roadmap

**Goal:** 把现有 spec 和 implementation plan 收敛成一份可执行路线图，明确实际开发顺序、阶段边界、依赖约束、验收标准、demo 节点，以及失败时的回退策略。

**Related Docs:**
- Core implementation plan: `docs/superpowers/plans/2026-04-15-template-dag-workflow-core.md`
- Frontend graph plan: `docs/superpowers/plans/2026-04-15-frontend-workflow-graph-visualization.md`
- Workflow architecture spec: `docs/superpowers/specs/2026-04-15-template-dag-workflow-design.zh-CN.md`
- Frontend graph spec: `docs/superpowers/specs/2026-04-15-frontend-workflow-graph-visualization-design.zh-CN.md`

**Execution Principle:**
- 先做后端图模型和执行计划，再做 bridge，再做前端可视化。
- 先把“可运行的最小闭环”打通，再补充 OCR、擦字幕和动画体验。
- 每个阶段都必须有独立可验收结果，避免只有最终大合并时才知道哪里出问题。
- 优先保持现有 `stage1 -> task-e -> task-g` 主链可运行，新能力按兼容方式引入。

---

## Milestones

### Milestone 1: Graph Kernel And Template Resolution

**Scope:**
- 对应 core plan 的 Task 1-2。
- 建立 node registry、template registry、dependency closure、topological ordering。
- 在 request、CLI、types 中补充 `template_id`、delivery policy 和 workflow/node status 基础字段。

**Why first:**
- 这是整套 DAG 化的内核。
- 没有它，后面的 OCR/擦字幕 bridge 和前端执行图都没有统一语义基础。

**Entry Criteria:**
- 当前主链执行逻辑可运行。
- 模板 ID、required/optional 语义已经在文档层冻结。

**Exit Criteria:**
- 可以通过模板解析出确定执行子图和稳定拓扑序。
- 测试能验证 `asr-dub-basic`、`asr-dub+ocr-subs`、`asr-dub+ocr-subs+erase` 三类模板的展开结果。
- CLI 和 request schema 能接受模板与交付策略字段。

**Verification:**
- `uv run pytest -q tests/test_workflow_graph.py tests/test_cli.py`

**Demo Checkpoint:**
- 在本地打印某个模板的 resolved plan，能清楚看到节点顺序、group、required/optional 标记。

---

### Milestone 2: Node Execution Runtime And Graph Payloads

**Scope:**
- 对应 core plan 的 Task 3-4。
- 让 runner/monitor 从固定 stage 执行升级为 node plan 执行。
- 输出 workflow graph payload，供服务端接口和前端消费。

**Why second:**
- 这是后端运行态和前端图之间的桥。
- 只有执行计划和运行状态都切到 node 级别，前端执行图才有真实数据源。

**Dependencies:**
- 依赖 Milestone 1 的模板展开和节点注册表。

**Exit Criteria:**
- 兼容现有主链执行，不要求 OCR 节点已接入。
- 服务端可以返回模板展开后的图数据，包括 nodes、edges、workflow status。
- `cached`、`running`、`failed`、`skipped`、`partial_success` 有明确状态表达。

**Verification:**
- `uv run pytest -q tests/test_orchestration.py tests/test_server_graph.py`

**Demo Checkpoint:**
- 用 `asr-dub-basic` 发起一个任务，接口能返回执行图 payload，即使前端还没改完，也能从 API 看到节点状态变化。

---

### Milestone 3: OCR Detect And OCR Translate Bridge

**Scope:**
- 对应 core plan 的 Task 5。
- 接入 `ocr-detect` 和 `ocr-translate` 节点。
- 通过 bridge 调用本地参考仓库 `/Users/masamiyui/OpenSoureProjects/Forks/subtitle-ocr`。
- 生成标准化 `ocr_events.json`、OCR 翻译字幕 JSON/SRT、manifest。

**Dependencies:**
- 依赖 Milestone 1-2。
- 依赖本机可访问 OCR 参考仓库。

**Entry Checklist:**
- 明确 OCR bridge 的可调用入口。
- 路径通过 `ocr_project_root` 或等价配置注入，不在产品代码中写死绝对路径。

**Exit Criteria:**
- `ocr-detect` 可作为一级节点参与模板执行。
- `ocr-translate` 能消费 OCR 事件并产出展示字幕资产。
- `asr-dub+ocr-subs` 模板可以完成后端闭环。

**Verification:**
- `uv run pytest -q tests/test_orchestration.py::test_translate_ocr_events_writes_json_and_srt`
- 至少一次手工 smoke test，验证 OCR bridge 能输出标准资产目录。

**Demo Checkpoint:**
- 跑通 `asr-dub+ocr-subs`，拿到一份任务级 graph payload 和 OCR sidecar subtitle 产物。

---

### Milestone 4: Subtitle Erasure And Delivery Policy

**Scope:**
- 对应 core plan 的 Task 6。
- 接入 `subtitle-erase` 节点。
- 通过 bridge 调用本地参考仓库 `/Users/masamiyui/OpenSoureProjects/Forks/video-subtitle-erasure`。
- 让 delivery runner 基于显式 policy 选择 `original` 或 `clean_video` 作为视频底板。

**Dependencies:**
- 依赖 Milestone 3 的 `ocr-detect` 资产。

**Entry Checklist:**
- `subtitle-erase` 只消费显式 `ocr-detect` 产物，不做隐式 OCR。
- 擦字幕仓库调用入口和输出路径已经确认。

**Exit Criteria:**
- `subtitle-erase` 成为一级节点并支持 required/optional 语义。
- `clean_if_available` 策略可工作，失败时能退回原视频底板。
- `asr-dub+ocr-subs+erase` 模板能形成 partial success 或 full success 的正确结果。

**Verification:**
- `uv run pytest -q tests/test_delivery.py tests/test_orchestration.py`
- 至少一次手工 smoke test，验证 `clean_video.mp4` 能被 delivery 层识别并装配。

**Demo Checkpoint:**
- 跑通 `asr-dub+ocr-subs+erase`，展示两种情况：
  - 擦字幕成功时使用 clean video
  - 擦字幕失败时自动回退到 original video，但工作流仍可 partial success

---

### Milestone 5: Frontend Graph Data Layer And Static Graph

**Scope:**
- 对应 frontend plan 的 Task 1-2。
- 建立 workflow graph types、API calls、runtime store。
- 渲染静态 lane-based DAG 图，不要求先有完整动画。

**Why after backend core:**
- 前端必须依赖真实 graph payload，否则很容易先做出一套临时结构，后面再推翻。

**Dependencies:**
- 依赖 Milestone 2 的 graph payload 接口。

**Exit Criteria:**
- 新建任务页能展示模板预览图。
- 任务详情页能展示运行执行图。
- lane 分组、节点基础状态样式、边状态表达完成。

**Verification:**
- `cd frontend && npm test -- --run src/hooks/__tests__/useWorkflowRuntimeUpdates.test.tsx src/components/workflow/__tests__/WorkflowGraph.test.tsx`

**Demo Checkpoint:**
- 前端可以稳定展示当前模板的执行子图，并区分 audio spine、ocr subtitles、video cleanup、delivery 四条 lane。

---

### Milestone 6: Drill-Down, Motion, Runtime Polish

**Scope:**
- 对应 frontend plan 的 Task 3-5。
- 接入节点详情 drawer、SSE 增量更新、动画语义、reduced-motion 和移动端降级。

**Dependencies:**
- 依赖 Milestone 5 的静态图基础。
- 最佳效果依赖 Milestone 3-4 的 OCR/擦字幕节点都已跑通。

**Exit Criteria:**
- 运行中的任务可以持续显示执行图。
- 当前运行节点、活跃边、cached、failed、partial success 都有独立视觉表达。
- 点击节点可以看到日志、manifest、输入输出摘要。
- `prefers-reduced-motion` 下能正常降级。

**Verification:**
- `cd frontend && npm test -- --run src/components/workflow/__tests__/WorkflowNodeDrawer.test.tsx src/hooks/__tests__/useWorkflowRuntimeUpdates.test.tsx`
- 手工浏览器 smoke test，覆盖运行态、失败态、cached 态和 reduced-motion。

**Demo Checkpoint:**
- 任务运行中前端持续展示执行图，当前节点和边带状态动画，点击节点能看到详情 drawer。

---

## Recommended Execution Order

1. Milestone 1: Graph kernel and template resolution
2. Milestone 2: Node runtime and graph payloads
3. Milestone 3: OCR detect and OCR translate bridge
4. Milestone 4: Subtitle erasure and delivery policy
5. Milestone 5: Frontend graph data layer and static graph
6. Milestone 6: Drill-down, motion, and runtime polish

**Reasoning:**
- M1-M2 建立后端真实语义和接口。
- M3-M4 扩展新能力，但不打破已经成立的图执行框架。
- M5-M6 在真实接口和真实节点状态上做前端，返工最少。

---

## Parallelization Guidance

可以并行的部分：
- M2 后半段的 graph payload 定义，可以和前端 M5 的类型设计并行对齐。
- M3 的 OCR bridge 和 M5 的模板预览图可以部分并行，因为模板预览图不依赖 OCR 实际跑通。

不建议并行的部分：
- M1 和 M2 不建议拆开并行，因为 graph kernel 和 runtime 改动强耦合。
- M3 和 M4 不建议完全并行，因为 `subtitle-erase` 显式依赖 `ocr-detect` 资产协议。
- M5 和 M6 不建议同时做，因为先把静态图结构做稳，再加运动语义会更可控。

---

## Dependencies And Risks

### External Dependencies

- OCR 参考仓库：`/Users/masamiyui/OpenSoureProjects/Forks/subtitle-ocr`
- 字幕擦除参考仓库：`/Users/masamiyui/OpenSoureProjects/Forks/video-subtitle-erasure`
- 本机 Python 环境、依赖、CLI 入口必须可调用

### Main Risks

- 相邻仓库的 CLI 入口不稳定，导致 bridge 适配层反复返工。
- 现有 runner 假定固定 stage 顺序，改为 node plan 后兼容性问题集中暴露。
- 前端如果过早绑定临时接口，后面 graph payload 一调整就会重写。
- 动画如果建立在整图重绘上，会导致抖动和性能问题。

### Risk Controls

- 所有外部仓库路径都通过配置注入，不在业务逻辑里写死。
- graph payload 先定契约，再接前端。
- 先做静态 DAG 布局，再叠加动画，不用 force graph。
- 主链 `asr-dub-basic` 作为全程回归样板，确保改造过程中始终能跑。

---

## Rollback And Fallback Strategy

### Backend

- 如果 node plan runner 出现兼容性问题，优先保留 `asr-dub-basic` 的线性兼容路径。
- OCR bridge 未稳定前，不阻塞 `asr-dub-basic` 主模板交付。
- `subtitle-erase` 失败时回退到 original video，工作流状态允许 `partial_success`。

### Frontend

- 如果运行态图还不稳定，先只上线模板预览图和静态任务图。
- 如果动画表现不稳定，保留静态状态样式，先不上流动边和复杂 motion。
- 如果 drawer 信息不完整，先展示节点状态、日志路径、manifest 路径三项最小内容。

---

## Definition Of Done For The Whole Initiative

- 用户可以选择技术组合模板创建任务。
- 后端按模板展开成受约束 DAG 子图执行，而不是固定 stage 列表。
- `ocr-detect`、`ocr-translate`、`subtitle-erase` 都是一级节点。
- `required` / `optional` 语义可正确工作，并支持 `partial_success`。
- `task-g` 仅作为装配层工作，不隐式触发缺失节点。
- 前端默认展示当前模板展开后的执行子图。
- 任务运行中可持续看到执行图，并支持节点 drill-down。
- OCR 与字幕擦除的 bridge 使用相邻仓库作为参考接入来源，但仓库路径可配置。

---

## Immediate Next Step

从 Milestone 1 开始，优先实现：
- `src/translip/orchestration/nodes.py`
- `src/translip/orchestration/templates.py`
- `src/translip/orchestration/graph.py`
- `tests/test_workflow_graph.py`

先把模板展开和拓扑排序做对，再进入 runtime 改造。
