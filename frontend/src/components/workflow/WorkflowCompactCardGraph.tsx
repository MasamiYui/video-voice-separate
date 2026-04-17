import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  AudioWaveform,
  Clapperboard,
  Eraser,
  FileOutput,
  Film,
  Headphones,
  Languages,
  MicVocal,
  ScanText,
  Scissors,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { getWorkflowColumn, WORKFLOW_LANES } from '../../lib/workflowPreview'
import { cn } from '../../lib/utils'
import type { StageShortKey, StatusKey } from '../../i18n/formatters'
import { useI18n } from '../../i18n/useI18n'
import type { WorkflowEdgeState, WorkflowGraph as WorkflowGraphPayload, WorkflowGraphNode } from '../../types'
import { WorkflowLegend } from './WorkflowLegend'

const NODE_ICON: Record<string, LucideIcon> = {
  stage1: Scissors,
  'ocr-detect': ScanText,
  'task-a': MicVocal,
  'task-b': Users,
  'task-c': Languages,
  'ocr-translate': FileOutput,
  'task-d': Headphones,
  'task-e': Clapperboard,
  'subtitle-erase': Eraser,
  'task-g': Film,
}

const NODE_CODE: Record<string, string> = {
  stage1: 'S1',
  'ocr-detect': 'O1',
  'task-a': 'A1',
  'task-b': 'B1',
  'task-c': 'C1',
  'ocr-translate': 'O2',
  'task-d': 'D1',
  'task-e': 'E1',
  'subtitle-erase': 'V1',
  'task-g': 'G1',
}

const PREVIEW_HINTS: Record<string, { zh: string; en: string }> = {
  stage1: { zh: '拆分人声与背景轨。', en: 'Separate dialogue and background.' },
  'ocr-detect': { zh: '定位画面硬字幕。', en: 'Detect hard subtitles on frame.' },
  'task-a': { zh: '生成时间对齐转写。', en: 'Create aligned transcript segments.' },
  'task-b': { zh: '补全说话人身份。', en: 'Register and reconcile speakers.' },
  'task-c': { zh: '翻译配音文本。', en: 'Translate dubbing text.' },
  'ocr-translate': { zh: '翻译展示字幕。', en: 'Translate display subtitles.' },
  'task-d': { zh: '合成目标语音轨。', en: 'Synthesize the target voice track.' },
  'task-e': { zh: '回贴时间线并混音。', en: 'Fit the dub back to timeline.' },
  'subtitle-erase': { zh: '清理原字幕画面。', en: 'Remove subtitles from video.' },
  'task-g': { zh: '汇总支线并导出。', en: 'Package branch outputs for delivery.' },
}

const STATUS_STYLES: Record<WorkflowGraphNode['status'], string> = {
  pending: 'border-slate-200/85 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] text-slate-700',
  running: 'border-sky-200/90 bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(255,255,255,0.96))] text-slate-900',
  succeeded: 'border-emerald-200/90 bg-[linear-gradient(135deg,rgba(240,253,244,0.98),rgba(255,255,255,0.96))] text-slate-900',
  cached: 'border-violet-200/90 bg-[linear-gradient(135deg,rgba(245,243,255,0.98),rgba(255,255,255,0.96))] text-slate-900',
  failed: 'border-rose-200/90 bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,255,255,0.96))] text-slate-900',
  skipped: 'border-slate-200/80 bg-[linear-gradient(135deg,rgba(250,250,250,0.96),rgba(255,255,255,0.94))] text-slate-600',
}

const ACCENT_STYLES: Record<WorkflowGraphNode['status'], string> = {
  pending: 'bg-slate-200',
  running: 'bg-sky-400',
  succeeded: 'bg-emerald-400',
  cached: 'bg-violet-400',
  failed: 'bg-rose-400',
  skipped: 'bg-slate-300',
}

const EDGE_STYLES: Record<WorkflowEdgeState, Partial<Edge>> = {
  inactive: {
    style: { stroke: '#D6D3D1', strokeWidth: 1.4 },
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#D6D3D1', width: 10, height: 10 },
  },
  active: {
    style: { stroke: '#38BDF8', strokeWidth: 2 },
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#38BDF8', width: 12, height: 12 },
  },
  completed: {
    style: { stroke: '#34D399', strokeWidth: 1.8 },
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#34D399', width: 11, height: 11 },
  },
  blocked: {
    style: { stroke: '#FB7185', strokeWidth: 1.8, strokeDasharray: '6 4' },
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#FB7185', width: 11, height: 11 },
  },
}

