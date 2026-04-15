import { useI18n } from '../../i18n/useI18n'

export function WorkflowLegend() {
  const { t } = useI18n()

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 py-1 text-xs text-slate-500">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {t.workflow.legend.title}
      </span>
      <LegendItem tone="bg-sky-500" label={t.workflow.legend.activeEdge} />
      <LegendItem tone="bg-emerald-400" label={t.workflow.legend.completedEdge} />
      <LegendItem tone="bg-amber-400" label={t.workflow.legend.blockedEdge} />
      <LegendItem tone="bg-slate-300" label={t.workflow.required} badge />
      <LegendItem tone="bg-slate-200" label={t.workflow.optional} dashed />
    </div>
  )
}

function LegendItem({ tone, label, badge = false, dashed = false }: {
  tone: string
  label: string
  badge?: boolean
  dashed?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={[
          badge ? 'h-2.5 w-2.5 rounded-full' : 'h-2 w-8 rounded-full',
          dashed ? 'border border-dashed border-slate-300 bg-white' : tone,
        ].join(' ')}
      />
      {label}
    </span>
  )
}
