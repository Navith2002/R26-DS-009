import { useLanguage } from '../../context/FluencyLanguageContext'

// Persistent, app-wide language toggle. Rendered once in App.jsx's shared
// <header>, which sits outside the `screen` switch — so it's on screen for
// every stage (gate, dashboard, picker, sentence, record, custom, results)
// without needing to be threaded into each one individually.
export default function LanguageSwitcher() {
  const { lang, setLang, languages, t } = useLanguage()

  return (
    <div className="lang-switch" role="group" aria-label={t('app.languageLabel')}>
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          className={`lang-switch__btn ${lang === l.code ? 'lang-switch__btn--active' : ''}`}
          aria-pressed={lang === l.code}
          onClick={() => setLang(l.code)}
        >
          {l.native}
        </button>
      ))}
    </div>
  )
}