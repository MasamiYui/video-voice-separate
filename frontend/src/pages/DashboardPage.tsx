import { useQuery } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'
import { APP_CONTENT_MAX_WIDTH, PageContainer } from '../components/layout/PageContainer'
import { StatusBadge } from '../components/shared/StatusBadge'
import { ProgressBar } from '../components/shared/ProgressBar'
import { PipelineGraph } from '../components/pipeline/PipelineGraph'
import { Link } from 'react-router-dom'
import { PlusCircle, ArrowRight } from 'lucide-react'
import type { Task } from '../types'
import { useI18n } from '../i18n/useI18n'

function StatCard({ label, value, sub, color }: {
  label: string; value: number | string; sub?: string; color?: string
}) {
  return (
    <div className="border-r border-slate-100 px-5 py-4 last:border-r-0">
      <div className="text-xs font-medium uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${color ?? 'text-slate-900'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

function ActiveTaskCard({ task }: { task: Task }) {
  const { getLanguageLabel } = useI18n()

  return (
    <Link
      to={`/tasks/${task.id}`}
      className="block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div>
          <div className="font-semibold text-slate-900">{task.name}</div>
          <div className="mt-0.5 text-xs text-slate-400">
            {getLanguageLabel(task.source_lang)} → {getLanguageLabel(task.target_lang)}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="tabular-nums text-sm font-semibold text-slate-700">{task.overall_progress.toFixed(0)}%</span>
          <StatusBadge status={task.status} size="sm" />
        </div>
      </div>
      <div className="px-5 py-3">
        <ProgressBar value={task.overall_progress} size="sm" className="mb-3" />
        <PipelineGraph
          stages={task.stages}
          templateId={(typeof task.config.template === 'string' ? task.config.template : 'asr-dub-basic') as 'asr-dub-basic' | 'asr-dub+ocr-subs' | 'asr-dub+ocr-subs+erase'}
          activeStage={task.current_stage ?? undefined}
          compact
        />
      </div>
    </Link>
  )
}

export function DashboardPage() {
  const { t, formatDuration, formatRelativeTime, getLanguageLabel } = useI18n()
  const { data: allTasks } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => tasksApi.list({ size: 100 }),
    refetchInterval: 5000,
  })

  const tasks = allTasks?.items ?? []
  const total = allTasks?.total ?? 0
  const running = tasks.filter(t => t.status === 'running').length
  const succeeded = tasks.filter(t => t.status === 'succeeded').length
  const failed = tasks.filter(t => t.status === 'failed').length
  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending')
  const recentDone = tasks
    .filter(t => t.status === 'succeeded' || t.status === 'failed')
    .slice(0, 5)

  return (
    <PageContainer className={`${APP_CONTENT_MAX_WIDTH} space-y-6`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t.dashboard.title}</h1>
        <Link
          to="/tasks/new"
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <PlusCircle size={15} />
          {t.common.createTask}
        </Link>
      </div>

      {/* Stats */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4">
          <StatCard label={t.dashboard.totalTasks} value={total} />
          <StatCard label={t.dashboard.running} value={running} color="text-blue-600" />
          <StatCard label={t.dashboard.completed} value={succeeded} color="text-emerald-600" />
          <StatCard label={t.dashboard.failed} value={failed} color="text-red-600" />
        </div>
      </div>

      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-800">{t.dashboard.activeTasks}</h2>
            <Link to="/tasks" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
              {t.common.all} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {activeTasks.map(t => <ActiveTaskCard key={t.id} task={t} />)}
          </div>
        </section>
      )}

      {/* Recent completed */}
      {recentDone.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-slate-800 mb-3">{t.dashboard.recentCompleted}</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">{t.dashboard.columns.name}</th>
                  <th className="px-5 py-3 font-medium text-slate-500">{t.dashboard.columns.status}</th>
                  <th className="px-5 py-3 font-medium text-slate-500">{t.dashboard.columns.language}</th>
                  <th className="px-5 py-3 font-medium text-slate-500">{t.dashboard.columns.duration}</th>
                  <th className="px-5 py-3 font-medium text-slate-500">{t.dashboard.columns.completedAt}</th>
                </tr>
              </thead>
              <tbody>
                {recentDone.map(t => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                    onClick={() => window.location.href = `/tasks/${t.id}`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-900">{t.name}</td>
                    <td className="px-5 py-3"><StatusBadge status={t.status} size="sm" /></td>
                    <td className="px-5 py-3 text-slate-600">
                      {getLanguageLabel(t.source_lang)} → {getLanguageLabel(t.target_lang)}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatDuration(t.elapsed_sec)}</td>
                    <td className="px-5 py-3 text-slate-400">{formatRelativeTime(t.finished_at ?? t.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-4">🎬</div>
          <div className="text-lg font-medium">{t.dashboard.emptyTitle}</div>
          <div className="text-sm mt-1 mb-6">{t.dashboard.emptyDescription}</div>
          <Link
            to="/tasks/new"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <PlusCircle size={15} />
            {t.common.createTask}
          </Link>
        </div>
      )}
    </PageContainer>
  )
}
