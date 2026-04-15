import { create } from 'zustand'
import type { WorkflowGraph } from '../types'

interface WorkflowGraphState {
  graphs: Record<string, WorkflowGraph>
  setGraph: (taskId: string, graph: WorkflowGraph) => void
  updateGraph: (taskId: string, updater: (current: WorkflowGraph) => WorkflowGraph) => void
  clearGraph: (taskId: string) => void
}

export const useWorkflowGraphStore = create<WorkflowGraphState>(set => ({
  graphs: {},
  setGraph: (taskId, graph) =>
    set(state => ({
      graphs: {
        ...state.graphs,
        [taskId]: graph,
      },
    })),
  updateGraph: (taskId, updater) =>
    set(state => {
      const current = state.graphs[taskId]
      if (!current) {
        return state
      }
      return {
        graphs: {
          ...state.graphs,
          [taskId]: updater(current),
        },
      }
    }),
  clearGraph: taskId =>
    set(state => {
      const graphs = { ...state.graphs }
      delete graphs[taskId]
      return { graphs }
    }),
}))
