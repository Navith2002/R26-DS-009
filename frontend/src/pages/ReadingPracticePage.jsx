import { useNavigate } from 'react-router-dom';
import { Clock3 } from 'lucide-react';
import { useApp } from '../context/useApp';
import { formatDateNumeric } from '../utils/format';
import EmptyState from '../components/EmptyState';

// "කියවුම් පුහුණුව" -- list of practice plans (each a frozen set of 5
// activities recommended after one fluency assessment, see
// AppContext.jsx's createFluencyPlan). Same card-list layout as the
// "කියවීමේ ප්‍රවීණතා පරීක්ෂණ" section of HistoryPage.jsx, but this page
// only ever shows fluencyPlans -- it never touches history/grammarRuns/
// readingRuns, so the other 3 components' own history views are
// untouched.
export default function ReadingPracticePage() {
  const { fluencyPlans, fluencyRuns, language, t } = useApp();
  const navigate = useNavigate();

  if (!fluencyPlans.length) {
    return (
      <EmptyState
        title={t('fl.planEmptyTitle')}
        text={t('fl.planEmptyText')}
        action={<button className="primary-action" onClick={() => navigate('/fluency')}>{t('nav.fluency')}</button>}
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <span className="eyebrow">{t('nav.readingPractice')}</span>
        <h2>{t('fl.planTitle')}</h2>
      </section>

      <div className="history-cards">
        {fluencyPlans.map((plan) => {
          const activities = plan.activities || [];
          const doneCount = activities.filter((_, index) =>
            fluencyRuns.some((run) => run.planId === plan.id && run.planIndex === index)
          ).length;
          const complete = activities.length > 0 && doneCount === activities.length;

          return (
            <button
              key={plan.id}
              className="history-card kid-history-card"
              onClick={() => navigate(`/fluency-practice/${plan.id}`)}
            >
              <div className={`history-script ${plan.language}`}><span>{plan.language === 'tamil' ? 'அ' : 'අ'}</span></div>
              <div className="history-copy">
                <small>{t('fl.planTitle')}</small>
                <h3>{t('fl.planProgress', { done: doneCount, total: activities.length })}</h3>
                <p><Clock3 size={13} /> {formatDateNumeric(plan.createdAt)}</p>
              </div>
              <div className="history-friendly-meta">
                <span className={`quality-pill tone-${complete ? 'good' : 'average'}`}>
                  {t('fl.planProgress', { done: doneCount, total: activities.length })}
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
