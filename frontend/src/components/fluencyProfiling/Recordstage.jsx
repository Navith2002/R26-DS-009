import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '../../context/FluencyLanguageContext'
import Recorder from './Recorder'

// Read the chosen bank sentence aloud, then submit the recording.
export default function RecordStage({ sentence, onSubmit, onBack, submitting, submitError }) {
  const { t } = useLanguage()

  return (
    <div className="page-stack gc fl">
      <button type="button" className="gc-ghost fl-back" onClick={onBack}><ArrowLeft size={16} />{t('record.backDifferent')}</button>

      <section className="fl-reading">
        <span className="fl-reading-tag">{t('record.sentencePrefix')} #{sentence.sentence_id}{sentence.length_class ? ` · ${sentence.length_class}` : ''}</span>
        <p className="fl-reading-text" lang="si">{sentence.text}</p>
      </section>

      <Recorder onSubmit={onSubmit} submitting={submitting} submitLabel={t('record.submitBtn')} />
      {submitError && <div className="error-banner" role="alert">{submitError}</div>}
    </div>
  )
}
