import { useQuery } from '@tanstack/react-query'
import { systemApi } from '../api/config'
import { PageContainer } from '../components/layout/PageContainer'
import { formatBytes } from '../lib/utils'
import { CheckCircle, XCircle } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'

export function SettingsPage() {
  const { t } = useI18n()
  const { data: sysInfo, isLoading } = useQuery({
    queryKey: ['system-info'],
    queryFn: systemApi.getInfo,
  })

  return (
    <PageContainer className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{t.settings.title}</h1>

      {/* System info */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">{t.settings.systemInfo}</h2>
        {isLoading ? (
          <div className="text-sm text-slate-400">{t.common.loading}</div>
        ) : sysInfo ? (
          <div className="space-y-3 text-sm">
            <InfoRow label={t.settings.fields.python} value={sysInfo.python_version} />
            <InfoRow label={t.settings.fields.platform} value={sysInfo.platform} />
            <InfoRow label={t.settings.fields.device} value={sysInfo.device} />
            <InfoRow label={t.settings.fields.cacheDir} value={sysInfo.cache_dir} mono />
            <InfoRow label={t.settings.fields.cacheSize} value={formatBytes(sysInfo.cache_size_bytes)} />
          </div>
        ) : (
          <div className="text-sm text-red-500">{t.settings.connectionError}</div>
        )}
      </section>

      {/* Model status */}
      {sysInfo && (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">{t.settings.modelStatus}</h2>
          <div className="space-y-2">
            {sysInfo.models.map(m => (
              <div key={m.name} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-700">{m.name}</span>
                <div className="flex items-center gap-1.5 text-sm">
                  {m.status === 'available' ? (
                    <>
                      <CheckCircle size={14} className="text-emerald-500" />
                      <span className="text-emerald-700">{t.settings.models.downloaded}</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} className="text-slate-400" />
                      <span className="text-slate-400">{t.settings.models.missing}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">{t.settings.about}</h2>
        <div className="text-sm text-slate-600 space-y-1">
          <p>{t.settings.aboutTitle}</p>
          <p className="text-slate-400">{t.settings.aboutSubtitle}</p>
        </div>
      </section>
    </PageContainer>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-4">
      <span className="text-slate-500 w-24 shrink-0">{label}</span>
      <span className={`text-slate-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