const PREVIEW_NODE_WIDTH = 188
const RUNTIME_NODE_WIDTH = 196
const PREVIEW_NODE_HEIGHT = 90
const RUNTIME_NODE_HEIGHT = 104
const COLUMN_SPACING = 220
const ROW_GAP = 34
const HANDLE_STYLE = { width: 8, height: 8, opacity: 0, pointerEvents: 'none' as const }

interface CompactNodeChromeProps {
  node: WorkflowGraphNode
  previewOnly: boolean
  shortLabel: string
  hint: string
  statusLabel: string
  selected?: boolean
  interactive?: boolean
  onSelect?: (nodeId: string) => void
}

function CompactNodeChrome({
  node,
  previewOnly,
  shortLabel,
  hint,
  statusLabel,
  selected = false,
  interactive = false,
  onSelect,
}: CompactNodeChromeProps) {
  const { locale, t } = useI18n()
  const Icon = NODE_ICON[node.id] ?? AudioWaveform
  const showProgress = !previewOnly && node.status === 'running'
  const runtimeCaption = !previewOnly && node.current_step ? node.current_step : null
  const statusChip = showProgress ? `${statusLabel} ${Math.round(node.progress_percent)}%` : statusLabel

  return (
    <button
      type="button"
      onClick={interactive ? () => onSelect?.(node.id) : undefined}
      data-ui-elevation="flat"
      className={cn(
        'group relative grid h-full w-full grid-cols-[38px_minmax(0,1fr)] gap-3 overflow-hidden rounded-[18px] border px-3 py-3 text-left transition-colors duration-200',
        STATUS_STYLES[node.status],
        interactive && 'cursor-pointer',
        selected && 'ring-2 ring-sky-300/80 ring-offset-2 ring-offset-white',
      )}
    >
      {!previewOnly && (
        <div className={cn('absolute inset-y-3 left-0 w-[2px] rounded-full', ACCENT_STYLES[node.status])} />
      )}

      {!previewOnly && (
        <span className="absolute right-3 top-3 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {statusChip}
        </span>
      )}

      <div className="flex min-h-[56px] flex-col items-center justify-between py-0.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-current">
          <Icon size={16} />
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-current/52">
          {NODE_CODE[node.id] ?? node.id}
        </div>
      </div>

      <div className="min-w-0 pr-1">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-current/42">
          {locale === 'zh-CN' ? '流水线节点' : 'Pipeline step'}
        </div>

        <div className={cn('font-semibold leading-tight tracking-tight text-current', previewOnly ? 'mt-1 text-[15px]' : 'mt-1 text-[16px] pr-16')}>
          {shortLabel}
        </div>

        <p className="mt-1.5 text-[11px] leading-5 text-current/68">
          {hint}
        </p>

        {node.required === false && (
          <span className="mt-2 inline-flex rounded-full border border-dashed border-slate-200 bg-white/75 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {t.workflow.optional}
          </span>
        )}

        {!previewOnly && runtimeCaption && (
          <div className="mt-2 line-clamp-1 text-[10px] font-medium text-current/58">
            {runtimeCaption}
          </div>
        )}

        {showProgress && (
          <div className="mt-2 overflow-hidden rounded-full bg-sky-100/90">
            <div
              className="h-1 rounded-full bg-sky-400"
              style={{ width: `${node.progress_percent}%` }}
            />
          </div>
        )}
      </div>
    </button>
  )
}

interface CompactFlowNodeData extends Record<string, unknown> {
  node: WorkflowGraphNode
  previewOnly: boolean
  shortLabel: string
  hint: string
  statusLabel: string
  isSelected: boolean
  onSelect?: (nodeId: string) => void
}

