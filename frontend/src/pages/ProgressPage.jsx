import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Flame, Star, Trophy } from 'lucide-react';
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
import { activitySummary } from '../utils/activity';
import { createSessionHistory } from '../components/grammarCheck/sessionHistory';
import {
  ERROR_META, ERROR_META_TA, ERROR_PROFILE_LABELS, ERROR_PROFILE_LABELS_TA,
  UI_TEXT,
} from '../components/grammarCheck/i18n';
import '../components/grammarCheck/grammarCheck.css';

// Counts a number up from 0 when the page opens.
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) { setValue(0); return undefined; }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

const LEVELS = ['Very Good', 'Good', 'Average', 'Below Average', 'Poor'];

// Writing level per check as columns: five level gridlines above a
// baseline (Poor = 1/5 height ... Very Good = full height), the check date
// under each column. The level shows on hover; on touch, the first tap
// shows it and a second tap on the same column opens the result.
function LevelTrend({ items, language, onOpen }) {
  const [activeId, setActiveId] = useState(null);
  const columns = items.map((item) => {
    const label = qualityLabel(item);
    return {
      item,
      rank: labelRank[label] || 1,
      label: qualityLabelText(label, language),
      date: formatDate(item.createdAt, language),
      shortDate: formatDate(item.createdAt, language).replace(/,?\s*\d{1,2}:\d{2}.*$/, ''),
    };
  });

  return (
    <div className="pg-trend" role="img" aria-label={columns.map((column) => `${column.date}: ${column.label}`).join('; ')}>
      <div className="pg-trend-plot">
        <div className="pg-trend-grid" aria-hidden="true">
          {LEVELS.map((level) => <i key={level} style={{ top: `${(5 - labelRank[level]) * 20}%` }} />)}
          <i className="baseline" style={{ top: '100%' }} />
        </div>
        <div className="pg-cols">
          {columns.map((column, index) => (
            <button
              key={column.item.id}
              type="button"
              className={`pg-col ${activeId === column.item.id ? 'active' : ''}`}
              onClick={() => (activeId === column.item.id ? onOpen(column.item) : setActiveId(column.item.id))}
              onMouseLeave={() => setActiveId(null)}
              onBlur={() => setActiveId(null)}
              aria-label={`${column.label}, ${column.date}`}
            >
              <span className="pg-col-bar" style={{ height: `${column.rank * 20}%`, animationDelay: `${index * 0.06}s` }}>
                <span className="pg-trend-tip"><strong>{column.label}</strong>{column.date}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="pg-cols pg-trend-x" aria-hidden="true">
        {columns.map((column, index) => (
          <span key={column.item.id}>{columns.length <= 6 || index === 0 || index === columns.length - 1 ? column.shortDate : ''}</span>
        ))}
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const { history, language, t, grammarRuns, fluencyRuns, readingRuns } = useApp();
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

  const previous = accepted[1] || null;
  const latestRank = labelRank[qualityLabel(latest)] || 0;
  const previousRank = labelRank[qualityLabel(previous)] || 0;
  const DeltaIcon = latestRank > previousRank ? ArrowUpRight : latestRank < previousRank ? ArrowDownRight : ArrowRight;
  const deltaTone = latestRank > previousRank ? 'up' : latestRank < previousRank ? 'down' : 'flat';

  const streak = useMemo(
    () => activitySummary([history, grammarRuns, fluencyRuns, readingRuns]).streak,
    [history, grammarRuns, fluencyRuns, readingRuns],
  );
  const completedCount = useCountUp(accepted.length);
  const streakCount = useCountUp(streak);

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

  // Error mix: share of all recent errors per type (one 100% stacked bar).
  const errorTotal = grammarErrorEntries.reduce((sum, [, count]) => sum + count, 0);
  const errorParts = grammarErrorEntries.map(([type, count]) => ({
    type, count,
    share: errorTotal ? Math.round((count / errorTotal) * 100) : 0,
    color: (GEM[type] || {}).color || '#888',
    label: (GEM[type] || {}).label || type,
  }));
  const rankedSkills = [...grammarSkills].sort((x, y) => y[1] - x[1]);

  return (
    <div className="page-stack pg">
      <section className="page-intro pg-intro">
        <span className="eyebrow">{t('progress.eyebrow')}</span>
        <h2>{t('progress.title')}</h2>
      </section>

      {!!history.length && (
        <div className="pg-summary">
          <div className={`pg-metric tone-${qualityTone(qualityLabel(latest))}`}>
            <span className="pg-metric-icon sticker-saffron"><Star size={18} fill="currentColor" /></span>
            <span className="pg-metric-text">
              <span>{t('progress.latest')}</span>
              <strong>{qualityLabel(latest) ? qualityLabelText(qualityLabel(latest), language) : '—'}</strong>
              {previous && (
                <small className={`pg-delta ${deltaTone}`}>
                  <DeltaIcon size={14} />{t('progress.vsPrevious', { label: qualityLabelText(qualityLabel(previous), language) })}
                </small>
              )}
            </span>
          </div>
          <div className={`pg-metric tone-${qualityTone(qualityLabel(best))}`}>
            <span className="pg-metric-icon sticker-orange"><Trophy size={18} /></span>
            <span className="pg-metric-text"><span>{t('progress.best')}</span><strong>{qualityLabel(best) ? qualityLabelText(qualityLabel(best), language) : '—'}</strong></span>
          </div>
          <div className="pg-metric">
            <span className="pg-metric-icon sticker-green"><BarChart3 size={18} /></span>
            <span className="pg-metric-text"><span>{t('progress.completed')}</span><strong>{completedCount}</strong></span>
          </div>
          <div className="pg-metric">
            <span className="pg-metric-icon sticker-flame"><Flame size={18} /></span>
            <span className="pg-metric-text"><span>{t('home.thisWeek')}</span><strong>{t('home.streak', { count: streakCount })}</strong></span>
          </div>
        </div>
      )}

      {accepted.length > 0 && (
        <div className="pg-row">
          <section className="pg-card">
            <header className="pg-card-head">
              <h3>{t('progress.recentJourney')}</h3>
              <span className="pg-count">{recent.length}</span>
            </header>
            <LevelTrend items={recent} language={language} onOpen={(item) => navigate(`/results/${item.id}`)} />
          </section>

          <section className="pg-card">
            <header className="pg-card-head"><h3>{t('progress.recentWriting')}</h3></header>
            <div className="pg-list">
              {accepted.slice(0, 6).map((item) => {
                const label = qualityLabel(item);
                return (
                  <button key={item.id} className="pg-list-row" onClick={() => navigate(`/results/${item.id}`)}>
                    <span className="pg-list-icon">{item.language === 'tamil' ? 'அ' : 'අ'}</span>
                    <span className="pg-list-copy">
                      <span className="pg-list-title">{languageName(item.language, language)} {t('history.writingCheck')}</span>
                      <small>{formatDate(item.createdAt, language)}</small>
                    </span>
                    <span className={`quality-pill tone-${qualityTone(label)}`}>{qualityLabelText(label, language)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {grammarTotalRuns > 0 && (
        <div className="pg-row">
          <section className="pg-card">
            <header className="pg-card-head">
              <h3>{GT.skillSectionTitle}</h3>
              {grammarIsMultiRun && <span className="pg-count">{grammarTotalRuns}</span>}
            </header>
            <p className="pg-note pg-note-top">{String(GT.skillSectionSub).replace(/^\s*[—-]\s*/, '')}</p>
            <div className="pg-skills">
              {rankedSkills.map(([skill, score]) => {
                const [name] = skill.split(' - ');
                return (
                  <div className={`pg-skill ${score === 0 ? 'zero' : ''}`} key={skill} title={skill}>
                    <span className="pg-skill-name">{name}</span>
                    <span className="pg-skill-track"><i style={{ width: `${Math.max(score, 0)}%` }} /></span>
                    <span className="pg-skill-score">{score}%</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="pg-card">
            <header className="pg-card-head"><h3>{GT.errorSectionTitle}</h3></header>
            {grammarErrorEntries.length ? (
              <div className="pg-mix">
                <div className="pg-mix-bar" role="img" aria-label={errorParts.map((part) => `${part.label}: ${part.count}`).join('; ')}>
                  {errorParts.map((part) => (
                    <i key={part.type} style={{ flexGrow: part.count, background: part.color }} title={`${part.label}: ${part.count}`} />
                  ))}
                </div>
                <ul className="pg-legend">
                  {errorParts.map((part) => (
                    <li key={part.type}>
                      <span className="pg-legend-dot" style={{ background: part.color }} />
                      <span className="pg-legend-name">{part.label}</span>
                      <span className="pg-legend-share">{part.share}%</span>
                      <strong>{part.count}</strong>
                    </li>
                  ))}
                </ul>
                <p className="pg-mix-total">{t('progress.errorTotal', { count: errorTotal })}</p>
              </div>
            ) : (
              <p className="pg-note">{GT.noErrorsFound}</p>
            )}
          </section>
        </div>
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
