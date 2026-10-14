import { createContext, useCallback, useContext } from 'react'
import { useApp } from './useApp'
import { translations } from '../i18n/fluencyTranslations'

export const LANGUAGES = [
  { code: 'si', label: 'සිංහල', native: 'සිංහල' },
  { code: 'ta', label: 'தமிழ்', native: 'தமிழ்' },
]
const DEFAULT_LANG = 'si'
const LanguageContext = createContext(null)

// Looks up a dot-path (e.g. "gate.heading") inside a translation object.
function lookup(dict, path) {
  return path
    .split('.')
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), dict)
}

export function LanguageProvider({ children }) {
  const { language, setLanguage } = useApp()
  const lang = language === 'tamil' ? 'ta' : 'si'
  const setLang = useCallback((next) => {
    if (next === 'si' || next === 'ta') setLanguage(next === 'ta' ? 'tamil' : 'sinhala')
  }, [setLanguage])

  // Always resolves to a string: falls back to Sinhala, then to the raw
  // key itself, so a missing translation never breaks the UI.
  const t = useCallback(
    (key, vars) => {
      const raw = lookup(translations[lang], key) ?? lookup(translations[DEFAULT_LANG], key) ?? key
      if (!vars) return raw
      return Object.entries(vars).reduce(
        (str, [name, value]) => str.replaceAll(`{${name}}`, value),
        raw,
      )
    },
    [lang],
  )

  // Like t(), but for keys that may legitimately not exist (e.g. dynamic
  // backend-driven names) — takes an explicit fallback instead of echoing
  // the lookup path back.
  const td = useCallback(
    (key, fallback) => {
      const raw = lookup(translations[lang], key) ?? lookup(translations[DEFAULT_LANG], key)
      return raw !== undefined ? raw : fallback
    },
    [lang],
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, languages: LANGUAGES, t, td }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}