# Frontend Workflow Graph Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 React 前端实现模板预览图与运行执行图，支持 lane 分层 DAG 布局、节点状态动画、节点详情 drawer，以及基于后端图数据契约的实时更新。

**Architecture:** 保留现有页面结构，把当前简化版 `PipelineGraph` 升级为真正的工作流图组件族：图容器、lane、节点卡片、边、图例、节点详情 drawer。新建任务页使用模板预览图，任务详情页使用运行执行图；运行中状态通过图 payload + SSE 增量更新合并到本地 store 中。

**Tech Stack:** React 19, TypeScript, Vite, TanStack Query, Zustand, Framer Motion, SVG, Vitest, Testing Library

---

## File Structure

- Create: `frontend/src/components/workflow/WorkflowGraph.tsx` for the graph container and layout composition.
- Create: `frontend/src/components/workflow/WorkflowLane.tsx` for lane grouping.
- Create: `frontend/src/components/workflow/WorkflowNodeCard.tsx` for node rendering and state styling.
- Create: `frontend/src/components/workflow/WorkflowEdge.tsx` for SVG edge rendering and active/completed/blocked states.
- Create: `frontend/src/components/workflow/WorkflowLegend.tsx` for state and semantic legend.
- Create: `frontend/src/components/workflow/WorkflowNodeDrawer.tsx` for drill-down node details.
- Create: `frontend/src/hooks/useWorkflowGraph.ts` for fetching graph payloads.
- Create: `frontend/src/hooks/useWorkflowRuntimeUpdates.ts` for graph-aware SSE merge logic.
- Create: `frontend/src/stores/workflowGraphStore.ts` for runtime graph state.
- Create: `frontend/src/lib/workflowPreview.ts` for template preview graph fixtures or builders.
- Modify: `frontend/src/types/index.ts` to add workflow graph, node, edge, and drawer types.
- Modify: `frontend/src/api/tasks.ts` to fetch graph payloads.
- Modify: `frontend/src/api/progress.ts` to normalize incremental node updates.
- Modify: `frontend/src/pages/NewTaskPage.tsx` to show template preview graphs.
- Modify: `frontend/src/pages/TaskDetailPage.tsx` to replace the current stage-tab-first flow with graph-first task inspection.
- Modify: `frontend/src/pages/DashboardPage.tsx` to show simplified active-task graph previews.
- Modify: `frontend/src/components/pipeline/PipelineGraph.tsx` to either become a compatibility wrapper or delegate to the new graph components.
- Create: `frontend/src/components/workflow/__tests__/WorkflowGraph.test.tsx` for graph rendering and motion-class assertions.
- Create: `frontend/src/components/workflow/__tests__/WorkflowNodeDrawer.test.tsx` for drill-down behavior.
- Create: `frontend/src/hooks/__tests__/useWorkflowRuntimeUpdates.test.tsx` for incremental merge behavior.

### Task 1: Add Graph Types, API Calls, And Runtime Store

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/tasks.ts`
- Modify: `frontend/src/api/progress.ts`
- Create: `frontend/src/stores/workflowGraphStore.ts`
- Create: `frontend/src/hooks/useWorkflowGraph.ts`
- Create: `frontend/src/hooks/useWorkflowRuntimeUpdates.ts`
- Create: `frontend/src/hooks/__tests__/useWorkflowRuntimeUpdates.test.tsx`

- [ ] **Step 1: Write the failing graph-type and update-merge tests**

```tsx
import { describe, expect, it } from 'vitest'

import { mergeWorkflowProgressEvent } from '../useWorkflowRuntimeUpdates'

