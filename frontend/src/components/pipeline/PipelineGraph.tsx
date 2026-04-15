import { buildGraphFromStages } from '../../lib/workflowPreview'
import type { TaskConfig, TaskStage, WorkflowGraph as WorkflowGraphPayload } from '../../types'
import { WorkflowGraph } from '../workflow/WorkflowGraph'

interface PipelineGraphProps {
  stages?: TaskStage[]
  graph?: WorkflowGraphPayload
  activeStage?: string
  onStageClick?: (stageName: string) => void
  compact?: boolean
  showLegend?: boolean
  templateId?: TaskConfig['template']
}

export function PipelineGraph({
  stages = [],
  graph,
  activeStage,
  onStageClick,
  compact = false,
  showLegend = false,
  templateId = 'asr-dub-basic',
}: PipelineGraphProps) {
  const resolvedGraph = graph ?? buildGraphFromStages(stages, templateId)

  return (
    <WorkflowGraph
      graph={resolvedGraph}
      selectedNodeId={activeStage}
      onNodeSelect={onStageClick}
      compact={compact}
      showLegend={showLegend}
    />
  )
}
