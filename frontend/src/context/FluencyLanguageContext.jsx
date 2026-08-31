import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { translations } from '../i18n/fluencyTranslations'

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'si', label: 'Sinhala', native: 'සිංහල' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
]

const STORAGE_KEY = 'wachana_lang'
const DEFAULT_LANG = 'en'

const LanguageContext = createContext(null)

function readStoredLang() {
  if (typeof window === 'undefined') return DEFAULT_LANG
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved && translations[saved] ? saved : DEFAULT_LANG
  } catch {
    return DEFAULT_LANG
  }
}

// Looks up a dot-path (e.g. "gate.heading") inside a translation object.
function lookup(dict, path) {
  return path
    .split('.')
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), dict)
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLang)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // localStorage unavailable (private mode etc.) — language just won't persist
    }
    // Only the interface language, not the Sinhala reading content, follows
    // this attribute — components that render the actual sentences keep
    // their own explicit lang="si".
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next) => {
    if (translations[next]) setLangState(next)
  }, [])

  // Always resolves to a string: falls back to English, then to the raw
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