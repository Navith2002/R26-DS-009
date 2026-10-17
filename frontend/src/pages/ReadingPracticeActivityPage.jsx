import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mic } from 'lucide-react';
import { useApp } from '../context/useApp';
import { LanguageProvider } from '../context/FluencyLanguageContext';
import ResultsStage from '../components/fluencyProfiling/Resultsstage';
import { localizedActivity } from '../i18n/fluencyActivities';

const LEVELS = { Beginner: 'account.beginner', Intermediate: 'account.intermediate', Advanced: 'account.advanced' };

// One activity inside a practice plan. Already completed -> show the
// same full report HistoryPage/FluencyResultPage.jsx shows for any past
// fluency run (recommendations included), plus an extra "Assess Reading"
// button to redo this exact sentence. Not yet attempted -> show the
// activity's own card and the same button to go record it for the first
// time. Either way, "Assess Reading" hands off to FluencyPage.jsx via
// router state -- see that file's planActivity handling.
export default function ReadingPracticeActivityPage() {
  const { planId, index } = useParams();
  const navigate = useNavigate();
  const { fluencyPlans, fluencyRuns, language, t } = useApp();
  const planIndex = Number(index);

  const plan = fluencyPlans.find((item) => item.id === planId);
  const activity = plan?.activities?.[planIndex];

  if (!plan || !activity) {
    return (
      <div className="not-found-card">
        <h2>{t('fl.planNotFound')}</h2>
        <button className="primary-action" onClick={() => navigate('/fluency-practice')}>{t('nav.readingPractice')}</button>
      </div>
    );
  }

  const matchingRuns = fluencyRuns.filter((run) => run.planId === plan.id && run.planIndex === planIndex);
  // Latest attempt wins if the student re-assessed this activity more than once.
  const run = matchingRuns[matchingRuns.length - 1] || null;
  const localized = localizedActivity(activity, language);

  function assessReading() {
    navigate('/fluency', { state: { planActivity: { planId: plan.id, planIndex, activity } } });
  }

  const backButton = (
    <button type="button" className="gc-ghost fl-back" onClick={() => navigate(`/fluency-practice/${plan.id}`)}>
      <ArrowLeft size={16} />{t('fl.backToPractice')}
    </button>
  );

  if (run) {
    return (
      <LanguageProvider>
        <div className="page-stack">
          {backButton}
          <ResultsStage
            result={run.result}
            audioUrl={null}
            when={run.createdAt}
            onRecordAnother={() => navigate('/fluency')}
            onBackToDashboard={() => navigate(`/fluency-practice/${plan.id}`)}
          />
          <button type="button" className="chunky-btn orange" onClick={assessReading}>
            <Mic size={17} />{t('fl.reassessReading')}
          </button>
        </div>
      </LanguageProvider>
    );
  }

  return (
    <div className="page-stack">
      {backButton}
      <section className="page-intro">
        <span className="eyebrow">{t(LEVELS[activity.difficulty] || 'account.beginner')}</span>
        <h2>{localized.name}</h2>
        <p>{activity.rationale || localized.description}</p>
      </section>
      {activity.practice_sentence && (
        <section className="gc-card fl-reading">
          <p className="fl-reading-text" lang="si">{activity.practice_sentence}</p>
        </section>
      )}
      <button type="button" className="chunky-btn orange" onClick={assessReading}>
        <Mic size={17} />{t('fl.assessReading')}
      </button>
    </div>
  );
}
