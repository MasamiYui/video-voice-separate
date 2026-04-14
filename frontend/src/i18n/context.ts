import { createContext } from 'react'
import type { LanguageCode, StageKey, StageShortKey, StatusKey } from './formatters'
import type { Locale, LocaleMessages } from './messages'

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: LocaleMessages
  formatDateTime: (dateStr: string | undefined) => string
  formatDuration: (seconds: number | undefined) => string
  formatRelativeTime: (dateStr: string, now?: Date) => string
  getLanguageLabel: (code: LanguageCode | string) => string
  getStageLabel: (stage: StageKey) => string
  getStageShortLabel: (stage: StageShortKey) => string
  getStatusLabel: (status: StatusKey) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)
