import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useApp } from '../context/useApp';
import { LanguageProvider } from '../context/FluencyLanguageContext';
import ProfileSummary from '../components/fluencyProfiling/Profilesummary';
import { localizedActivity } from '../i18n/fluencyActivities';
import { formatDateNumeric } from '../utils/format';

// All 5 activities of one practice plan, one after another, reached from
// PlanProgressStage's "View full summary" button once the 5th activity
// is done (also reachable any time from ReadingPracticePlanPage.jsx).
// "Download" reuses the same window.print()-to-PDF pattern ResultsStage
// already uses for a single report (see bhasha.css's @media print rules).
export default function ReadingPracticeSummaryPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { fluencyPlans, fluencyRuns, language, t } = useApp();

  const plan = fluencyPlans.find((item) => item.id === planId);
  if (!plan) {
    return (
      <div className="not-found-card">
        <h2>{t('fl.planNotFound')}</h2>
        <button className="primary-action" onClick={() => navigate('/fluency-practice')}>{t('nav.readingPractice')}</button>
      </div>
    );
  }

  const activities = plan.activities || [];

  return (
    <LanguageProvider>
      <div className="page-stack gc fl">
        <button type="button" className="gc-ghost fl-back" onClick={() => navigate(`/fluency-practice/${plan.id}`)}>
          <ArrowLeft size={16} />{t('fl.backToPractice')}
        </button>

        <section className="page-intro header-with-action">
          <div>
            <span className="eyebrow">{t('nav.readingPractice')}</span>
            <h2>{t('fl.summaryTitle')}</h2>
          </div>
          <button type="button" className="chunky-btn orange" onClick={() => window.print()}>
            <Printer size={17} />{t('fl.downloadSummary')}
          </button>
        </section>

        {activities.map((act, index) => {
          const matchingRuns = fluencyRuns.filter((run) => run.planId === plan.id && run.planIndex === index);
          const run = matchingRuns[matchingRuns.length - 1] || null;
          const localized = localizedActivity(act, language);

          return (
            <section className="gc-card" key={act.act_id || index}>
              <header className="gc-card-head">
                <h3>{t('fl.activityLabel', { index: index + 1 })} — {localized.name}</h3>
                {run && <span className="gc-muted">{formatDateNumeric(run.createdAt)}</span>}
              </header>
              {run
                ? <ProfileSummary result={run.result} audioUrl={null} hideRecommendations />
                : <p className="gc-muted">{t('fl.activityPending')}</p>}
            </section>
          );
        })}
      </div>
    </LanguageProvider>
  );
}