function CompactFlowNode({ data }: NodeProps) {
  const d = data as CompactFlowNodeData
  const nodeWidth = d.previewOnly ? PREVIEW_NODE_WIDTH : RUNTIME_NODE_WIDTH
  const nodeHeight = d.previewOnly ? PREVIEW_NODE_HEIGHT : RUNTIME_NODE_HEIGHT

  return (
    <div style={{ width: nodeWidth, height: nodeHeight }}>
      <Handle id="left" type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Handle id="right" type="source" position={Position.Right} style={HANDLE_STYLE} />
      <Handle id="top" type="target" position={Position.Top} style={HANDLE_STYLE} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={HANDLE_STYLE} />

      <CompactNodeChrome
        node={d.node}
        previewOnly={d.previewOnly}
        shortLabel={d.shortLabel}
        hint={d.hint}
        statusLabel={d.statusLabel}
        selected={d.isSelected}
        interactive={Boolean(d.onSelect)}
        onSelect={d.onSelect}
      />
    </div>
  )
}

const NODE_TYPES: NodeTypes = {
  editorialNode: CompactFlowNode as unknown as NodeTypes['editorialNode'],
}

function getPreviewHint(node: WorkflowGraphNode, locale: 'zh-CN' | 'en-US') {
  return locale === 'zh-CN'
    ? PREVIEW_HINTS[node.id]?.zh ?? '等待此节点产出。'
    : PREVIEW_HINTS[node.id]?.en ?? 'Waiting for this node.'
}

function resolveNodeHint(node: WorkflowGraphNode, locale: 'zh-CN' | 'en-US', previewOnly: boolean) {
  if (previewOnly) {
    return getPreviewHint(node, locale)
  }
  if (node.error_message) {
    return node.error_message
  }
  return getPreviewHint(node, locale)
}

function edgeStateBetween(graph: WorkflowGraphPayload, from: string, to: string): WorkflowEdgeState {
  return graph.edges.find(edge => edge.from === from && edge.to === to)?.state ?? 'inactive'
}

function resolveHandles(source: { x: number; y: number }, target: { x: number; y: number }) {
  if (source.y === target.y) {
    return source.x < target.x
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' }
  }

  return source.y < target.y
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' }
}

function buildSnakeLayout(nodes: WorkflowGraphNode[], previewOnly: boolean) {
  const nodeWidth = previewOnly ? PREVIEW_NODE_WIDTH : RUNTIME_NODE_WIDTH
  const nodeHeight = previewOnly ? PREVIEW_NODE_HEIGHT : RUNTIME_NODE_HEIGHT
  const topCount = nodes.length > 4 ? Math.ceil(nodes.length / 2) : nodes.length
  const topRow = nodes.slice(0, topCount)
  const bottomRow = nodes.slice(topCount)
  const positions = new Map<string, { x: number; y: number }>()

  topRow.forEach((node, index) => {
    positions.set(node.id, { x: index * COLUMN_SPACING, y: 8 })
  })

  bottomRow.forEach((node, index) => {
    positions.set(node.id, {
      x: (topCount - 1 - index) * COLUMN_SPACING,
      y: nodeHeight + ROW_GAP,
    })
  })

  const width = Math.max(1, topCount) * COLUMN_SPACING - (topCount > 0 ? COLUMN_SPACING - nodeWidth : 0) + 16
  const height = bottomRow.length > 0 ? nodeHeight * 2 + ROW_GAP + 16 : nodeHeight + 16

  return { positions, width, height }
}

interface CompactLaneFlowProps {
  graph: WorkflowGraphPayload
  laneId: WorkflowGraphNode['group']
  selectedNodeId?: string
  onNodeSelect?: (nodeId: string) => void
}

