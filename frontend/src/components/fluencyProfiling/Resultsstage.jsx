import ProfileSummary from './ProfileSummary'
import { useLanguage } from '../../context/FluencyLanguageContext'

export default function ResultsStage({ result, audioUrl, onRecordAnother, onBackToDashboard }) {
  const { t } = useLanguage()

  return (
    <section className="stage results-stage">
      <ProfileSummary result={result} audioUrl={audioUrl} />

      <div className="results-stage__actions">
        <button className="btn btn--ghost" onClick={onBackToDashboard}>
          {t('results.backToDashboard')}
        </button>
        <button className="btn btn--primary" onClick={onRecordAnother}>
          {t('results.readAnother')}
        </button>
      </div>
    </section>
  )
}