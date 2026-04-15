import { useQuery } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'
import { PageContainer } from '../components/layout/PageContainer'
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
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:-translate-y-0.5 transition-transform">
      <div className="text-sm text-slate-500 font-medium">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color ?? 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

function ActiveTaskCard({ task }: { task: Task }) {
  const { getLanguageLabel } = useI18n()

  return (
    <Link
      to={`/tasks/${task.id}`}
      className="block bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-semibold text-slate-900">{task.name}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {getLanguageLabel(task.source_lang)} → {getLanguageLabel(task.target_lang)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-600">{task.overall_progress.toFixed(0)}%</span>
          <StatusBadge status={task.status} size="sm" />
        </div>
      </div>
      <ProgressBar value={task.overall_progress} size="sm" className="mb-3" />
      <PipelineGraph stages={task.stages} activeStage={task.current_stage ?? undefined} />
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
    <PageContainer className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t.dashboard.title}</h1>
        <Link
          to="/tasks/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <PlusCircle size={15} />
          {t.common.createTask}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t.dashboard.totalTasks} value={total} />
        <StatCard label={t.dashboard.running} value={running} color="text-blue-600" />
        <StatCard label={t.dashboard.completed} value={succeeded} color="text-emerald-600" />
        <StatCard label={t.dashboard.failed} value={failed} color="text-red-600" />
      </div>

      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-800">{t.dashboard.activeTasks}</h2>
            <Link to="/tasks" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
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
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <PlusCircle size={15} />
            {t.common.createTask}
          </Link>
        </div>
      )}
    </PageContainer>
  )
}
