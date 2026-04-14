import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isLocale,
  messages,
  type Locale,
} from './messages'
import {
  formatDateTimeForLocale,
  formatDurationForLocale,
  formatRelativeTimeForLocale,
  getLanguageLabel,
  getStageLabel,
  getStageShortLabel,
  getStatusLabel,
} from './formatters'
import { I18nContext, type I18nContextValue } from './context'

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(stored) ? stored : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => readStoredLocale())

  useEffect(() => {
    document.documentElement.lang = locale

    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch {
      // Ignore storage failures and keep the current locale in memory.
    }
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: messages[locale],
      formatDateTime: (dateStr) => formatDateTimeForLocale(dateStr, locale),
      formatDuration: (seconds) => formatDurationForLocale(seconds, locale),
      formatRelativeTime: (dateStr, now) => formatRelativeTimeForLocale(dateStr, locale, now),
      getLanguageLabel: (code) => getLanguageLabel(code, locale),
      getStageLabel: (stage) => getStageLabel(stage, locale),
      getStageShortLabel: (stage) => getStageShortLabel(stage, locale),
      getStatusLabel: (status) => getStatusLabel(status, locale),
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
