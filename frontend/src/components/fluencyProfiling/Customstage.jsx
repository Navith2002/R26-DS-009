import { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, PenLine, XCircle } from 'lucide-react'
import { useLanguage } from '../../context/FluencyLanguageContext'
import Recorder from './Recorder'

// The child's own sentence: type it, confirm it, then record or upload.
export default function CustomStage({ onSubmit, onBack, submitting, submitError }) {
  const [step, setStep] = useState('text') // text | capture
  const [groundTruth, setGroundTruth] = useState('')
  const [textError, setTextError] = useState('')
  const { t } = useLanguage()

  function confirmSentence() {
    const val = groundTruth.trim()
    if (!val) {
      setTextError(t('custom.textErrorEmpty'))
      return
    }
    setTextError('')
    setGroundTruth(val)
    setStep('capture')
  }

  if (step === 'text') {
    return (
      <div className="page-stack gc fl">
        <button type="button" className="gc-ghost fl-back" onClick={onBack}><ArrowLeft size={16} />{t('common.back')}</button>

        <section className="page-intro">
          <h2>{t('custom.heading')}</h2>
          <p>{t('custom.subhead')}</p>
        </section>

        <section className="gc-card fl-compose">
          <textarea
            rows={4}
            value={groundTruth}
            onChange={(e) => { setGroundTruth(e.target.value); if (textError) setTextError('') }}
            placeholder="උදාහරණ: අම්මා කඩේට ගියා."
            lang="si"
            aria-invalid={Boolean(textError)}
          />
          <div className="fl-compose-foot">
            <button type="button" className="chunky-btn orange" onClick={confirmSentence}>{t('custom.confirmBtn')} <ArrowRight size={18} /></button>
          </div>
          {textError && <div className="error-banner" role="alert"><XCircle size={18} /><span>{textError}</span></div>}
        </section>
      </div>
    )
  }

  return (
    <div className="page-stack gc fl">
      <button type="button" className="gc-ghost fl-back" onClick={onBack}><ArrowLeft size={16} />{t('common.back')}</button>

      <section className="fl-reading">
        <span className="fl-reading-tag ok"><CheckCircle2 size={15} />{t('custom.confirmedLabel')}</span>
        <p className="fl-reading-text" lang="si">{groundTruth}</p>
        <button type="button" className="gc-ghost fl-reading-edit" onClick={() => setStep('text')}><PenLine size={15} />{t('custom.edit')}</button>
      </section>

      <Recorder onSubmit={(audioBlob) => onSubmit({ audioBlob, groundTruth })} submitting={submitting} submitLabel={t('custom.submitAndAnalyse')} />
      {submitError && <div className="error-banner" role="alert">{submitError}</div>}
    </div>
  )
}
