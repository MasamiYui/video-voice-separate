import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { PlusCircle, Search, Trash2 } from 'lucide-react'
import { tasksApi } from '../api/tasks'
import { APP_CONTENT_MAX_WIDTH, PageContainer } from '../components/layout/PageContainer'
import { StatusBadge } from '../components/shared/StatusBadge'
import { ProgressBar } from '../components/shared/ProgressBar'
import type { Task } from '../types'
import { useI18n } from '../i18n/useI18n'

export function TaskListPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', statusFilter, search, page],
    queryFn: () =>
      tasksApi.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
        page,
        size: 20,
      }),
    refetchInterval: 5000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageCount = Math.ceil(total / 20)
  const statusOptions = [
    { value: 'all', label: t.tasks.filters.all },
    { value: 'running', label: t.tasks.filters.running },
    { value: 'pending', label: t.tasks.filters.pending },
    { value: 'succeeded', label: t.tasks.filters.succeeded },
    { value: 'failed', label: t.tasks.filters.failed },
  ]

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    if (!confirm(t.tasks.deleteConfirmMany(selected.size))) return
    for (const id of selected) {
      await deleteMutation.mutateAsync(id)
    }
    setSelected(new Set())
  }

  return (
    <PageContainer className={`${APP_CONTENT_MAX_WIDTH} space-y-5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t.tasks.title}</h1>
        <Link
          to="/tasks/new"
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <PlusCircle size={15} />
          {t.common.createTask}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder={t.tasks.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>
        <div className="flex gap-2">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100"
          >
            <Trash2 size={13} />
            {t.tasks.deleteSelected(selected.size)}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">{t.tasks.loading}</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">{t.tasks.noMatches}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length && items.length > 0}
                    onChange={e => setSelected(e.target.checked ? new Set(items.map(t => t.id)) : new Set())}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-slate-500">{t.tasks.columns.name}</th>
                <th className="px-4 py-3 font-medium text-slate-500">{t.tasks.columns.status}</th>
                <th className="px-4 py-3 font-medium text-slate-500 w-32">{t.tasks.columns.progress}</th>
                <th className="px-4 py-3 font-medium text-slate-500">{t.tasks.columns.language}</th>
                <th className="px-4 py-3 font-medium text-slate-500">{t.tasks.columns.duration}</th>
                <th className="px-4 py-3 font-medium text-slate-500">{t.tasks.columns.createdAt}</th>
                <th className="px-4 py-3 font-medium text-slate-500 w-20">{t.tasks.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selected={selected.has(task.id)}
                  onSelect={() => toggleSelect(task.id)}
                  onDelete={() => {
                    if (confirm(t.tasks.deleteConfirmOne)) deleteMutation.mutate(task.id)
                  }}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{t.tasks.totalCount(total)}</span>
          <div className="flex gap-1">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`h-8 w-8 rounded-md font-medium ${
                  p === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  )
}

function TaskRow({ task, selected, onSelect, onDelete, onClick }: {
  task: Task
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  onClick: () => void
}) {
  const { formatDuration, formatRelativeTime, getLanguageLabel, t } = useI18n()

  return (
    <tr
      className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer group ${
        task.status === 'running' ? 'border-l-2 border-l-blue-500' : ''
      }`}
    >
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="rounded"
        />
      </td>
      <td className="px-4 py-3 font-medium text-slate-900" onClick={onClick}>
        {task.name}
        <div className="text-xs text-slate-400 font-normal mt-0.5 truncate max-w-[200px]">
          {task.id}
        </div>
      </td>
      <td className="px-4 py-3" onClick={onClick}>
        <StatusBadge status={task.status} size="sm" />
      </td>
      <td className="px-4 py-3" onClick={onClick}>
        <div className="flex items-center gap-2">
          <ProgressBar value={task.overall_progress} size="sm" className="flex-1" />
          <span className="text-xs text-slate-500 w-8 text-right">{task.overall_progress.toFixed(0)}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-600" onClick={onClick}>
        {getLanguageLabel(task.source_lang)} → {getLanguageLabel(task.target_lang)}
      </td>
      <td className="px-4 py-3 text-slate-600" onClick={onClick}>
        {formatDuration(task.elapsed_sec)}
      </td>
      <td className="px-4 py-3 text-slate-400" onClick={onClick}>
        {formatRelativeTime(task.created_at)}
      </td>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 rounded-md p-1.5 text-rose-400 transition-all hover:bg-rose-50 hover:text-rose-600"
          title={t.tasks.deleteAction}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}
