import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, AudioLines, Award, BookOpen, Camera, Flame,
  Footprints, Lock, Mic, PenLine, Sparkles, SpellCheck2, Star, Trophy, Volume2,
} from 'lucide-react';
import { useApp } from '../context/useApp';
import { formatDate, isAcceptedQualityResult, labelRank, qualityLabel, qualityTone } from '../utils/format';
import { qualityLabelText } from '../i18n/translations';
import EmptyState from '../components/EmptyState';
import { activitySummary } from '../utils/activity';
import { fluencyText } from '../utils/moduleSummary';
import { burstConfetti } from '../utils/confetti';
import { createSessionHistory } from '../components/grammarCheck/sessionHistory';
import { ERROR_PROFILE_LABELS, ERROR_PROFILE_LABELS_TA, UI_TEXT } from '../components/grammarCheck/i18n';
import '../components/grammarCheck/grammarCheck.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const SKILL_WINDOW_DAYS = 30;
const TYPE_META = {
  writing: { icon: Camera, tone: 'orange', nav: 'nav.check' },
  grammar: { icon: SpellCheck2, tone: 'green', nav: 'nav.grammarCheck' },
  fluency: { icon: Mic, tone: 'saffron', nav: 'nav.fluency' },
  reading: { icon: Volume2, tone: 'sky', nav: 'nav.readingError' },
};

const startOfDay = (date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
const dayKey = (date) => startOfDay(date).getTime();
const grammarAccuracy = (run) => (run?.total > 0 ? Math.round((run.correct / run.total) * 100) : null);
const pct = (value) => (value === null || value === undefined ? '—' : `${value}%`);

// Every saved activity as { id, type, at, score (0-100 or null), to }.
function allActivities({ history, grammarRuns, fluencyRuns, readingRuns }) {
  return [
    ...history.map((item) => ({
      id: item.id, type: 'writing', at: item.createdAt, to: `/results/${item.id}`,
      score: isAcceptedQualityResult(item) ? (labelRank[qualityLabel(item)] || 0) * 20 : null,
    })),
    ...grammarRuns.map((run) => ({ id: run.id, type: 'grammar', at: run.createdAt, to: `/grammar-results/${run.id}`, score: grammarAccuracy(run) })),
    ...fluencyRuns.map((run) => ({
      id: run.id, type: 'fluency', at: run.createdAt, to: `/fluency-results/${run.id}`,
      score: Math.round(Math.max(0, 1 - Number(run.result?.wer ?? 1)) * 100),
    })),
    ...readingRuns.map((run) => ({ id: run.id, type: 'reading', at: run.createdAt, to: `/reading-results/${run.id}`, score: Math.round(Number(run.result?.accuracy || 0)) })),
  ].filter((item) => item.at && !Number.isNaN(new Date(item.at).getTime()));
}

/* ---------- A. Metric card: number + a tiny visual + tooltip ---------- */
function Metric({ icon: Icon, tone, label, value, sub, tip, visual, onClick }) {
  return (
    <button type="button" className={`pv-metric tone-${tone}`} onClick={onClick} title={tip}>
      <span className="pv-metric-icon"><Icon size={18} /></span>
      <span className="pv-metric-body">
        <span className="pv-metric-label">{label}</span>
        <strong>{value}</strong>
        {sub && <span className="pv-metric-sub">{sub}</span>}
      </span>
      {visual && <span className="pv-metric-visual" aria-hidden="true">{visual}</span>}
    </button>
  );
}

function MiniRing({ value }) {
  const circumference = 2 * Math.PI * 17;
  return (
    <svg className="pv-mini-ring" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="17" className="track" />
      <circle cx="22" cy="22" r="17" className="value" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - (value || 0) / 100)} />
    </svg>
  );
}

function MiniBars({ values }) {
  const peak = Math.max(1, ...values);
  return (
    <span className="pv-mini-bars">
      {values.map((value, i) => <i key={i} className={value ? '' : 'empty'} style={{ height: `${Math.max((value / peak) * 100, 12)}%` }} />)}
    </span>
  );
}

function WeekDots({ week }) {
  return <span className="pv-week-dots">{week.map((day, i) => <i key={i} className={`${day.done ? 'done' : ''} ${day.isToday ? 'today' : ''}`} />)}</span>;
}

/* ---------- C. Handwriting quality over time ----------
   One column per day, its height = that day's latest quality level
   (Poor = 1/5 ... Very Good = full), coloured by level.
   Week: all seven days Mon-Sun, empty slots on days without a check.
   Month / All: only the days that have a saved check.
   Hover / focus / first tap shows level + date; a second tap opens it. */
