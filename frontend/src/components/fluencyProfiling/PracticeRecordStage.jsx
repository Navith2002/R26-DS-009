import { ArrowLeft } from 'lucide-react'
import Recorder from './Recorder'
import { useLanguage } from '../../context/FluencyLanguageContext'
import { useApp } from '../../context/useApp'
import { localizedActivity } from '../../i18n/fluencyActivities'

// "කියවුම් පුහුණුව" (reading practice) recording screen: unlike
// RecordStage (bank sentence) / CustomStage (typed sentence), the
// sentence here is fixed by the practice plan's activity -- no picker,
// no typing, submit straight to /assess/custom with that exact text.
export default function PracticeRecordStage({ activity, onSubmit, onBack, submitting, submitError }) {
  const { t } = useLanguage()
  const { language, t: appT } = useApp()
  const localized = localizedActivity(activity, language)
  const sentence = activity?.practice_sentence || ''

  return (
    <div className="page-stack gc fl">
      <button type="button" className="gc-ghost fl-back" onClick={onBack}><ArrowLeft size={16} />{t('common.back')}</button>

      <section className="page-intro">
        <h2>{localized.name}</h2>
        <p>{activity?.rationale || localized.description}</p>
      </section>

      <section className="fl-reading">
        <span className="fl-reading-tag">{t('record.sentencePrefix')}</span>
        {sentence
          ? <p className="fl-reading-text" lang="si">{sentence}</p>
          : <p className="gc-muted">{appT('fl.noPracticeSentence')}</p>}
      </section>

      {sentence && <Recorder onSubmit={(audioBlob) => onSubmit(audioBlob)} submitting={submitting} submitLabel={t('record.submitBtn')} />}
      {submitError && <div className="error-banner" role="alert">{submitError}</div>}
    </div>
  )
}
