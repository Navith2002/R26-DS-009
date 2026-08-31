import ProfileSummary from './ProfileSummary'
import { useLanguage } from '../../context/FluencyLanguageContext'

export default function Dashboard({
  studentId,
  result,
  audioUrl,
  loading,
  loadError,
  onStart,
  onSwitchStudent,
}) {
  const { t } = useLanguage()

  return (
    <section className="stage dashboard">
      <div className="dashboard__topbar">
        {studentId ? (
          <p className="dashboard__student">
            {t('dashboard.studentPrefix')} {studentId}
          </p>
        ) : (
          <p className="dashboard__student">{t('dashboard.anonymous')}</p>
        )}
        <button type="button" className="link-back dashboard__switch" onClick={onSwitchStudent}>
          {t('dashboard.switchStudent')}
        </button>
      </div>

      {loading && <p className="hint">{t('dashboard.loading')}</p>}

      {!loading && !result && (
        <div className="dashboard__empty">
          <h1>{t('dashboard.welcomeBack')}</h1>
          <p className="gate__body">
            {loadError ? t('dashboard.noProfileFound') : t('dashboard.emptyBody')}
          </p>
          <button className="btn btn--primary" onClick={onStart}>
            ▶ {t('dashboard.startBtn')}
          </button>
        </div>
      )}

      {!loading && result && (
        <>
          <ProfileSummary result={result} audioUrl={audioUrl} />

          <button type="button" className="reassess-strip" onClick={onStart}>
            <span className="reassess-strip__icon">↺</span>
            <span className="reassess-strip__body">
              <span className="reassess-strip__title">{t('dashboard.reassessTitle')}</span>
              <span className="reassess-strip__desc">{t('dashboard.reassessDesc')}</span>
            </span>
            <span className="reassess-strip__arrow">→</span>
          </button>
        </>
      )}
    </section>
  )
}