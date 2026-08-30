import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Languages, Star, Trophy } from 'lucide-react';
import { useApp } from '../context/useApp';
import {
  formatDate,
  isAcceptedQualityResult,
  labelRank,
  qualityLabel,
  qualityTone,
} from '../utils/format';
import { languageName, qualityLabelText } from '../i18n/translations';
import EmptyState from '../components/EmptyState';
import { SkillBar } from '../components/grammarCheck/Dashboard';
import { createSessionHistory } from '../components/grammarCheck/sessionHistory';
import {
  ERROR_META, ERROR_META_TA, ERROR_PROFILE_LABELS, ERROR_PROFILE_LABELS_TA,
  SKILL_COLORS, SKILL_COLORS_TA, UI_TEXT,
} from '../components/grammarCheck/i18n';
import '../components/grammarCheck/grammarCheck.css';

export default function ProgressPage() {
  const { history, language, t, grammarRuns } = useApp();
  const navigate = useNavigate();

  const accepted = useMemo(
    () => history.filter(isAcceptedQualityResult),
    [history]
  );

  // Grammar-check (spelling/grammar) skill profile -- moved here from the
  // grammar-check page's own Dashboard so it reflects recent checks
  // (grammarRuns is persisted, see AppContext) instead of resetting every
  // time you leave and come back to that page.
  //
  // Windowed to the last 30 days rather than every check ever done:
  // getCumulativeSkills()'s rate is (errors of that type / total
  // characters analyzed), and an all-time denominator only ever grows --
  // the more history piles up, the less any one new run can move the
  // rate, which reads as "stuck" even while raw error counts climb. A
  // rolling time window keeps it reflecting current practice instead of
  // drifting toward a lifetime average. Runs from before this window was
  // added have no createdAt and are excluded (their age is unknown).
  const GRAMMAR_SKILL_WINDOW_DAYS = 30;
  const grammarLang = language === 'tamil' ? 'ta' : 'si';
  const GT = UI_TEXT[grammarLang] || UI_TEXT.si;
  const GEM = grammarLang === 'ta' ? ERROR_META_TA : ERROR_META;
  const GRAMMAR_ALL_SKILLS = Object.values(grammarLang === 'ta' ? ERROR_PROFILE_LABELS_TA : ERROR_PROFILE_LABELS);
  const GRAMMAR_SKILL_COLORS = grammarLang === 'ta' ? SKILL_COLORS_TA : SKILL_COLORS;

  const grammarSessionHistory = useMemo(() => {
    const cutoff = Date.now() - GRAMMAR_SKILL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recentRuns = grammarRuns.filter((run) => run.createdAt && new Date(run.createdAt).getTime() >= cutoff);
    const sh = createSessionHistory();
    sh.runs = recentRuns;
    return sh;
  }, [grammarRuns]);

  const grammarCumulativeSkills = grammarSessionHistory.getCumulativeSkills(grammarLang);
  const { totalRuns: grammarTotalRuns } = grammarSessionHistory.getTotals();
  const grammarIsMultiRun = grammarTotalRuns > 1;
  const grammarSkills = GRAMMAR_ALL_SKILLS
    .filter((s) => s in grammarCumulativeSkills)
    .concat(Object.keys(grammarCumulativeSkills).filter((s) => !GRAMMAR_ALL_SKILLS.includes(s)))
    .map((s) => [s, grammarCumulativeSkills[s]]);
  const grammarErrorEntries = Object.entries(grammarSessionHistory.getCumulativeErrors())
    .sort((a, b) => b[1] - a[1]);

  const recent = accepted.slice(0, 10).reverse();
  const latest = accepted[0] || null;
  const best = accepted.length
    ? accepted.reduce((currentBest, item) => {
        const currentRank = labelRank[qualityLabel(item)] || 0;
        const bestRank = labelRank[qualityLabel(currentBest)] || 0;
        return currentRank > bestRank ? item : currentBest;
      }, accepted[0])
    : null;

  const languagesUsed = new Set(accepted.map((item) => item.language)).size;

  // Combined empty state: only bail out to the single "no progress yet"
  // card when NEITHER component has anything to show. Previously this
  // checked `history.length` alone (her quality-check history), which
  // meant doing only a grammar check -- never her own analyze -- hid the
  // grammar skill panel below entirely, even though it had real data to
  // show. Each section below now also gates on its own data source
  // independently, not on `accepted.length` as a proxy for "anything to
  // show at all".
  if (!history.length && !grammarTotalRuns) {
    return (
      <EmptyState
        title={t('progress.emptyTitle')}
        text={t('progress.emptyText')}
        action={<button className="primary-action" onClick={() => navigate('/analyze')}>{t('progress.check')}</button>}
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <span className="eyebrow">{t('progress.eyebrow')}</span>
        <h2>{t('progress.title')}</h2>
      </section>

      {!!history.length && (
        <div className="stat-grid kid-stat-grid">
          <div className={`stat-card quality-stat tone-${qualityTone(qualityLabel(latest))}`}>
            <Star />
            <span>{t('progress.latest')}</span>
            <strong>{qualityLabel(latest) ? qualityLabelText(qualityLabel(latest), language) : '—'}</strong>
          </div>
          <div className={`stat-card quality-stat tone-${qualityTone(qualityLabel(best))}`}>
            <Trophy />
            <span>{t('progress.best')}</span>
            <strong>{qualityLabel(best) ? qualityLabelText(qualityLabel(best), language) : '—'}</strong>
          </div>
          <div className="stat-card">
            <BarChart3 />
            <span>{t('progress.completed')}</span>
            <strong>{accepted.length}</strong>
          </div>
          <div className="stat-card">
            <Languages />
            <span>{t('progress.languages')}</span>
            <strong>{languagesUsed}</strong>
          </div>
        </div>
      )}

      {accepted.length > 0 && (
        <section className="result-card child-card">
          <div className="card-heading-row">
            <div><span className="eyebrow">{t('progress.recentJourney')}</span><h3>{t('progress.lastResults', { count: recent.length })}</h3></div>
          </div>
          <div className="quality-trend">
            {recent.map((item, index) => {
              const label = qualityLabel(item);
              const rank = labelRank[label] || 1;
              const localizedLabel = qualityLabelText(label, language);
              return (
                <button
                  className="quality-trend-item"
                  key={item.id}
                  title={`${localizedLabel} · ${formatDate(item.createdAt, language)}`}
                  onClick={() => navigate(`/results/${item.id}`)}
                >
                  <div className="quality-trend-scale">
                    <div className={`quality-trend-bar tone-${qualityTone(label)}`} style={{ height: `${20 + rank * 15}%` }} />
                  </div>
                  <span>{index + 1}</span>
                  <small>{localizedLabel}</small>
                </button>
              );
            })}
          </div>
          <p className="progress-chart-note">{t('progress.chartNote')}</p>
        </section>
      )}

      {grammarTotalRuns > 0 && (
        <section className="result-card child-card grammar-skill-panel">
          <div className="two-col" style={{ marginBottom: 0 }}>
            <div>
              <div className="section-title">
                {GT.skillSectionTitle}{' '}
                <span className="section-sub">{GT.skillSectionSub}</span>
                <span className="section-sub">{grammarIsMultiRun ? GT.sessionBadge(grammarTotalRuns) : ''}</span>
              </div>
              <div className="skill-card">
                {grammarSkills.map(([skill, score]) => (
                  <div className="grammar-skill-row" key={skill}>
                    <div className="skill-meta">
                      <span className="skill-name">{skill}</span>
                      <span className="skill-score" style={{ color: score === 0 ? '#1a9e5c' : score <= 10 ? '#d97706' : '#d63b3b' }}>
                        {score}%
                      </span>
                    </div>
                    <SkillBar score={score} color={GRAMMAR_SKILL_COLORS[skill] || '#888'} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="section-title">{GT.errorSectionTitle}</div>
              <div className="error-card">
                {grammarErrorEntries.length ? (
                  <div className="error-legend">
                    {grammarErrorEntries.map(([type, count]) => (
                      <div className="legend-row" key={type}>
                        <span className="legend-dot" style={{ background: (GEM[type] || {}).color || '#888' }} />
                        <span>{(GEM[type] || {}).label || type}</span>
                        <span className="legend-count">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 20, color: '#6b7280', fontSize: 13 }}>{GT.noErrorsFound}</div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {accepted.length > 0 && (
        <section className="result-card child-card">
          <h3>{t('progress.recentWriting')}</h3>
          <div className="progress-result-list">
            {accepted.slice(0, 8).map((item) => {
              const label = qualityLabel(item);
              return (
                <button key={item.id} onClick={() => navigate(`/results/${item.id}`)}>
                  <div className={`progress-result-script ${item.language}`}>
                    {item.language === 'tamil' ? 'அ' : 'අ'}
                  </div>
                  <div>
                    <strong>{languageName(item.language, language)} {t('history.writingCheck')}</strong>
                    <span>{formatDate(item.createdAt, language)}</span>
                  </div>
                  <span className={`quality-pill tone-${qualityTone(label)}`}>{qualityLabelText(label, language)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!!history.length && accepted.length === 0 && (
        <EmptyState
          title={t('progress.noCompletedTitle')}
          text={t('progress.noCompletedText')}
          action={<button className="primary-action" onClick={() => navigate('/analyze')}>{t('progress.tryClear')}</button>}
        />
      )}
    </div>
  );
}
