import { useQuery } from '@tanstack/react-query'
import { atomicToolsApi } from '../api/atomic-tools'
import { ToolCard } from '../components/atomic-tools/ToolCard'
import { PageContainer } from '../components/layout/PageContainer'
import { useI18n } from '../i18n/useI18n'

const CATEGORY_ORDER = ['audio', 'speech', 'video'] as const

export function ToolListPage() {
  const { locale, t } = useI18n()
  const { data: tools = [] } = useQuery({
    queryKey: ['atomic-tools'],
    queryFn: atomicToolsApi.listTools,
    staleTime: 30_000,
  })

  const toolsByCategory = CATEGORY_ORDER.map(category => ({
    category,
    tools: tools.filter(tool => tool.category === category),
  })).filter(group => group.tools.length > 0)

  return (
    <PageContainer className="space-y-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white px-6 py-8">
        <div className="max-w-3xl space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">
            {t.atomicTools.sectionEyebrow}
          </div>
          <h1 className="text-3xl font-semibold text-slate-900">{t.atomicTools.title}</h1>
          <p className="text-sm leading-7 text-slate-600">{t.atomicTools.description}</p>
        </div>
      </section>

      {toolsByCategory.map(group => (
        <section key={group.category} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {t.atomicTools.categories[group.category]}
            </h2>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {group.tools.length}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.tools.map(tool => (
              <ToolCard
                key={tool.tool_id}
                tool={tool}
                title={locale === 'zh-CN' ? tool.name_zh : tool.name_en}
                description={locale === 'zh-CN' ? tool.description_zh : tool.description_en}
                categoryLabel={t.atomicTools.categories[tool.category]}
              />
            ))}
          </div>
        </section>
      ))}
    </PageContainer>
  )
}
