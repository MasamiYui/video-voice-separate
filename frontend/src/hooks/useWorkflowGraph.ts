import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'
import { useWorkflowGraphStore } from '../stores/workflowGraphStore'

export function useWorkflowGraph(taskId: string, enabled = true) {
  const setGraph = useWorkflowGraphStore(state => state.setGraph)
  const graph = useWorkflowGraphStore(state => state.graphs[taskId])

  const query = useQuery({
    queryKey: ['task-graph', taskId],
    queryFn: () => tasksApi.getGraph(taskId),
    enabled,
  })

  useEffect(() => {
    if (!query.data) {
      return
    }
    setGraph(taskId, query.data)
  }, [query.data, setGraph, taskId])

  return {
    ...query,
    graph: graph ?? query.data,
  }
}
