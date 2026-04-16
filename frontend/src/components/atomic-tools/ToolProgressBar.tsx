import type { AtomicJob } from '../../types/atomic-tools'

export function ToolProgressBar({ job }: { job: AtomicJob | null }) {
  if (!job) return null

  const tone =
    job.status === 'failed'
      ? 'bg-rose-500'
      : job.status === 'completed'
        ? 'bg-emerald-500'
        : 'bg-blue-500'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
        <span>{job.current_step ?? job.status}</span>
        <span>{Math.round(job.progress_percent)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${tone}`}
          style={{ width: `${job.progress_percent}%` }}
        />
      </div>
      {job.error_message && <p className="mt-3 text-sm text-rose-600">{job.error_message}</p>}
    </div>
  )
}
