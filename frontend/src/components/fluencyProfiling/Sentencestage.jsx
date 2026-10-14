import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, LoaderCircle, XCircle } from 'lucide-react'
import { fetchSentences } from './api'
import { useLanguage } from '../../context/FluencyLanguageContext'
import { useApp } from '../../context/useApp'

// Pick a sentence from the bank; chips filter by sentence length.
export default function SentenceStage({ onSelect, onBack }) {
  const [sentences, setSentences] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [length, setLength] = useState('all')
  const { t } = useLanguage()
  const { t: appT } = useApp()

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

  const lengths = useMemo(() => [...new Set(sentences.map((s) => s.length_class).filter(Boolean))], [sentences])
  const shown = length === 'all' ? sentences : sentences.filter((s) => s.length_class === length)

  return (
    <div className="page-stack gc fl">
      {onBack && <button type="button" className="gc-ghost fl-back" onClick={onBack}><ArrowLeft size={16} />{t('common.back')}</button>}

      {status === 'loading' && <p className="fl-status"><LoaderCircle size={20} className="spin" />{t('sentence.loading')}</p>}
      {status === 'error' && <div className="error-banner"><XCircle size={19} /><span>{t('sentence.error')}</span></div>}

      {status === 'ready' && (
        <>
          <section className="page-intro">
            <h2>{t('sentence.heading')}</h2>
            <p>{t('sentence.subhead', { count: sentences.length })}</p>
          </section>

          {lengths.length > 1 && (
            <div className="gc-filters">
              {['all', ...lengths].map((key) => {
                const count = key === 'all' ? sentences.length : sentences.filter((s) => s.length_class === key).length
                return (
                  <button key={key} type="button" className={`gc-chip ${length === key ? 'on' : ''}`} aria-pressed={length === key} onClick={() => setLength(key)}>
                    {key === 'all' ? appT('progress.periodAll') : key}<b>{count}</b>
                  </button>
                )
              })}
            </div>
          )}

          <div className="fl-sentences">
            {shown.map((s, i) => (
              <button key={s.sentence_id} type="button" className="fl-sentence" onClick={() => onSelect(s)} style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}>
                <span className="fl-sentence-top">
                  <span className="fl-sentence-id">#{s.sentence_id}</span>
                  {s.length_class && <span className="fl-sentence-len">{s.length_class}</span>}
                </span>
                <span className="fl-sentence-text" lang="si">{s.text}</span>
                <span className="fl-sentence-go"><ArrowRight size={18} /></span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
