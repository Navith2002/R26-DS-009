import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Camera, Check, Flame, Leaf, Mic, Play, Sparkles, SpellCheck2, Star, Volume2 } from 'lucide-react';
import { useApp } from '../context/useApp';
import {
  analysisStatus,
  formatDate,
  isAcceptedQualityResult,
  qualityLabel,
  qualityTone,
} from '../utils/format';
import { qualityLabelText } from '../i18n/translations';
import EmptyState from '../components/EmptyState';
import bhashaLogo from '../assets/bhasha-logo.webp';
import { activitySummary, latestByDate } from '../utils/activity';
import { burstConfetti } from '../utils/confetti';
import { createSessionHistory } from '../components/grammarCheck/sessionHistory';
import { ERROR_META, ERROR_META_TA, UI_TEXT as GRAMMAR_UI_TEXT } from '../components/grammarCheck/i18n';
import '../components/grammarCheck/grammarCheck.css';

// Same 30-day window ProgressPage's skill panel uses, and for the same
// reason: an all-time error tally only ever grows, so recent practice
// stops moving it much the longer the app has been used.
const GRAMMAR_WINDOW_DAYS = 30;

// Writing-quality tone -> how full the module's progress bar is.
const TONE_FILL = { good: 85, average: 60, 'below-average': 40, poor: 20 };
const FLUENCY_FILL = { Fluent: 90, Struggling: 30 };
const RING_CIRCUMFERENCE = 2 * Math.PI * 62;
const SINHALA_LETTERS = ['අ', 'ක', 'ම', 'ස', 'ළ', 'ග', 'ප', 'ත', 'ර', 'ල'];
const TAMIL_LETTERS = ['அ', 'க', 'ம', 'ச', 'ழ', 'த', 'ப', 'ர', 'ல', 'ந'];
const LETTER_TONES = ['orange', 'green', 'saffron', 'sky', 'leaf'];