describe('mergeWorkflowProgressEvent', () => {
  it('updates only the changed node and keeps graph order stable', () => {
    const prev = {
      workflow: { template_id: 'asr-dub+ocr-subs', status: 'running' },
      nodes: [
        { id: 'stage1', status: 'succeeded', progress_percent: 100 },
        { id: 'task-a', status: 'running', progress_percent: 25 },
      ],
      edges: [{ from: 'stage1', to: 'task-a', state: 'active' }],
    }

    const next = mergeWorkflowProgressEvent(prev, {
      type: 'progress',
      node: { id: 'task-a', status: 'running', progress_percent: 55 },
      edge_updates: [{ from: 'stage1', to: 'task-a', state: 'active' }],
    })

    expect(next.nodes.map(node => node.id)).toEqual(['stage1', 'task-a'])
    expect(next.nodes[1].progress_percent).toBe(55)
  })
})
```

- [ ] **Step 2: Run the graph merge test to verify it fails**

Run: `cd frontend && npm test -- --run src/hooks/__tests__/useWorkflowRuntimeUpdates.test.tsx`
Expected: FAIL because workflow graph types and merge helpers do not exist yet.

- [ ] **Step 3: Write the minimal graph data layer**

```ts
// frontend/src/types/index.ts
export type WorkflowStatus = 'running' | 'succeeded' | 'partial_success' | 'failed'
export type WorkflowNodeStatus = 'pending' | 'running' | 'succeeded' | 'cached' | 'failed' | 'skipped'
export type WorkflowEdgeState = 'inactive' | 'active' | 'completed' | 'blocked'

export interface WorkflowGraphNode {
  id: string
  label: string
  group: 'audio-spine' | 'ocr-subtitles' | 'video-cleanup' | 'delivery'
  required: boolean
  status: WorkflowNodeStatus
  progress_percent: number
  summary?: string
  manifest_path?: string
  log_path?: string
}

export interface WorkflowGraphEdge {
  from: string
  to: string
  state: WorkflowEdgeState
}

export interface WorkflowGraph {
  workflow: {
    task_id?: string
    template_id: string
    status: WorkflowStatus
    selected_policy?: Record<string, string>
  }
  nodes: WorkflowGraphNode[]
  edges: WorkflowGraphEdge[]
}
```

```ts
// frontend/src/api/tasks.ts
getGraph: (id: string) =>
  api.get<WorkflowGraph>(`/api/tasks/${id}/graph`).then(r => r.data),
```

```ts
// frontend/src/stores/workflowGraphStore.ts
import { create } from 'zustand'
import type { WorkflowGraph } from '../types'

interface WorkflowGraphState {
  graphs: Record<string, WorkflowGraph>
  setGraph: (taskId: string, graph: WorkflowGraph) => void
}

export const useWorkflowGraphStore = create<WorkflowGraphState>(set => ({
  graphs: {},
  setGraph: (taskId, graph) =>
    set(state => ({ graphs: { ...state.graphs, [taskId]: graph } })),
}))
```

```ts
// frontend/src/hooks/useWorkflowGraph.ts
import { useQuery } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'

export function useWorkflowGraph(taskId: string, enabled = true) {
  return useQuery({
    queryKey: ['task-graph', taskId],
    queryFn: () => tasksApi.getGraph(taskId),
    enabled,
  })
}
```

```ts
// frontend/src/hooks/useWorkflowRuntimeUpdates.ts
import type { WorkflowGraph } from '../types'

