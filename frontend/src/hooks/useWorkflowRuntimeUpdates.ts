import { useEffect } from 'react'
import { subscribeToProgress } from '../api/progress'
import { useWorkflowGraphStore } from '../stores/workflowGraphStore'
import type { ProgressEvent, StageStatus, WorkflowEdgeState, WorkflowGraph } from '../types'

function edgeState(sourceStatus: StageStatus, targetStatus: StageStatus): WorkflowEdgeState {
  const completedStatuses = new Set<StageStatus>(['succeeded', 'cached'])
  if (completedStatuses.has(sourceStatus) && targetStatus === 'running') {
    return 'active'
  }
  if (completedStatuses.has(sourceStatus) && ['succeeded', 'cached', 'failed', 'skipped'].includes(targetStatus)) {
    return 'completed'
  }
  if (targetStatus === 'failed') {
    return 'blocked'
  }
  return 'inactive'
}

export function mergeWorkflowProgressEvent(current: WorkflowGraph, event: ProgressEvent): WorkflowGraph {
  if (!event.stages?.length) {
    return {
      ...current,
      workflow: {
        ...current.workflow,
        status: (event.status as WorkflowGraph['workflow']['status']) ?? current.workflow.status,
      },
    }
  }

  const stageById = new Map(event.stages.map(stage => [stage.stage_name, stage]))
  const nodes = current.nodes.map(node => {
    const stage = stageById.get(node.id)
    if (!stage) {
      return node
    }
    return {
      ...node,
      status: stage.status,
      progress_percent: stage.progress_percent,
      current_step: stage.current_step,
      cache_hit: stage.cache_hit,
      elapsed_sec: stage.elapsed_sec,
      manifest_path: stage.manifest_path ?? node.manifest_path,
      error_message: stage.error_message ?? node.error_message,
    }
  })

  const statusByNodeId = new Map(nodes.map(node => [node.id, node.status]))
  const edges = current.edges.map(edge => ({
    ...edge,
    state: edgeState(
      statusByNodeId.get(edge.from) ?? 'pending',
      statusByNodeId.get(edge.to) ?? 'pending',
    ),
  }))

  return {
    workflow: {
      ...current.workflow,
      status: (event.status as WorkflowGraph['workflow']['status']) ?? current.workflow.status,
    },
    nodes,
    edges,
  }
}

export function useWorkflowRuntimeUpdates(taskId: string | undefined, enabled: boolean) {
  const updateGraph = useWorkflowGraphStore(state => state.updateGraph)

  useEffect(() => {
    if (!taskId || !enabled) {
      return
    }
    return subscribeToProgress(taskId, event => {
      updateGraph(taskId, current => mergeWorkflowProgressEvent(current, event))
    })
  }, [enabled, taskId, updateGraph])
}
