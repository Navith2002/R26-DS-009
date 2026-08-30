import { useEffect, useState } from 'react'
import { fetchSentences } from './api'
import { useLanguage } from '../../context/FluencyLanguageContext'

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
    <section className="stage">
      {onBack && (
        <button type="button" className="link-back" onClick={onBack}>
          ← {t('common.back')}
        </button>
      )}

      {status === 'loading' && <p className="hint">{t('sentence.loading')}</p>}

      {status === 'error' && <p className="hint hint--error">{t('sentence.error')}</p>}

      {status === 'ready' && (
        <>
          <h2>{t('sentence.heading')}</h2>
          <p className="stage__subhead">{t('sentence.subhead', { count: sentences.length })}</p>
          <div className="sentence-grid">
            {sentences.map((s) => (
              <button key={s.sentence_id} className="sentence-card" onClick={() => onSelect(s)}>
                <span className="sentence-card__id">#{s.sentence_id}</span>
                <span className="sentence-card__text" lang="si">
                  {s.text}
                </span>
                <span className="sentence-card__badge">{s.length_class}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}