const PERIOD_DAYS = { week: 7, month: 30, all: Infinity };

function QualityChart({ history, language, t, onOpen }) {
  const [period, setPeriod] = useState('all');
  const [hover, setHover] = useState(null);
  const points = useMemo(() => {
    const short = (date) => formatDate(date, language).replace(/,?\s*\d{4}.*$/, '');
    // Latest accepted check per calendar day.
    const latestPerDay = new Map();
    history.filter(isAcceptedQualityResult).forEach((item) => {
      const key = dayKey(item.createdAt);
      const current = latestPerDay.get(key);
      if (!current || new Date(item.createdAt) > new Date(current.createdAt)) latestPerDay.set(key, item);
    });
    const toPoint = (key, item, label) => {
      if (!item) return { key, item: null, dayLabel: label };
      const quality = qualityLabel(item);
      return {
        key, item, dayLabel: label, rank: labelRank[quality] || 1, tone: qualityTone(quality),
        label: qualityLabelText(quality, language), date: formatDate(item.createdAt, language),
      };
    };

    if (period === 'week') {
      const weekNames = t('home.weekDays').split(',');
      const monday = startOfDay(new Date());
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      return weekNames.map((name, i) => {
        const day = new Date(monday); day.setDate(monday.getDate() + i);
        return toPoint(day.getTime(), latestPerDay.get(day.getTime()), `${name} ${day.getDate()}`);
      });
    }
    // 'all' has no cutoff (Date.now() - Infinity would be an invalid date).
    const cutoff = period === 'all' ? -Infinity : startOfDay(Date.now() - PERIOD_DAYS[period] * DAY_MS).getTime();
    return [...latestPerDay.entries()]
      .filter(([key]) => key >= cutoff)
      .sort((x, y) => x[0] - y[0])
      .slice(-14)
      .map(([key, item]) => toPoint(key, item, short(item.createdAt)));
  }, [history, period, language, t]);
  const hasData = points.some((point) => point.item);
  const latestId = [...points].reverse().find((point) => point.item)?.item.id;
  const periods = [['week', t('progress.periodWeek')], ['month', t('progress.periodMonth')], ['all', t('progress.periodAll')]];

  return (
    <section className="pv-card pv-activity">
      <header className="pv-card-head">
        <h3>{t('pv.qualityTitle')}</h3>
        <span className="pv-seg" role="group">
          {periods.map(([key, label]) => (
            <button key={key} type="button" className={period === key ? 'on' : ''} aria-pressed={period === key} onClick={() => { setPeriod(key); setHover(null); }}>{label}</button>
          ))}
        </span>
      </header>
      {hasData || period === 'week' ? (
        <div className="pv-qbars">
          <div className="pv-qbars-grid" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
          <div className="pv-qbars-cols">
            {points.map((point, i) => (point.item ? (
              <button
                key={point.key}
                type="button"
                className={`pv-qbar tone-${point.tone} ${hover === i ? 'on' : ''} ${point.item.id === latestId ? 'latest' : ''}`}
                aria-label={`${point.label}, ${point.date}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => (hover === i ? onOpen(point.item) : setHover(i))}
              >
                <span className="pv-qbar-track">
                  <span className="pv-qbar-fill" style={{ height: `${point.rank * 20}%`, animationDelay: `${i * 0.05}s` }}>
                    <span className="pv-qbar-tip"><strong>{point.label}</strong>{point.date.replace(/,?\s*\d{1,2}:\d{2}.*$/, '')}</span>
                  </span>
                </span>
                <span className="pv-qbar-date">{point.dayLabel}</span>
              </button>
            ) : (
              <span key={point.key} className="pv-qbar empty" aria-hidden="true">
                <span className="pv-qbar-track"><span className="pv-qbar-slot" /></span>
                <span className="pv-qbar-date">{point.dayLabel}</span>
              </span>
            )))}
          </div>
        </div>
      ) : (
        <p className="pv-muted pv-empty">{t('progress.noneInPeriod')}</p>
      )}
    </section>
  );
}

/* ---------- D. Skill profile: every category in its usual order ---------- */
function SkillBreakdown({ skills, GT }) {
  return (
    <section className="pv-card pv-skills">
      <header className="pv-card-head"><h3>{GT.skillSectionTitle}</h3></header>
      {skills.map(([skill, score]) => (
        <div key={skill} className={`pv-skill ${score === 0 ? 'zero' : ''}`} title={skill}>
          <span className="pv-skill-name">{skill.split(/\s+-\s+/)[0]}</span>
          <span className="pv-skill-track"><i style={{ width: `${score}%` }} /></span>
          <span className="pv-skill-score">{score}%</span>
        </div>
      ))}
    </section>
  );
}

/* ---------- E. Radial performance card ---------- */
function Performance({ tone, icon: Icon, title, latest, previous, tests, extra, onClick, t }) {
  const delta = latest !== null && previous !== null ? latest - previous : null;
  const Trend = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : ArrowRight;
  const circumference = 2 * Math.PI * 46;
  return (
    <button type="button" className={`pv-card pv-perf tone-${tone}`} onClick={onClick}>
      <span className="pv-ring">
        <svg viewBox="0 0 110 110" aria-hidden="true">
          <circle cx="55" cy="55" r="46" className="pv-ring-track" />
          <circle cx="55" cy="55" r="46" className="pv-ring-value" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - (latest || 0) / 100)} />
        </svg>
        <strong>{pct(latest)}</strong>
      </span>
      <span className="pv-perf-body">
        <span className="pv-perf-title"><Icon size={18} />{title}</span>
        <span className="pv-perf-facts">
          <span><small>{t('pv.tests')}</small><b>{tests}</b></span>
          <span><small>{t('pv.prevScore')}</small><b>{pct(previous)}</b></span>
          <span><small>{t('pv.change')}</small><b className={`pv-trend ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>{delta === null ? '—' : <><Trend size={15} />{Math.abs(delta)}</>}</b></span>
        </span>
        {extra && <span className="pv-perf-extra">{extra}</span>}
      </span>
    </button>
  );
}

/* ---------- B. Activity calendar heatmap ----------
   Darker = more activities that day; hover shows the count. */
function ActivityCalendar({ activities, language, t }) {
  const [range, setRange] = useState(30);
  const today = startOfDay(new Date());
  const byDay = useMemo(() => {
    const map = new Map();
    activities.forEach((a) => { const key = dayKey(a.at); map.set(key, (map.get(key) || 0) + 1); });
    return map;
  }, [activities]);
  const days = Array.from({ length: range }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (range - 1 - i)); return d;
  });
  const lead = (days[0].getDay() + 6) % 7; // Monday-first offset
  const weekNames = t('home.weekDays').split(',');
  const level = (count) => (count >= 3 ? 3 : count);

  return (
    <section className="pv-card pv-calendar">
      <header className="pv-card-head">
        <h3>{t('pv.calendarTitle')}</h3>
        <span className="pv-seg" role="group">
          {[[7, t('pv.days7')], [30, t('pv.days30')]].map(([value, label]) => (
            <button key={value} type="button" className={range === value ? 'on' : ''} aria-pressed={range === value} onClick={() => setRange(value)}>{label}</button>
          ))}
        </span>
      </header>
      <div className="pv-cal-grid">
        {weekNames.map((name) => <span key={name} className="pv-cal-head">{name}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} />)}
        {days.map((day) => {
          const key = day.getTime();
          const count = byDay.get(key) || 0;
          return (
            <span key={key} className={`pv-cal-day lv-${level(count)} ${key === today.getTime() ? 'today' : ''}`}
              title={`${formatDate(day, language).replace(/,?\s*\d{1,2}:\d{2}.*$/, '')} · ${t('pv.countLabel', { count })}`}
              aria-label={`${formatDate(day, language)}: ${t('pv.countLabel', { count })}`}>
              {day.getDate()}
            </span>
          );
        })}
      </div>
      <div className="pv-cal-legend" aria-hidden="true">
        <span>{t('pv.less')}</span><i className="lv-0" /><i className="lv-1" /><i className="lv-2" /><i className="lv-3" /><span>{t('pv.more')}</span>
      </div>
    </section>
  );
}

/* ---------- Achievements + recommended practice ---------- */
function Achievements({ badges, recommendation, t }) {
  return (
    <section className="pv-card pv-achievements">
      <header className="pv-card-head"><h3>{t('pv.achievements')}</h3></header>
      <div className="pv-badges">
        {badges.map(({ key, icon: Icon, label, tip, unlocked, tone }) => (
          <button key={key} type="button" className={`pv-badge tone-${tone} ${unlocked ? 'unlocked' : 'locked'}`}
            onClick={(event) => unlocked && burstConfetti(event, 16)} aria-label={`${label}: ${unlocked ? t('pv.unlocked') : tip}`}>
            <span className="pv-badge-icon">{unlocked ? <Icon size={22} /> : <Lock size={18} />}</span>
            <span className="pv-badge-label">{label}</span>
            <span className="pv-pop" role="tooltip">{unlocked ? t('pv.unlocked') : tip}</span>
          </button>
        ))}
      </div>
      {recommendation && (
        <button type="button" className="pv-recommend" onClick={recommendation.onClick}>
          <span className="pv-recommend-icon"><Sparkles size={18} /></span>
          <span className="pv-recommend-body">
            <small>{t('pv.recommend')}</small>
            <span>{recommendation.text}</span>
          </span>
          <ArrowRight size={18} />
        </button>
      )}
    </section>
  );
}

export default function ProgressPage() {
  const { history, language, t, grammarRuns, fluencyRuns, readingRuns } = useApp();
  const navigate = useNavigate();
  const isTamil = language === 'tamil';

  const activities = useMemo(
    () => allActivities({ history, grammarRuns, fluencyRuns, readingRuns }),
    [history, grammarRuns, fluencyRuns, readingRuns],
  );
  const summary = useMemo(
    () => activitySummary([history, grammarRuns, fluencyRuns, readingRuns]),
    [history, grammarRuns, fluencyRuns, readingRuns],
  );

  // Grammar skill error rates over the last 30 days (an all-time
  // denominator only grows, so recent practice would barely move it).
  const grammarLang = isTamil ? 'ta' : 'si';
  const GT = UI_TEXT[grammarLang] || UI_TEXT.si;
  const LABELS = isTamil ? ERROR_PROFILE_LABELS_TA : ERROR_PROFILE_LABELS;
  const sessionHistory = useMemo(() => {
    const cutoff = Date.now() - SKILL_WINDOW_DAYS * DAY_MS;
    const sh = createSessionHistory();
    sh.runs = grammarRuns.filter((run) => run.createdAt && new Date(run.createdAt).getTime() >= cutoff);
    return sh;
  }, [grammarRuns]);
  const cumulative = sessionHistory.getCumulativeSkills(grammarLang);
  const skills = sessionHistory.runs.length
    ? Object.values(LABELS).filter((label) => label in cumulative).map((label) => [label, cumulative[label]])
    : [];

  if (!activities.length) {
    return (
      <EmptyState
        title={t('progress.emptyTitle')}
        text={t('progress.emptyText')}
        action={<button className="primary-action" onClick={() => navigate('/analyze')}>{t('progress.check')}</button>}
      />
    );
  }

  const lastSevenDays = Array.from({ length: 7 }, (_, i) => {
    const day = startOfDay(new Date()); day.setDate(day.getDate() - (6 - i));
    return activities.filter((a) => dayKey(a.at) === day.getTime()).length;
  });
  const byDate = (runs) => [...runs].filter((r) => r.createdAt).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const grammarSorted = byDate(grammarRuns);
  const readingSorted = byDate(readingRuns);
  const writingLatest = grammarAccuracy(grammarSorted[0]);
  const writingPrev = grammarAccuracy(grammarSorted[1]);
  const readingScore = (run) => (run ? Math.round(Number(run.result?.accuracy || 0)) : null);
  const readingLatest = readingScore(readingSorted[0]);
  const readingPrev = readingScore(readingSorted[1]);
  const fluencySorted = byDate(fluencyRuns);
  const fluencyScore = (run) => (run ? Math.round(Math.max(0, 1 - Number(run.result?.wer ?? 1)) * 100) : null);
  const fluencyLatest = fluencyScore(fluencySorted[0]);
  const fluencyPrev = fluencyScore(fluencySorted[1]);
  const latestWriting = history.filter(isAcceptedQualityResult)[0] || null;

  const done = { writing: history.length, grammar: grammarRuns.length, fluency: fluencyRuns.length, reading: readingRuns.length };
  const badges = [
    { key: 'first', icon: Footprints, tone: 'orange', label: t('pv.badgeFirst'), tip: t('pv.badgeFirstTip'), unlocked: activities.length >= 1 },
    { key: 'streak', icon: Flame, tone: 'orange', label: t('pv.badgeStreak'), tip: t('pv.badgeStreakTip'), unlocked: summary.streak >= 3 },
    { key: 'ten', icon: Trophy, tone: 'saffron', label: t('pv.badgeTen'), tip: t('pv.badgeTenTip'), unlocked: activities.length >= 10 },
    { key: 'reader', icon: Star, tone: 'sky', label: t('pv.badgeReader'), tip: t('pv.badgeReaderTip'), unlocked: readingRuns.some((run) => readingScore(run) >= 100) },
    { key: 'writer', icon: PenLine, tone: 'green', label: t('pv.badgeWriter'), tip: t('pv.badgeWriterTip'), unlocked: grammarRuns.some((run) => run.total > 0 && run.correct === run.total) },
    { key: 'explorer', icon: Award, tone: 'green', label: t('pv.badgeExplorer'), tip: t('pv.badgeExplorerTip'), unlocked: Object.values(done).every(Boolean) },
  ];
  const weakest = [...skills].sort((a, b) => b[1] - a[1]).find(([, score]) => score > 0);
  const leastType = Object.entries(done).sort((a, b) => a[1] - b[1])[0][0];
  const leastPath = { writing: '/analyze', grammar: '/grammar-check', fluency: '/fluency', reading: '/reading-error' }[leastType];
  const recommendation = weakest
    ? { text: t('pv.recommendSkill', { skill: weakest[0].split(/\s+-\s+/)[0] }), onClick: () => navigate('/practice') }
    : { text: t('pv.recommendModule', { module: t(TYPE_META[leastType].nav) }), onClick: () => navigate(leastPath) };

  return (
    <div className="pv">
      <header className="pv-head">
        <div>
          <span className="eyebrow">{t('progress.eyebrow')}</span>
          <h2>{t('progress.title')}</h2>
        </div>
      </header>

      <div className="pv-metrics">
        <Metric icon={BookOpen} tone="orange" label={t('pv.activities')} value={activities.length}
          sub={t('pv.monthCount', { count: summary.month })} tip={t('pv.activitiesTip')} onClick={() => navigate('/history')}
          visual={<MiniBars values={lastSevenDays} />} />
        <Metric icon={PenLine} tone="green" label={t('pv.writing')} value={pct(writingLatest)}
          sub={writingPrev !== null ? t('pv.prev', { value: `${writingPrev}%` }) : null} tip={t('pv.writingTip')} visual={<MiniRing value={writingLatest} />}
          onClick={() => navigate(grammarSorted[0] ? `/grammar-results/${grammarSorted[0].id}` : '/grammar-check')} />
        <Metric icon={AudioLines} tone="sky" label={t('pv.reading')} value={pct(readingLatest)}
          sub={readingPrev !== null ? t('pv.prev', { value: `${readingPrev}%` }) : null} tip={t('pv.readingTip')} visual={<MiniRing value={readingLatest} />}
          onClick={() => navigate(readingSorted[0] ? `/reading-results/${readingSorted[0].id}` : '/reading-error')} />
        <Metric icon={Flame} tone="flame" label={t('progress.dayStreak')} value={summary.streak}
          sub={`${t('home.thisWeek')}: ${summary.week.filter((d) => d.done).length}`} tip={t('pv.streakTip')} onClick={() => navigate('/history')}
          visual={<WeekDots week={summary.week} />} />
      </div>

      <div className="pv-row pv-row-60">
        <QualityChart history={history} language={language} t={t} onOpen={(item) => navigate(`/results/${item.id}`)} />
        {skills.length
          ? <SkillBreakdown skills={skills} GT={GT} />
          : <section className="pv-card pv-skills"><header className="pv-card-head"><h3>{GT.skillSectionTitle}</h3></header><p className="pv-muted">{t('progress.notYet')}</p></section>}
      </div>

      <div className="pv-row pv-row-50">
        <Performance tone="saffron" icon={Mic} title={t('nav.fluency')} latest={fluencyLatest} previous={fluencyPrev}
          tests={fluencyRuns.length} t={t}
          extra={fluencySorted[0] ? `${t('progress.wordAccuracy')} · ${fluencyText(fluencySorted[0].result?.fluency_label, isTamil)}` : null}
          onClick={() => navigate(fluencySorted[0] ? `/fluency-results/${fluencySorted[0].id}` : '/fluency')} />
        <Performance tone="sky" icon={Volume2} title={t('nav.readingError')} latest={readingLatest} previous={readingPrev}
          tests={readingRuns.length} t={t} extra={t('progress.readingAccuracy')}
          onClick={() => navigate(readingSorted[0] ? `/reading-results/${readingSorted[0].id}` : '/reading-error')} />
      </div>

      <div className="pv-row pv-row-50">
        <ActivityCalendar activities={activities} language={language} t={t} />
        <Achievements badges={badges} recommendation={recommendation} t={t} />
      </div>
    </div>
  );
}