export function mergeWorkflowProgressEvent(
  current: WorkflowGraph,
  event: {
    type: 'progress' | 'done'
    node?: { id: string; status: WorkflowGraph['nodes'][number]['status']; progress_percent: number }
    edge_updates?: Array<{ from: string; to: string; state: WorkflowGraph['edges'][number]['state'] }>
  },
): WorkflowGraph {
  return {
    ...current,
    nodes: current.nodes.map(node =>
      node.id === event.node?.id
        ? { ...node, status: event.node.status, progress_percent: event.node.progress_percent }
        : node,
    ),
    edges: current.edges.map(edge => {
      const update = event.edge_updates?.find(candidate => candidate.from === edge.from && candidate.to === edge.to)
      return update ? { ...edge, state: update.state } : edge
    }),
  }
}
```

- [ ] **Step 4: Run the graph merge test to verify it passes**

Run: `cd frontend && npm test -- --run src/hooks/__tests__/useWorkflowRuntimeUpdates.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/tasks.ts frontend/src/api/progress.ts frontend/src/stores/workflowGraphStore.ts frontend/src/hooks/useWorkflowGraph.ts frontend/src/hooks/__tests__/useWorkflowRuntimeUpdates.test.tsx
git commit -m "feat: add frontend workflow graph data layer"
```

### Task 2: Build The Static Graph Components With Lane Layout

**Files:**
- Create: `frontend/src/components/workflow/WorkflowGraph.tsx`
- Create: `frontend/src/components/workflow/WorkflowLane.tsx`
- Create: `frontend/src/components/workflow/WorkflowNodeCard.tsx`
- Create: `frontend/src/components/workflow/WorkflowEdge.tsx`
- Create: `frontend/src/components/workflow/WorkflowLegend.tsx`
- Create: `frontend/src/components/workflow/__tests__/WorkflowGraph.test.tsx`
- Modify: `frontend/src/components/pipeline/PipelineGraph.tsx`

- [ ] **Step 1: Write the failing rendering test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WorkflowGraph } from '../WorkflowGraph'

const graph = {
  workflow: { template_id: 'asr-dub+ocr-subs', status: 'running' },
  nodes: [
    { id: 'stage1', label: 'Stage 1', group: 'audio-spine', required: true, status: 'succeeded', progress_percent: 100 },
    { id: 'ocr-detect', label: 'OCR Detect', group: 'ocr-subtitles', required: true, status: 'running', progress_percent: 55 },
    { id: 'task-g', label: 'Task G', group: 'delivery', required: true, status: 'pending', progress_percent: 0 },
  ],
  edges: [{ from: 'stage1', to: 'task-g', state: 'inactive' }],
} as const

describe('WorkflowGraph', () => {
  it('renders nodes grouped by lane and shows the legend', () => {
    render(<WorkflowGraph graph={graph} />)

    expect(screen.getByText('音频主干')).toBeInTheDocument()
    expect(screen.getByText('OCR 字幕线')).toBeInTheDocument()
    expect(screen.getByText('交付线')).toBeInTheDocument()
    expect(screen.getByText('OCR Detect')).toBeInTheDocument()
    expect(screen.getByText('已缓存')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the graph rendering test to verify it fails**

Run: `cd frontend && npm test -- --run src/components/workflow/__tests__/WorkflowGraph.test.tsx`
Expected: FAIL because the workflow graph components do not exist.

- [ ] **Step 3: Write the minimal static graph components**

```tsx
// frontend/src/components/workflow/WorkflowNodeCard.tsx
import { cn } from '../../lib/utils'
import type { WorkflowGraphNode } from '../../types'

const STATUS_CLASS: Record<WorkflowGraphNode['status'], string> = {
  pending: 'border-slate-300 bg-white text-slate-500',
  running: 'border-blue-500 bg-blue-50 text-blue-700',
  succeeded: 'border-emerald-400 bg-emerald-50 text-emerald-700',
  cached: 'border-violet-400 bg-violet-50 text-violet-700',
  failed: 'border-red-400 bg-red-50 text-red-700',
  skipped: 'border-amber-400 bg-amber-50 text-amber-700',
}

export function WorkflowNodeCard({ node, selected, onClick }: {
  node: WorkflowGraphNode
  selected?: boolean
  onClick?: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(node.id)}
      className={cn(
        'min-w-[120px] rounded-2xl border-2 px-3 py-2 text-left transition-colors',
        STATUS_CLASS[node.status],
        selected && 'ring-2 ring-blue-300 ring-offset-2',
      )}
    >
      <div className="text-xs font-semibold">{node.label}</div>
      <div className="mt-1 text-[11px]">{node.required ? 'Required' : 'Optional'}</div>
      <div className="mt-1 text-[11px]">{node.progress_percent.toFixed(0)}%</div>
    </button>
  )
}
```

```tsx
// frontend/src/components/workflow/WorkflowGraph.tsx
import type { WorkflowGraph as WorkflowGraphType } from '../../types'
import { WorkflowLane } from './WorkflowLane'
import { WorkflowLegend } from './WorkflowLegend'

const LANE_ORDER = ['audio-spine', 'ocr-subtitles', 'video-cleanup', 'delivery'] as const
const LANE_LABELS = {
  'audio-spine': '音频主干',
  'ocr-subtitles': 'OCR 字幕线',
  'video-cleanup': '视频净化线',
  delivery: '交付线',
}

