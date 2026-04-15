import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/utils'
import type { WorkflowGraphEdge } from '../../types'

const EDGE_CLASS: Record<WorkflowGraphEdge['state'], string> = {
  inactive: 'stroke-slate-200/90',
  active: 'stroke-sky-400 workflow-edge-active',
  completed: 'stroke-emerald-300',
  blocked: 'stroke-amber-400 stroke-dasharray-[6_8]',
}

interface WorkflowEdgeProps {
  path: string
  state: WorkflowGraphEdge['state']
}

export function WorkflowEdge({ path, state }: WorkflowEdgeProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.path
      d={path}
      fill="none"
      strokeWidth={2.5}
      strokeLinecap="round"
      className={cn(EDGE_CLASS[state], reduceMotion && 'workflow-edge-reduced')}
      initial={reduceMotion ? false : { pathLength: 0.2, opacity: 0.25 }}
      animate={reduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    />
  )
}
