import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/useI18n'
import type { ToolInfo } from '../../types/atomic-tools'

interface ToolCardProps {
  tool: ToolInfo
  title: string
  description: string
  categoryLabel: string
}

export function ToolCard({ tool, title, description, categoryLabel }: ToolCardProps) {
  const { t } = useI18n()

  return (
    <Link
      to={`/tools/${tool.tool_id}`}
      className="group rounded-3xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
    >
      <div className="mb-3 inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
        {categoryLabel}
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-600">
        {t.atomicTools.actions.useTool}
        <ArrowRight size={16} className="transition group-hover:translate-x-1" />
      </div>
    </Link>
  )
}