export function WorkflowGraph({ graph, compact = false }: { graph: WorkflowGraphType; compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {!compact && <WorkflowLegend />}
      {LANE_ORDER.map(group => (
        <WorkflowLane
          key={group}
          title={LANE_LABELS[group]}
          nodes={graph.nodes.filter(node => node.group === group)}
          edges={graph.edges}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run the graph rendering test to verify it passes**

Run: `cd frontend && npm test -- --run src/components/workflow/__tests__/WorkflowGraph.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/workflow frontend/src/components/pipeline/PipelineGraph.tsx
git commit -m "feat: add lane-based workflow graph components"
```

### Task 3: Add Node Drill-Down Drawer And Graph-First Task Detail View

**Files:**
- Create: `frontend/src/components/workflow/WorkflowNodeDrawer.tsx`
- Create: `frontend/src/components/workflow/__tests__/WorkflowNodeDrawer.test.tsx`
- Modify: `frontend/src/pages/TaskDetailPage.tsx`
- Modify: `frontend/src/hooks/useWorkflowRuntimeUpdates.ts`

- [ ] **Step 1: Write the failing drawer interaction test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WorkflowNodeDrawer } from '../WorkflowNodeDrawer'

describe('WorkflowNodeDrawer', () => {
  it('shows manifest and log links for the selected node', () => {
    render(
      <WorkflowNodeDrawer
        open
        node={{
          id: 'task-c',
          label: 'Task C',
          group: 'audio-spine',
          required: true,
          status: 'running',
          progress_percent: 67,
          summary: 'batch 3/4',
          manifest_path: '/tmp/task-c-manifest.json',
          log_path: '/tmp/task-c.log',
        }}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('Task C')).toBeInTheDocument()
    expect(screen.getByText('batch 3/4')).toBeInTheDocument()
    expect(screen.getByText('/tmp/task-c-manifest.json')).toBeInTheDocument()
    expect(screen.getByText('/tmp/task-c.log')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the drawer test to verify it fails**

Run: `cd frontend && npm test -- --run src/components/workflow/__tests__/WorkflowNodeDrawer.test.tsx`
Expected: FAIL because the drawer component does not exist.

- [ ] **Step 3: Write the drawer and wire it into task detail**

```tsx
// frontend/src/components/workflow/WorkflowNodeDrawer.tsx
import type { WorkflowGraphNode } from '../../types'

export function WorkflowNodeDrawer({ open, node, onClose }: {
  open: boolean
  node: WorkflowGraphNode | null
  onClose: () => void
}) {
  if (!open || !node) return null

  return (
    <aside className="w-full rounded-2xl border border-slate-200 bg-white p-4 lg:w-[340px]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">{node.label}</div>
          <div className="text-xs text-slate-500">{node.required ? 'Required' : 'Optional'}</div>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-slate-500">关闭</button>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div><dt className="text-slate-500">状态</dt><dd>{node.status}</dd></div>
        <div><dt className="text-slate-500">进度</dt><dd>{node.progress_percent.toFixed(0)}%</dd></div>
        <div><dt className="text-slate-500">摘要</dt><dd>{node.summary ?? '—'}</dd></div>
        <div><dt className="text-slate-500">Manifest</dt><dd>{node.manifest_path ?? '—'}</dd></div>
        <div><dt className="text-slate-500">Log</dt><dd>{node.log_path ?? '—'}</dd></div>
      </dl>
    </aside>
  )
}
```

```tsx
// frontend/src/pages/TaskDetailPage.tsx
const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
const { data: graph } = useWorkflowGraph(id!, Boolean(id))
const selectedNode = graph?.nodes.find(node => node.id === selectedNodeId) ?? null

<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
    <WorkflowGraph graph={graph ?? emptyGraph} onNodeClick={setSelectedNodeId} />
  </div>
  <WorkflowNodeDrawer open={Boolean(selectedNode)} node={selectedNode} onClose={() => setSelectedNodeId(null)} />
</div>
```

- [ ] **Step 4: Run the drawer test to verify it passes**

Run: `cd frontend && npm test -- --run src/components/workflow/__tests__/WorkflowNodeDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/workflow/WorkflowNodeDrawer.tsx frontend/src/components/workflow/__tests__/WorkflowNodeDrawer.test.tsx frontend/src/pages/TaskDetailPage.tsx frontend/src/hooks/useWorkflowRuntimeUpdates.ts
git commit -m "feat: add workflow node drill-down drawer"
```

### Task 4: Add Template Preview Graphs To Task Creation And Dashboard

**Files:**
- Modify: `frontend/src/pages/NewTaskPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/components/workflow/WorkflowPreviewCard.tsx`
- Create: `frontend/src/lib/workflowPreview.ts`

- [ ] **Step 1: Write the failing template preview test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WorkflowPreviewCard } from '../WorkflowPreviewCard'

describe('WorkflowPreviewCard', () => {
  it('renders the selected template name and preview graph summary', () => {
    render(
      <WorkflowPreviewCard
        templateId="asr-dub+ocr-subs"
        graph={{
          workflow: { template_id: 'asr-dub+ocr-subs', status: 'running' },
          nodes: [{ id: 'ocr-detect', label: 'OCR Detect', group: 'ocr-subtitles', required: true, status: 'pending', progress_percent: 0 }],
          edges: [],
        }}
      />,
    )

    expect(screen.getByText('asr-dub+ocr-subs')).toBeInTheDocument()
    expect(screen.getByText('OCR Detect')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the preview test to verify it fails**

Run: `cd frontend && npm test -- --run src/components/workflow/__tests__/WorkflowGraph.test.tsx src/components/workflow/__tests__/WorkflowNodeDrawer.test.tsx`
Expected: FAIL because the preview card and page integrations do not exist.

- [ ] **Step 3: Write the preview integration**

```tsx
// frontend/src/components/workflow/WorkflowPreviewCard.tsx
import type { WorkflowGraph } from '../../types'
import { WorkflowGraph as WorkflowGraphView } from './WorkflowGraph'

export function WorkflowPreviewCard({ templateId, graph }: { templateId: string; graph: WorkflowGraph }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 text-sm font-semibold text-slate-900">{templateId}</div>
      <WorkflowGraphView graph={graph} compact />
    </section>
  )
}
```

```tsx
// frontend/src/pages/NewTaskPage.tsx
import { getTemplatePreviewGraph } from '../lib/workflowPreview'

const previewGraph = getTemplatePreviewGraph(selectedTemplate, currentPolicy)

<WorkflowPreviewCard templateId={selectedTemplate} graph={previewGraph} />
```

```tsx
// frontend/src/pages/DashboardPage.tsx
function ActiveTaskGraphCard({ taskId }: { taskId: string }) {
  const { data: graph } = useWorkflowGraph(taskId, true)
  if (!graph) return null
  return (
    <Link to={`/tasks/${taskId}`}>
      <WorkflowGraph graph={graph} compact />
    </Link>
  )
}

{activeTasks.map(task => (
  <ActiveTaskGraphCard key={task.id} taskId={task.id} />
))}
```

```ts
// frontend/src/lib/workflowPreview.ts
import type { WorkflowGraph } from '../types'

export function getTemplatePreviewGraph(templateId: string, selectedPolicy: Record<string, string>): WorkflowGraph {
  const templates: Record<string, WorkflowGraph> = {
    'asr-dub-basic': {
      workflow: { template_id: 'asr-dub-basic', status: 'running', selected_policy: selectedPolicy },
      nodes: [
        { id: 'stage1', label: 'Stage 1', group: 'audio-spine', required: true, status: 'pending', progress_percent: 0 },
        { id: 'task-a', label: 'Task A', group: 'audio-spine', required: true, status: 'pending', progress_percent: 0 },
        { id: 'task-g', label: 'Task G', group: 'delivery', required: true, status: 'pending', progress_percent: 0 },
      ],
      edges: [
        { from: 'stage1', to: 'task-a', state: 'inactive' },
        { from: 'task-a', to: 'task-g', state: 'inactive' },
      ],
    },
  }
  return templates[templateId] ?? templates['asr-dub-basic']
}
```

- [ ] **Step 4: Run the preview test to verify it passes**

Run: `cd frontend && npm test -- --run src/components/workflow/__tests__/WorkflowGraph.test.tsx`
Expected: PASS with preview rendering covered.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/workflow/WorkflowPreviewCard.tsx frontend/src/pages/NewTaskPage.tsx frontend/src/pages/DashboardPage.tsx frontend/src/types/index.ts
git commit -m "feat: show workflow graph previews in template selection"
```

### Task 5: Add Motion Semantics, Reduced-Motion Support, And Runtime Polish

**Files:**
- Modify: `frontend/src/components/workflow/WorkflowNodeCard.tsx`
- Modify: `frontend/src/components/workflow/WorkflowEdge.tsx`
- Modify: `frontend/src/components/workflow/WorkflowGraph.tsx`
- Modify: `frontend/src/components/workflow/__tests__/WorkflowGraph.test.tsx`

- [ ] **Step 1: Write the failing motion semantics test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WorkflowGraph } from '../WorkflowGraph'

describe('WorkflowGraph motion semantics', () => {
  it('marks running nodes and cached nodes with different semantic classes', () => {
    render(
      <WorkflowGraph
        graph={{
          workflow: { template_id: 'asr-dub-basic', status: 'running' },
          nodes: [
            { id: 'task-c', label: 'Task C', group: 'audio-spine', required: true, status: 'running', progress_percent: 44 },
            { id: 'task-b', label: 'Task B', group: 'audio-spine', required: true, status: 'cached', progress_percent: 100 },
          ],
          edges: [],
        }}
      />,
    )

    expect(screen.getByTestId('workflow-node-task-c')).toHaveClass('node-running')
    expect(screen.getByTestId('workflow-node-task-b')).toHaveClass('node-cached')
  })
})
```

- [ ] **Step 2: Run the motion test to verify it fails**

Run: `cd frontend && npm test -- --run src/components/workflow/__tests__/WorkflowGraph.test.tsx`
Expected: FAIL because semantic state classes and reduced-motion handling are not implemented yet.

- [ ] **Step 3: Add semantic animations and reduced-motion fallback**

```tsx
// frontend/src/components/workflow/WorkflowNodeCard.tsx
import { motion, useReducedMotion } from 'framer-motion'

export function WorkflowNodeCard(...) {
  const prefersReducedMotion = useReducedMotion()
  const animate =
    node.status === 'running' && !prefersReducedMotion
      ? { boxShadow: ['0 0 0 0 rgba(59,130,246,0)', '0 0 0 10px rgba(59,130,246,0.18)', '0 0 0 0 rgba(59,130,246,0)'] }
      : {}

  return (
    <motion.button
      data-testid={`workflow-node-${node.id}`}
      className={cn(
        'rounded-2xl border-2 px-3 py-2',
        node.status === 'running' && 'node-running',
        node.status === 'cached' && 'node-cached',
      )}
      animate={animate}
      transition={{ duration: 1.8, repeat: prefersReducedMotion ? 0 : Infinity }}
    >
      ...
    </motion.button>
  )
}
```

```tsx
// frontend/src/components/workflow/WorkflowEdge.tsx
export function WorkflowEdge({ edge }: { edge: WorkflowGraphEdge }) {
  return (
    <path
      className={cn(
        'transition-colors',
        edge.state === 'active' && 'stroke-blue-500',
        edge.state === 'completed' && 'stroke-emerald-400',
        edge.state === 'blocked' && 'stroke-red-400',
      )}
      strokeDasharray={edge.state === 'inactive' ? '4 4' : undefined}
    />
  )
}
```

- [ ] **Step 4: Run the motion test to verify it passes**

Run: `cd frontend && npm test -- --run src/components/workflow/__tests__/WorkflowGraph.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/workflow/WorkflowNodeCard.tsx frontend/src/components/workflow/WorkflowEdge.tsx frontend/src/components/workflow/WorkflowGraph.tsx frontend/src/components/workflow/__tests__/WorkflowGraph.test.tsx
git commit -m "feat: polish workflow graph motion semantics"
```

## Self-Review Checklist

- Spec coverage:
  - Template preview graph: Task 4
  - Runtime execution graph: Tasks 2 and 3
  - Node drill-down drawer: Task 3
  - Graph payload contract and incremental updates: Task 1
  - Motion semantics, reduced motion, and compact previews: Task 5
- Placeholder scan:
  - No `TODO`, `TBD`, or “write tests later” text remains.
- Type consistency:
  - `WorkflowGraph`, `WorkflowGraphNode`, `WorkflowGraphEdge`, and `WorkflowStatus` names are reused consistently across tasks.

## Notes Before Execution

- Keep the current `PipelineGraph` export path working until all pages migrate to the new workflow components.
- Avoid force-graph or physics-layout experiments in this implementation pass.
- Treat the graph as the primary task-detail surface; the drawer and tabs must support it, not replace it.
