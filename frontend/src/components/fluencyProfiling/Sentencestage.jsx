import { useEffect, useState } from 'react'
import { XCircle } from 'lucide-react'
import { fetchSentences } from './api'
import { useLanguage } from '../../context/FluencyLanguageContext'

// Restyled to match WriteBright's own page styling exactly, same
// treatment as Pickerstage.jsx/Studentgate.jsx (pulled outside
// .app.fluency-scope in FluencyPage.jsx). The card grid reuses new
// .wb-sentence-* classes (styles.css) rather than this component's own
// .sentence-grid/.sentence-card -- those names are still defined,
// unscoped, in fluencyProfiling.css, so reusing them here risks the
// exact class-name collision already fixed once this session for
// grammar-check's .skill-row -> .grammar-skill-row.
export default function SentenceStage({ onSelect, onBack }) {
  const [sentences, setSentences] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const { t } = useLanguage()

  useEffect(() => {
    let cancelled = false
    fetchSentences()
      .then((data) => {
        if (cancelled) return
        setSentences(data.sentences)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page-stack">
      {onBack && (
        <div className="results-topbar">
          <button type="button" onClick={onBack}>← {t('common.back')}</button>
        </div>
      )}

      {status === 'loading' && (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>{t('sentence.loading')}</p>
      )}

      {status === 'error' && (
        <div className="error-banner"><XCircle size={19} /><span>{t('sentence.error')}</span></div>
      )}

      {status === 'ready' && (
        <>
          <section className="page-intro">
            <h2>{t('sentence.heading')}</h2>
            <p>{t('sentence.subhead', { count: sentences.length })}</p>
          </section>

          <div className="wb-sentence-grid">
            {sentences.map((s) => (
              <button key={s.sentence_id} type="button" className="wb-sentence-card" onClick={() => onSelect(s)}>
                <span className="wb-sentence-id">#{s.sentence_id}</span>
                <span className="wb-sentence-text" lang="si">{s.text}</span>
                <span className="wb-sentence-badge">{s.length_class}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