export default function HomePage() {
  const navigate = useNavigate();
  const { history, grammarRuns, fluencyRuns, readingRuns, language, setLanguage, t } = useApp();
  const isTamil = language === 'tamil';

  // Bars and the ring start empty and fill once the page has painted.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFilled(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const completed = useMemo(() => history.filter(isAcceptedQualityResult), [history]);
  const latestCompleted = completed[0] || null;
  const latest = history.slice(0, 3);
  const latestFluency = latestByDate(fluencyRuns);
  const latestGrammarRun = latestByDate(grammarRuns);
  const latestReading = latestByDate(readingRuns);

  const latestGrammarAccuracy = latestGrammarRun && latestGrammarRun.total > 0
    ? Math.round((latestGrammarRun.correct / latestGrammarRun.total) * 100)
    : null;
  const fluencyLabel = latestFluency?.result?.fluency_label;
  const fluencyStatusText = latestFluency
    ? fluencyLabel === 'Fluent'
      ? (isTamil ? 'சரளம்' : 'ප්‍රවීණයි')
      : fluencyLabel === 'Struggling'
        ? (isTamil ? 'பயிற்சி தேவை' : 'අභ්‍යාස අවශ්‍යයි')
        : (isTamil ? 'மிதமானது' : 'මධ්‍යස්ථයි')
    : '';
  const readingAccuracy = latestReading ? Math.round(Number(latestReading.result?.accuracy || 0)) : null;

  const activity = useMemo(
    () => activitySummary([history, grammarRuns, fluencyRuns, readingRuns]),
    [history, grammarRuns, fluencyRuns, readingRuns],
  );
  const goalDone = activity.today >= activity.goal;
  const weekDays = t('home.weekDays').split(',');

  const grammarLang = isTamil ? 'ta' : 'si';
  const GT = GRAMMAR_UI_TEXT[grammarLang] || GRAMMAR_UI_TEXT.si;
  const GEM = grammarLang === 'ta' ? ERROR_META_TA : ERROR_META;
  const grammarErrorEntries = useMemo(() => {
    const cutoff = Date.now() - GRAMMAR_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recentRuns = grammarRuns.filter((run) => run.createdAt && new Date(run.createdAt).getTime() >= cutoff);
    const sh = createSessionHistory();
    sh.runs = recentRuns;
    return Object.entries(sh.getCumulativeErrors()).sort((a, b) => b[1] - a[1]);
  }, [grammarRuns]);

  const writingLabel = latestCompleted ? qualityLabel(latestCompleted) : null;
  const modules = [
    {
      to: '/analyze', tone: 'orange', icon: Camera, title: t('nav.check'), text: t('home.descCheck'),
      fill: writingLabel ? TONE_FILL[qualityTone(writingLabel)] || 50 : 0,
      level: writingLabel ? qualityLabelText(writingLabel, language) : t('home.new'),
    },
    {
      to: '/grammar-check', tone: 'green', icon: SpellCheck2, title: t('nav.grammarCheck'), text: t('home.descGrammar'),
      fill: latestGrammarAccuracy ?? 0,
      level: latestGrammarAccuracy !== null ? `${latestGrammarAccuracy}%` : t('home.new'),
    },
    {
      to: '/fluency', tone: 'saffron', icon: Mic, title: t('nav.fluency'), text: t('home.descFluency'),
      fill: latestFluency ? FLUENCY_FILL[fluencyLabel] || 60 : 0,
      level: latestFluency ? fluencyStatusText : t('home.new'),
    },
    {
      to: '/reading-error', tone: 'sky', icon: Volume2, title: t('nav.readingError'), text: t('home.descReading'),
      fill: readingAccuracy ?? 0,
      level: readingAccuracy !== null ? `${readingAccuracy}%` : t('home.new'),
    },
  ];

  function begin(event) {
    burstConfetti(event);
    setLanguage(language);
    navigate('/analyze');
  }

  // Letter bubbles around the logo: click to pop, a new letter floats back.
  const letters = isTamil ? TAMIL_LETTERS : SINHALA_LETTERS;
  const [bubbles, setBubbles] = useState(() => LETTER_TONES.map((_, index) => ({ letter: letters[index], popped: false })));
  useEffect(() => {
    setBubbles(LETTER_TONES.map((_, index) => ({ letter: letters[index], popped: false })));
  }, [letters]);
  function popLetter(event, index) {
    if (bubbles[index].popped) return;
    burstConfetti(event, 14);
    setBubbles((current) => current.map((bubble, i) => (i === index ? { ...bubble, popped: true } : bubble)));
    setTimeout(() => {
      setBubbles((current) => current.map((bubble, i) => (
        i === index ? { letter: letters[Math.floor(Math.random() * letters.length)], popped: false } : bubble
      )));
    }, 700);
  }

  function openModule(event, to) {
    burstConfetti(event);
    navigate(to);
  }

  return (
    <div className="kid-home">
      <section className="kid-hero">
        <div className="kid-hero-copy">
          <span className="kid-hero-tag"><Sparkles size={16} />{t('home.badge')}</span>
          <h1>{t('home.title')}</h1>
          <p>{t('home.heroText')}</p>
          <div className="kid-goal">
            <span className="kid-goal-label">{goalDone ? t('home.goalDone') : t('home.goalToday')}</span>
            <span className="kid-goal-stars">
              {Array.from({ length: activity.goal }, (_, index) => (
                <span key={index} className={`kid-goal-star ${index < activity.today ? 'earned' : ''}`} style={{ animationDelay: `${0.3 + index * 0.15}s` }}>
                  <Star size={22} fill={index < activity.today ? 'currentColor' : 'none'} />
                </span>
              ))}
            </span>
          </div>
          <div className="kid-hero-actions">
            <button className="chunky-btn orange" onClick={begin}><Play size={18} />{t('home.start')}</button>
            <button className="chunky-btn white" onClick={() => navigate('/practice')}><BookOpen size={18} />{t('home.practice')}</button>
          </div>
        </div>
        <div className="kid-hero-play">
          <div className="kid-hero-bubble" aria-hidden="true">
            <Leaf className="kid-leaf one" size={22} />
            <Leaf className="kid-leaf two" size={22} />
            <img src={bhashaLogo} alt="" />
          </div>
          {bubbles.map((bubble, index) => (
            <button
              key={index}
              type="button"
              className={`kid-letter tone-${LETTER_TONES[index]} spot-${index} ${bubble.popped ? 'popped' : ''}`}
              aria-label={bubble.letter}
              onClick={(event) => popLetter(event, index)}
            >
              {bubble.letter}
            </button>
          ))}
        </div>
      </section>

      <div className="kid-home-grid">
        <div>
          <div className="kid-section-head"><h2>{t('home.learn')}</h2></div>
          <div className="kid-modules">
            {modules.map(({ to, tone, icon: Icon, title, text, fill, level }) => (
              <button key={to} className={`kid-module tone-${tone}`} onClick={(event) => openModule(event, to)}>
                <span className="kid-module-head">
                  <span className="kid-module-icon"><Icon size={28} /></span>
                  <span className="kid-module-title">{title}</span>
                </span>
                <p>{text}</p>
                <span className="kid-module-foot">
                  <span className="kid-module-bar"><i style={{ width: filled ? `${fill}%` : 0 }} /></span>
                  <span className="kid-module-level">{level}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="kid-section-head">
            <h2>{t('home.recentWriting')}</h2>
            <button className="kid-link" onClick={() => navigate('/history')}>{t('home.seeAll')}<ArrowRight size={16} /></button>
          </div>
          <div className="kid-panel">
            {latest.length ? (
              <div className="kid-recent">
                {latest.map((item) => {
                  const label = qualityLabel(item);
                  const status = analysisStatus(item);
                  const display = label
                    ? qualityLabelText(label, language)
                    : status === 'NEEDS_TEACHER_REVIEW'
                      ? t('home.teacherReview')
                      : status === 'COMPLETED'
                        ? t('home.completed')
                        : t('home.tryAgainShort');
                  const tone = label ? qualityTone(label) : status === 'NEEDS_TEACHER_REVIEW' ? 'review' : 'retake';
                  return (
                    <button key={item.id} className="kid-recent-row" onClick={() => navigate(`/results/${item.id}`)}>
                      <span className="kid-chip tone-orange"><Camera size={18} /></span>
                      <span className="kid-recent-copy">
                        <span className="kid-recent-title">{t('nav.check')}</span>
                        <small>{formatDate(item.createdAt, language)}</small>
                      </span>
                      <span className={`quality-pill tone-${tone}`}>{display}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState title={t('home.noChecks')} text={t('home.noChecksText')} />
            )}
          </div>
        </div>

        <aside>
          <div className="kid-panel">
            <h2>{t('home.accuracyTitle')}</h2>
            <div className="kid-ring">
              <svg width="150" height="150" aria-hidden="true">
                <circle cx="75" cy="75" r="62" className="kid-ring-track" />
                <circle
                  cx="75" cy="75" r="62" className="kid-ring-value"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={RING_CIRCUMFERENCE * (1 - (filled ? (latestGrammarAccuracy ?? 0) / 100 : 0))}
                />
              </svg>
              <div className="kid-ring-label">
                <strong>{latestGrammarAccuracy !== null ? `${latestGrammarAccuracy}%` : '—'}</strong>
                <span>{t('home.accuracyCorrect')}</span>
              </div>
            </div>
          </div>

          <div className="kid-panel">
            <div className="kid-panel-head">
              <h2>{t('home.thisWeek')}</h2>
              <span className="kid-streak"><Flame size={18} />{t('home.streak', { count: activity.streak })}</span>
            </div>
            <div className="kid-week">
              {activity.week.map((day, index) => (
                <span key={weekDays[index]} className={`kid-day ${day.done ? 'done' : ''} ${day.isToday ? 'today' : ''}`}>
                  <span className="kid-day-dot" style={{ animationDelay: `${index * 0.07}s` }}>
                    {day.done ? <Check size={18} /> : day.isToday ? <Flame size={16} /> : null}
                  </span>
                  {weekDays[index]}
                </span>
              ))}
            </div>
          </div>

          {!!grammarErrorEntries.length && (
            <div className="kid-panel">
              <h2>{GT.errorSectionTitle}</h2>
              <div className="error-legend kid-legend">
                {grammarErrorEntries.map(([type, count]) => (
                  <div className="legend-row" key={type}>
                    <span className="legend-dot" style={{ background: (GEM[type] || {}).color || '#888' }} />
                    <span>{(GEM[type] || {}).label || type}</span>
                    <span className="legend-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
