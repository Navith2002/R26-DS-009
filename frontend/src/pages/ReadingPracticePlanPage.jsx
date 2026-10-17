import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import { useApp } from '../context/useApp';
import { localizedActivity } from '../i18n/fluencyActivities';

const LEVELS = { Beginner: 'account.beginner', Intermediate: 'account.intermediate', Advanced: 'account.advanced' };

// One practice plan's 5 activities, each showing whether the student has
// already completed it. Selecting one goes to ReadingPracticeActivityPage.jsx.
export default function ReadingPracticePlanPage() {
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
  const doneCount = activities.filter((_, index) =>
    fluencyRuns.some((run) => run.planId === plan.id && run.planIndex === index)
  ).length;

  return (
    <div className="page-stack">
      <button type="button" className="gc-ghost fl-back" onClick={() => navigate('/fluency-practice')}>
        <ArrowLeft size={16} />{t('fl.backToPractice')}
      </button>

      <section className="page-intro">
        <span className="eyebrow">{t('nav.readingPractice')}</span>
        <h2>{t('fl.planTitle')}</h2>
        <p>{t('fl.planProgress', { done: doneCount, total: activities.length })}</p>
      </section>

      <div className="history-cards">
        {activities.map((act, index) => {
          const done = fluencyRuns.some((run) => run.planId === plan.id && run.planIndex === index);
          const activity = localizedActivity(act, language);
          return (
            <button
              key={act.act_id || index}
              className="history-card kid-history-card"
              onClick={() => navigate(`/fluency-practice/${plan.id}/activity/${index}`)}
            >
              <div className="history-script sinhala"><span>{index + 1}</span></div>
              <div className="history-copy">
                <small>{t(LEVELS[act.difficulty] || 'account.beginner')}</small>
                <h3>{activity.name}</h3>
                <p>{t('fl.activityLabel', { index: index + 1 })}</p>
              </div>
              <div className="history-friendly-meta">
                <span className={`quality-pill tone-${done ? 'good' : 'average'}`}>
                  {done
                    ? <><CheckCircle2 size={14} /> {t('fl.activityCompleted')}</>
                    : <><Circle size={14} /> {t('fl.activityPending')}</>}
                </span>
              </div>
              <span className="history-arrow">→</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