function CompactLaneFlow({ graph, laneId, selectedNodeId, onNodeSelect }: CompactLaneFlowProps) {
  const { locale, getStageShortLabel, getStatusLabel, t } = useI18n()
  const previewOnly = graph.nodes.every(node => node.status === 'pending')

  const laneNodes = useMemo(() => {
    return graph.nodes
      .filter(node => node.group === laneId)
      .sort((left, right) => getWorkflowColumn(left.id) - getWorkflowColumn(right.id))
  }, [graph.nodes, laneId])

  const laneGraph = useMemo(() => {
    const { positions, width, height } = buildSnakeLayout(laneNodes, previewOnly)

    const nodes: Node[] = laneNodes.map(node => ({
      id: node.id,
      type: 'editorialNode',
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: {
        node,
        previewOnly,
        shortLabel: getStageShortLabel(node.id as keyof typeof t.stageShort),
        hint: resolveNodeHint(node, locale, previewOnly),
        statusLabel: getStatusLabel(node.status as keyof typeof t.status),
        isSelected: node.id === selectedNodeId,
        onSelect: onNodeSelect,
      } satisfies CompactFlowNodeData,
      width: previewOnly ? PREVIEW_NODE_WIDTH : RUNTIME_NODE_WIDTH,
      height: previewOnly ? PREVIEW_NODE_HEIGHT : RUNTIME_NODE_HEIGHT,
      selectable: true,
      draggable: false,
      focusable: true,
    }))

    const edges: Edge[] = laneNodes.slice(0, -1).map((node, index) => {
      const next = laneNodes[index + 1]
      const source = positions.get(node.id) ?? { x: 0, y: 0 }
      const target = positions.get(next.id) ?? { x: 0, y: 0 }
      const handles = resolveHandles(source, target)
      const state = edgeStateBetween(graph, node.id, next.id)

      return {
        id: `${node.id}--${next.id}`,
        source: node.id,
        target: next.id,
        type: 'smoothstep',
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        ...EDGE_STYLES[state],
      }
    })

    return { nodes, edges, height, width }
  }, [
    getStageShortLabel,
    getStatusLabel,
    graph,
    laneNodes,
    locale,
    onNodeSelect,
    previewOnly,
    selectedNodeId,
    t,
  ])

  return (
    <div className="overflow-x-auto rounded-[18px] border border-slate-200/70 bg-white p-2">
      <div className="flex min-w-fit justify-center">
        <div className="overflow-hidden rounded-[14px]" style={{ width: laneGraph.width, height: laneGraph.height }}>
          <ReactFlow
            nodes={laneGraph.nodes}
            edges={laneGraph.edges}
            nodeTypes={NODE_TYPES}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            zoomOnDoubleClick={false}
            preventScrolling={false}
            minZoom={0.45}
            maxZoom={1.6}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={26}
              size={1}
              color="#e2e8f0"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}

interface DeliveryTerminalCardProps {
  node: WorkflowGraphNode
  previewOnly: boolean
  shortLabel: string
  hint: string
  statusLabel: string
  selected?: boolean
  interactive?: boolean
  onSelect?: (nodeId: string) => void
}

function DeliveryTerminalCard({
  node,
  previewOnly,
  shortLabel,
  hint,
  statusLabel,
  selected = false,
  interactive = false,
  onSelect,
}: DeliveryTerminalCardProps) {
  const { locale } = useI18n()
  const Icon = NODE_ICON[node.id] ?? Film
  const nodeWidth = previewOnly ? PREVIEW_NODE_WIDTH : RUNTIME_NODE_WIDTH
  const nodeHeight = previewOnly ? PREVIEW_NODE_HEIGHT : RUNTIME_NODE_HEIGHT
  const showProgress = !previewOnly && node.status === 'running'
  const runtimeCaption = !previewOnly && node.current_step ? node.current_step : null
  const statusChip = showProgress ? `${statusLabel} ${Math.round(node.progress_percent)}%` : statusLabel

  return (
    <div
      data-ui-elevation="flat"
      data-ui-delivery-node="compact"
      data-ui-size="matched"
      style={{ width: nodeWidth, height: nodeHeight }}
    >
      <button
        type="button"
        onClick={interactive ? () => onSelect?.(node.id) : undefined}
        className={cn(
          'group relative grid h-full w-full grid-cols-[38px_minmax(0,1fr)] gap-3 overflow-hidden rounded-[18px] border px-3 py-3 text-left transition-colors duration-200',
          STATUS_STYLES[node.status],
          interactive && 'cursor-pointer',
          selected && 'ring-2 ring-sky-300/80 ring-offset-2 ring-offset-white',
        )}
      >
        {!previewOnly && (
          <span className="absolute right-3 top-3 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {statusChip}
          </span>
        )}

        <div className="flex min-h-[56px] flex-col items-center justify-between py-0.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-current">
            <Icon size={16} />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-current/52">
            {NODE_CODE[node.id] ?? node.id}
          </div>
        </div>

        <div className="min-w-0 pr-1">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-current/42">
            {locale === 'zh-CN' ? '终态输出' : 'Final output'}
          </div>
          <div className={cn('font-semibold leading-tight tracking-tight text-current', previewOnly ? 'mt-1 text-[15px]' : 'mt-1 text-[16px] pr-16')}>
            {shortLabel}
          </div>
          <p className="mt-1.5 text-[11px] leading-5 text-current/68">
            {hint}
          </p>

          {!previewOnly && runtimeCaption && (
            <div className="mt-2 line-clamp-1 text-[10px] font-medium text-current/58">
              {runtimeCaption}
            </div>
          )}

          {showProgress && (
            <div className="mt-2 overflow-hidden rounded-full bg-sky-100/90">
              <div
                className="h-1 rounded-full bg-sky-400"
                style={{ width: `${node.progress_percent}%` }}
              />
            </div>
          )}
        </div>
      </button>
    </div>
  )
}

interface DeliveryLaneProps {
  graph: WorkflowGraphPayload
  node: WorkflowGraphNode
  selectedNodeId?: string
  onNodeSelect?: (nodeId: string) => void
}

function DeliveryLane({ graph, node, selectedNodeId, onNodeSelect }: DeliveryLaneProps) {
  const { locale, getStageShortLabel, getStatusLabel } = useI18n()
  const previewOnly = graph.nodes.every(item => item.status === 'pending')

  return (
    <div
      data-ui-layout="delivery-terminal"
      className="flex justify-center"
    >
      <div className="min-w-0">
        <DeliveryTerminalCard
          node={node}
          previewOnly={previewOnly}
          shortLabel={getStageShortLabel(node.id as StageShortKey)}
          hint={resolveNodeHint(node, locale, previewOnly)}
          statusLabel={getStatusLabel(node.status as StatusKey)}
          selected={node.id === selectedNodeId}
          interactive={Boolean(onNodeSelect)}
          onSelect={onNodeSelect}
        />
      </div>
    </div>
  )
}

function LaneCount({ count }: { count: number }) {
  const { locale } = useI18n()

  return (
    <div className="rounded-full border border-slate-200/80 bg-white/82 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 shadow-[0_8px_18px_-18px_rgba(15,23,42,0.24)]">
      {count} {locale === 'zh-CN' ? '节点' : count > 1 ? 'steps' : 'step'}
    </div>
  )
}

interface LaneHeaderProps {
  label: string
  count: number
}

function LaneHeader({ label, count }: LaneHeaderProps) {
  return (
    <div className="mb-2.5 flex items-center gap-3">
      <div className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
        {label}
      </div>
      <div className="h-px flex-1 bg-slate-200/80" />
      <LaneCount count={count} />
    </div>
  )
}

interface WorkflowCompactCardGraphProps {
  graph: WorkflowGraphPayload
  selectedNodeId?: string
  onNodeSelect?: (nodeId: string) => void
  showLegend?: boolean
}

export function WorkflowCompactCardGraph({
  graph,
  selectedNodeId,
  onNodeSelect,
  showLegend = false,
}: WorkflowCompactCardGraphProps) {
  const { t } = useI18n()

  const groupedNodes = useMemo(() => {
    return WORKFLOW_LANES.map(lane => ({
      lane: lane.id,
      label: t.workflow.lanes[lane.id],
      nodes: graph.nodes
        .filter(node => node.group === lane.id)
        .sort((left, right) => getWorkflowColumn(left.id) - getWorkflowColumn(right.id)),
    })).filter(entry => entry.nodes.length > 0)
  }, [graph.nodes, t.workflow.lanes])

  return (
    <div className="space-y-3">
      {showLegend && <WorkflowLegend />}

      <div className="space-y-2.5">
        {groupedNodes.map(entry => {
          const isDeliveryLane = entry.lane === 'delivery' && entry.nodes.length === 1

          return (
            <section
              key={entry.lane}
              data-ui-tone="neutral"
              className="rounded-[22px] border border-slate-200/80 bg-white/76 px-3 py-3 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.12)] backdrop-blur-sm"
            >
              <LaneHeader label={entry.label} count={entry.nodes.length} />

              {isDeliveryLane ? (
                <DeliveryLane
                  graph={graph}
                  node={entry.nodes[0]}
                  selectedNodeId={selectedNodeId}
                  onNodeSelect={onNodeSelect}
                />
              ) : (
                <CompactLaneFlow
                  graph={graph}
                  laneId={entry.lane}
                  selectedNodeId={selectedNodeId}
                  onNodeSelect={onNodeSelect}
                />
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
