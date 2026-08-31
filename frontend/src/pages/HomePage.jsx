import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Mic, Sparkles, SpellCheck2, Star, Volume2 } from 'lucide-react';
import { useApp } from '../context/useApp';
import {
  analysisStatus,
  formatDate,
  isAcceptedQualityResult,
  qualityLabel,
  qualityTone,
} from '../utils/format';
import { languageName, qualityLabelText } from '../i18n/translations';
import EmptyState from '../components/EmptyState';
import writingFriends from '../assets/home-writing-friends.svg';
import { createSessionHistory } from '../components/grammarCheck/sessionHistory';
import { ERROR_META, ERROR_META_TA, UI_TEXT as GRAMMAR_UI_TEXT } from '../components/grammarCheck/i18n';
import '../components/grammarCheck/grammarCheck.css';

// Same 30-day window ProgressPage's skill panel uses, and for the same
// reason: an all-time error tally only ever grows, so recent practice
// stops moving it much the longer the app has been used.
const GRAMMAR_WINDOW_DAYS = 30;

export default function HomePage() {
  const navigate = useNavigate();
  const { history, grammarRuns, fluencyRuns, language, setLanguage, t } = useApp();

  const completed = useMemo(
    () => history.filter(isAcceptedQualityResult),
    [history]
  );

  const latestCompleted = completed[0] || null;
  const latest = history.slice(0, 3);

  // registerFluencyRun (AppContext.jsx) appends, so the newest run is
  // last -- same convention as grammarRuns elsewhere in this file/
  // HistoryPage.jsx.
  const latestFluency = fluencyRuns[fluencyRuns.length - 1] || null;
  const isTamil = language === 'tamil';
  const fluencyStatusText = latestFluency
    ? latestFluency.result?.fluency_label === 'Fluent'
      ? (isTamil ? 'சரளம்' : 'ප්‍රවීණයි')
      : latestFluency.result?.fluency_label === 'Struggling'
        ? (isTamil ? 'பயிற்சி தேவை' : 'අභ්‍යාස අවශ්‍යයි')
        : (isTamil ? 'மிதமானது' : 'මධ්‍යස්ථයි')
    : '';

  // "Latest accepted language level" -- same value/definition as the
  // grammar-check Dashboard's own 5th metric card (Dashboard.jsx):
  // most-recent grammarRuns entry's accuracy, using the correct/total
  // registerGrammarRun already flattens onto each entry (sessionHistory.js's
  // summarizeRun) rather than re-deriving from the raw result.
  const latestGrammarRun = grammarRuns.length ? grammarRuns[grammarRuns.length - 1] : null;
  const latestGrammarAccuracy = latestGrammarRun && latestGrammarRun.total > 0
    ? Math.round((latestGrammarRun.correct / latestGrammarRun.total) * 100)
    : null;

  // Grammar-check (spelling/grammar) error-type count -- same underlying
  // data/computation as the Progress page's skill panel, just the "error
  // legend" half of it, styled to match this page's own right-column
  // cards.
  const grammarLang = language === 'tamil' ? 'ta' : 'si';
  const GT = GRAMMAR_UI_TEXT[grammarLang] || GRAMMAR_UI_TEXT.si;
  const GEM = grammarLang === 'ta' ? ERROR_META_TA : ERROR_META;
  const grammarErrorEntries = useMemo(() => {
    const cutoff = Date.now() - GRAMMAR_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recentRuns = grammarRuns.filter((run) => run.createdAt && new Date(run.createdAt).getTime() >= cutoff);
    const sh = createSessionHistory();
    sh.runs = recentRuns;
    return Object.entries(sh.getCumulativeErrors()).sort((a, b) => b[1] - a[1]);
  }, [grammarRuns]);

  function begin(selectedLanguage = language) {
    setLanguage(selectedLanguage);
    navigate('/analyze');
  }

  return (
    <div className="dashboard-grid">
      <div className="dashboard-main">
        <section className="hero-card kid-hero-card">
          <div className="hero-content">
            <div className="hero-badge"><Sparkles size={14} /> {t('home.badge')}</div>
            <h2>{t('home.title')}</h2>
            <div className="hero-actions">
              <button className="primary-btn" onClick={() => begin()}>{t('home.check')}</button>
              <button className="secondary-btn" onClick={() => navigate('/practice')}>{t('home.practice')}</button>
            </div>
          </div>
          <div className="hero-cartoon" aria-hidden="true">
            <img src={writingFriends} alt="" />
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <h3>{t('home.whatDo')}</h3>
          </div>
          {/* One card per component, same nav destinations/labels as the
              sidebar (AppShell.jsx) -- alternating orange/green via the
              new .card-orange/.card-green modifiers (styles.css), same
              color-chip pattern as the old camera-card/upload-card. */}
          <div className="activity-grid">
            {/* Small bouncing-animal mascots (styles.css: .card-mascot) --
                purely decorative (aria-hidden), one per card, each on its
                own animation-delay so they don't all bob in lockstep. */}
            <button className="feature-card card-orange" onClick={() => navigate('/analyze')}>
              <span className="card-mascot mascot-1" aria-hidden="true">🐰</span>
              <div className="card-icon"><Camera size={25} /></div>
              <div><h4>{t('nav.check')}</h4></div>
            </button>
            <button className="feature-card card-green" onClick={() => navigate('/grammar-check')}>
              <span className="card-mascot mascot-2" aria-hidden="true">🦉</span>
              <div className="card-icon"><SpellCheck2 size={25} /></div>
              <div><h4>{t('nav.grammarCheck')}</h4></div>
            </button>
            <button className="feature-card card-orange" onClick={() => navigate('/fluency')}>
              <span className="card-mascot mascot-3" aria-hidden="true">🐥</span>
              <div className="card-icon"><Mic size={25} /></div>
              <div><h4>{t('nav.fluency')}</h4></div>
            </button>
            <button className="feature-card card-green" onClick={() => navigate('/reading-error')}>
              <span className="card-mascot mascot-4" aria-hidden="true">🐷</span>
              <div className="card-icon"><Volume2 size={25} /></div>
              <div><h4>{t('nav.readingError')}</h4></div>
            </button>
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <h3>{t('home.journey')}</h3>
            <button onClick={() => navigate('/progress')}>{t('home.viewProgress')}</button>
          </div>
          <div className="performance-panel">
            <div className="performance-grid kid-progress-grid">
              <button
                type="button"
                className="feature-card card-green"
                onClick={() => latestCompleted && navigate(`/results/${latestCompleted.id}`)}
              >
                <span className="card-mascot mascot-2" aria-hidden="true">🐹</span>
                <div className="card-icon"><Star size={20} fill="currentColor" /></div>
                <div>
                  <small style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', display: 'block' }}>{t('home.latestLevel')}</small>
                  {latestCompleted ? (
                    <>
                      <h4 style={{ fontSize: 25 }}>{qualityLabelText(qualityLabel(latestCompleted), language)}</h4>
                      <p style={{ fontSize: 10 }}>{languageName(latestCompleted.language, language)} · {formatDate(latestCompleted.createdAt, language)}</p>
                    </>
                  ) : (
                    <>
                      <h4 style={{ fontSize: 25 }}>{t('home.readyBegin')}</h4>
                      <p style={{ fontSize: 10 }}>{t('home.firstResult')}</p>
                    </>
                  )}
                </div>
              </button>
              {/* Latest reading-fluency check, replacing the old
                  completed-checks/good-results count pair -- same card
                  system as the handwriting-level card above (label/
                  title/subtext sizes matched via inline style so both
                  read as one pair). */}
              <button
                type="button"
                className={`feature-card ${latestFluency?.result?.fluency_label === 'Fluent' ? 'card-green' : 'card-orange'}`}
                onClick={() => navigate(latestFluency ? `/fluency-results/${latestFluency.id}` : '/fluency')}
              >
                <span className="card-mascot mascot-3" aria-hidden="true">🐳</span>
                <div className="card-icon"><Mic size={22} /></div>
                <div>
                  <small style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', display: 'block' }}>
                    {isTamil ? 'சமீபத்திய வாசிப்பு நிலை' : 'අවසන් පිළිගත් කියවුම් මට්ටම'}
                  </small>
                  <h4 style={{ fontSize: 25 }}>{latestFluency ? fluencyStatusText : t('nav.fluency')}</h4>
                  <p style={{ fontSize: 10 }}>
                    {latestFluency
                      ? formatDate(latestFluency.createdAt, language)
                      : (isTamil ? 'இன்னும் வாசிப்புத் திறன் பரிசோதனை இல்லை' : 'තවම කියවුම් හැකියා පරීක්ෂණයක් නැත')}
                  </p>
                </div>
              </button>

              {/* Latest grammar/spelling check -- same "latest accepted
                  level" idea as the two cards above and as the grammar
                  Dashboard's own 5th metric card (Dashboard.jsx), just
                  surfaced here too since it wasn't showing anywhere on
                  this page yet. Teal so all three read as a distinct
                  trio rather than repeating orange/green. */}
              <button
                type="button"
                className="feature-card card-teal"
                onClick={() => navigate(latestGrammarRun ? `/grammar-results/${latestGrammarRun.id}` : '/grammar-check')}
              >
                <span className="card-mascot mascot-4" aria-hidden="true">🦭</span>
                <div className="card-icon"><SpellCheck2 size={22} /></div>
                <div>
                  <small style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', display: 'block' }}>
                    {isTamil ? 'சமீபத்திய மொழி நிலை' : 'අවසන් ලිවීම් නිවැරදි මට්ටම'}
                  </small>
                  <h4 style={{ fontSize: 25 }}>
                    {latestGrammarAccuracy !== null ? `${latestGrammarAccuracy}%` : t('nav.grammarCheck')}
                  </h4>
                  <p style={{ fontSize: 10 }}>
                    {latestGrammarRun
                      ? formatDate(latestGrammarRun.createdAt, language)
                      : (isTamil ? 'இன்னும் சரிபார்ப்பு இல்லை' : 'තවම පරීක්ෂණයක් නැත')}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </section>
      </div>

      <aside className="dashboard-right">
        <div className="right-card recent-writing-card">
          <div className="right-card-title"><h3>{t('home.recentWriting')}</h3><button onClick={() => navigate('/history')}>{t('home.seeAll')}</button></div>
          {latest.length ? (
            <div className="recent-list">
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
                  <button key={item.id} className="recent-item" onClick={() => navigate(`/results/${item.id}`)}>
                    <div className={`recent-icon ${item.language}`}><span>{item.language === 'tamil' ? 'அ' : 'අ'}</span></div>
                    <div className="recent-info"><h4>{languageName(item.language, language)} {t('history.writingCheck')}</h4><p>{formatDate(item.createdAt, language)}</p></div>
                    <span className={`quality-pill tone-${tone}`}>{display}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState title={t('home.noChecks')} text={t('home.noChecksText')} />
          )}
        </div>

        {!!grammarErrorEntries.length && (
          <div className="right-card grammar-skill-panel">
            <div className="right-card-title"><h3>{GT.errorSectionTitle}</h3></div>
            <div className="error-card home-error-card">
              <div className="error-legend">
                {grammarErrorEntries.map(([type, count]) => (
                  <div className="legend-row" key={type}>
                    <span className="legend-dot" style={{ background: (GEM[type] || {}).color || '#888' }} />
                    <span>{(GEM[type] || {}).label || type}</span>
                    <span className="legend-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
