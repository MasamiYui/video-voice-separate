import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Clock3, Download, FileJson2, Layers3, X } from 'lucide-react'
import { tasksApi } from '../../api/tasks'
import { formatBytes } from '../../lib/utils'
import { useI18n } from '../../i18n/useI18n'
import { StatusBadge } from '../shared/StatusBadge'
import { ProgressBar } from '../shared/ProgressBar'
import type { Artifact, TaskStage, WorkflowGraphNode } from '../../types'

interface WorkflowNodeDrawerProps {
  node: WorkflowGraphNode | null
  stage?: TaskStage | null
  artifacts?: Artifact[]
  taskId?: string
  onClose: () => void
}

export function WorkflowNodeDrawer({ node, stage, artifacts = [], taskId, onClose }: WorkflowNodeDrawerProps) {
  const { t, formatDuration, getStageLabel } = useI18n()
  const [manifest, setManifest] = useState<string | null>(null)
  const [manifestError, setManifestError] = useState<string | null>(null)
  const [loadingManifest, setLoadingManifest] = useState(false)

  async function handleLoadManifest() {
    if (!node || !taskId) {
      return
    }
    setLoadingManifest(true)
    setManifestError(null)
    try {
      const payload = await tasksApi.getStageManifest(taskId, node.id)
      setManifest(JSON.stringify(payload, null, 2))
    } catch {
      setManifest(null)
      setManifestError(t.workflow.drawer.manifestLoadFailed)
    } finally {
      setLoadingManifest(false)
    }
  }

  return (
    <AnimatePresence>
      {node && (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-[0_24px_80px_-38px_rgba(15,23,42,0.65)]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {t.workflow.drawer.title}
                </div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {getStageLabel(node.id as keyof typeof t.stages)}
                </h3>
                <div className="mt-1 text-xs text-slate-500">{node.id}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                aria-label={t.workflow.drawer.close}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div className="flex items-center justify-between">
                <StatusBadge status={node.status} />
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {node.required ? t.workflow.required : t.workflow.optional}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InfoStat icon={<Layers3 size={14} />} label={t.workflow.drawer.group} value={t.workflow.lanes[node.group]} />
                <InfoStat icon={<Clock3 size={14} />} label={t.workflow.drawer.duration} value={formatDuration(stage?.elapsed_sec ?? node.elapsed_sec)} />
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                  <span>{t.workflow.drawer.progress}</span>
                  <span className="font-semibold text-slate-900">{node.progress_percent.toFixed(0)}%</span>
                </div>
                <ProgressBar value={node.progress_percent} size="lg" />
              </div>

              {(stage?.current_step || node.current_step) && (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {t.workflow.drawer.currentStep}
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{stage?.current_step ?? node.current_step}</div>
                </div>
              )}

              {(stage?.error_message || node.error_message) && (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
                    <AlertTriangle size={14} />
                    {t.workflow.drawer.error}
                  </div>
                  <div className="mt-2 text-sm text-rose-700">{stage?.error_message ?? node.error_message}</div>
                </div>
              )}

              <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {t.workflow.drawer.artifacts}
                  </div>
                  {taskId && (
                    <button
                      type="button"
                      onClick={handleLoadManifest}
                      disabled={loadingManifest}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
                    >
                      <FileJson2 size={13} />
                      {t.workflow.drawer.viewManifest}
                    </button>
                  )}
                </div>

                {artifacts.length === 0 ? (
                  <div className="text-sm text-slate-400">{t.workflow.drawer.noArtifacts}</div>
                ) : (
                  <div className="space-y-2">
                    {artifacts.map(artifact => (
                      <div key={artifact.path} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-700">{artifact.path.split('/').pop()}</div>
                          <div className="text-xs text-slate-400">{formatBytes(artifact.size_bytes)}</div>
                        </div>
                        {taskId && (
                          <a
                            href={`/api/tasks/${taskId}/artifacts/${artifact.path}`}
                            download
                            className="rounded-2xl p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                          >
                            <Download size={14} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {manifestError && <div className="mt-3 text-sm text-rose-600">{manifestError}</div>}
                {manifest && (
                  <pre className="mt-3 max-h-64 overflow-auto rounded-[22px] bg-slate-950 p-4 text-xs text-slate-200">
                    {manifest}
                  </pre>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function InfoStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-700">{value}</div>
    </div>
  )
}
