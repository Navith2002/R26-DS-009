import { useEffect, useState } from 'react';
import {
  ERROR_META, ERROR_META_TA, ERROR_PROFILE_LABELS, ERROR_PROFILE_LABELS_TA,
  SKILL_COLORS, SKILL_COLORS_TA, UI_TEXT,
} from './i18n';

const FB_COLORS = {
  correct:     { bg: '#edfaf3', border: '#86efac' },
  retroflex:   { bg: '#fffbeb', border: '#fcd34d' },
  vowel:       { bg: '#f5f3ff', border: '#c4b5fd' },
  zwj:         { bg: '#eff6ff', border: '#93c5fd' },
  boundary:    { bg: '#ecfeff', border: '#67e8f9' },
  punctuation: { bg: '#fff7ed', border: '#fdba74' },
  missing:     { bg: '#fffbeb', border: '#fcd34d' },
  other:       { bg: '#fef2f2', border: '#fca5a5' },
};
const FB_ICONS = { correct: '🌟', retroflex: '🔤', vowel: '🔡', zwj: '🔗', boundary: '↔️', punctuation: '📝', missing: '➕', other: '✏️' };

// Metric-card theme (icon + color) for the 4 score cards, in the same
// order T.scoreCards() returns them: [accuracy, total, correct, errors].
const METRIC_THEME = [
  { cls: 'kid-green',  icon: '📖' },
  { cls: 'kid-orange', icon: '🚀' },
  { cls: 'kid-teal',   icon: '⭐' },
  { cls: 'kid-coral',  icon: '🌈' },
];

// Number badge color, cycled per line so the row list reads as playful
// rather than repeating a single color down the page.
const NUM_BADGE_CYCLE = ['kid-green', 'kid-orange', 'kid-teal', 'kid-coral'];

// Animates a skill bar from 0 to its target width on mount/update, the
// same way the original dashboard.html reset .skill-bar-fill's width to 0
// then back to its real value inside a setTimeout.
export function SkillBar({ score, color }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    setWidth(0);
    const timer = setTimeout(() => setWidth(score), 50);
    return () => clearTimeout(timer);
  }, [score]);
  return (
    <div className="skill-bar-bg">
      <div className="skill-bar-fill" style={{ width: `${width}%`, background: color }} />
    </div>
  );
}

// Small decorative header illustration (trees + a pencil) -- purely
// ornamental, sized to sit inline in the header without pushing it taller.
function KidHeaderIllus() {
  return (
    <svg width="110" height="56" viewBox="0 0 110 56" aria-hidden="true" className="kid-header-illus">
      <circle cx="20" cy="34" r="16" fill="#E9F7EA" />
      <circle cx="14" cy="26" r="12" fill="#4CAF50" />
      <circle cx="30" cy="30" r="10" fill="#8BCB8E" />
      <rect x="16" y="34" width="4" height="14" rx="2" fill="#8a5a34" />
      <g transform="translate(64,6) rotate(28)">
        <rect x="0" y="0" width="10" height="34" rx="3" fill="#F2854C" />
        <polygon points="0,34 10,34 5,44" fill="#f4c9a3" />
        <rect x="0" y="0" width="10" height="7" rx="3" fill="#3FD9C7" />
      </g>
    </svg>
  );
}

export default function Dashboard({ data, language, onNewPage, onNewSession, grammarRuns = [] }) {
  const lang = language || 'si';
  const T = UI_TEXT[lang] || UI_TEXT.si;
  const EM = lang === 'ta' ? ERROR_META_TA : ERROR_META;

  // "Latest accepted language level" -- the most recent grammar-check
  // run's accuracy, independent of which run `data` above is showing.
  // grammarRuns entries already carry `correct`/`total` flattened at the
  // top level (sessionHistory.js's summarizeRun), so no need to re-derive
  // from each run's own raw `result`. registerGrammarRun (AppContext.jsx)
  // appends, so the newest run is last.
  const latestRun = grammarRuns.length ? grammarRuns[grammarRuns.length - 1] : null;
  const latestAccuracy = latestRun && latestRun.total > 0
    ? Math.round((latestRun.correct / latestRun.total) * 100)
    : null;

  useEffect(() => {
    document.documentElement.style.setProperty('--script', lang === 'ta' ? 'var(--tam)' : 'var(--sinh)');
  }, [lang]);

  const lines = data.lines || [];
  const total = data.total_lines || lines.length;
  const correct = data.correct_lines || lines.filter((l) => l.error_type === 'correct').length;
  const accuracy = data.accuracy_score || Math.round((correct / Math.max(total, 1)) * 100);
  const dominant = data.dominant_error || 'other';
  const feedback = data.primary_feedback || { si: '', en: '' };

  const metricGood = [
    accuracy >= 80,
    true,
    true,
    (total - correct) === 0,
  ];
  const scoreCards = T.scoreCards(accuracy, total, correct);
  const fbColor = FB_COLORS[dominant] || FB_COLORS.other;

  const sentences = data.sentences || [];

  return (
    <div id="dashboard">
      <header className="dash-header">
        <div>
          <div className="dash-title" style={{ marginLeft: '70px', display: 'flex', gap: 10, alignItems: 'center' }}>{T.dashTitle}</div>
          <div className="dash-sub" style={{ marginLeft: '70px',marginTop: '8px', display: 'flex', gap: 10, alignItems: 'center' }}>{T.dashSub}</div>
        </div>
        <KidHeaderIllus />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="kid-btn-outline" onClick={onNewPage} title={T.btnNewPageTitle}>{T.btnNewPage}</button>
          <button className="kid-btn-solid" onClick={onNewSession} title={T.btnNewSessionTitle}>{T.btnNewSession}</button>
        </div>
      </header>

      <div className="dash-body">
        <div className="kid-metric-grid fade-in">
          {scoreCards.map((s, i) => (
            <div className={`kid-metric-card ${METRIC_THEME[i].cls}`} key={s.label}>
              {metricGood[i] && <div className="kid-metric-check">✓</div>}
              <div className="kid-metric-icon">{METRIC_THEME[i].icon}</div>
              <div className="kid-metric-value">{s.value}</div>
              <div className="kid-metric-label">{s.label}</div>
              <div className="sc-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="fade-in">
          <div className="feedback-banner" style={{ background: fbColor.bg, borderColor: fbColor.border }}>
            <div className="fb-icon">{FB_ICONS[dominant] || '✏️'}</div>
            <div>
              <div className="fb-title">{(EM[dominant] || {}).label || T.noAnalysisFallback}</div>
              <div className="fb-si">{feedback.si || ''}</div>
            </div>
          </div>
        </div>

        {/* Skill profile + error-type breakdown moved to the Progress page
            (see ProgressPage.jsx's grammar-skill-panel) -- it now reflects
            every check ever done, not just runs from this page visit. */}

        <div className="section-title fade-in">{T.linesSectionTitle}</div>
        <div className="fade-in">
          {lines.map((line, i) => {
            const em = EM[line.error_type] || EM.other;
            const hasDiff = (line.raw_text || '').trim() !== (line.corrected_text || '').trim();
            const numCls = NUM_BADGE_CYCLE[i % NUM_BADGE_CYCLE.length];
            return (
              <div className="kid-line-row" key={i}>
                <div>
                  <div className="kid-line-thumb-wrap">
                    <div className={`kid-num-badge ${numCls}`}>{i + 1}</div>
                    {line.line_img
                      ? <img className="kid-line-thumb" src={`data:image/png;base64,${line.line_img}`} alt={`line ${i + 1}`} />
                      : <div className="kid-line-thumb" style={{ width: 140, height: 40 }} />}
                  </div>
                  <div className="line-text">{line.corrected_text || line.raw_text || '—'}</div>
                  {hasDiff && (
                    <div className="line-raw">{T.machineRead} <span>{line.raw_text || ''}</span></div>
                  )}
                </div>
                <div>
                  <span className={`err-badge ${em.cls}`}>{em.icon} {em.label}</span>
                  {line.feedback_si && (
                    <div className="line-feedback" style={{ fontFamily: 'var(--script)', marginTop: 4 }}>{line.feedback_si}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {sentences.length > 0 && (
          <>
            <div className="section-title fade-in" style={{ marginTop: 24 }}>
              {T.sentencesTitle}
              <span className="section-sub">{T.sentencesSub}</span>
            </div>
            <div className="lines-card fade-in" style={{ marginBottom: 24 }}>
              {sentences.map((s, i) => (
                <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{i + 1}</span>
                    {s.is_combined && (
                      <span style={{ fontSize: 10, background: '#eff6ff', color: '#2563eb', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>
                        {T.linesMerged}
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--script)', fontSize: 16, lineHeight: 1.7, color: 'var(--text)' }}>{s.text}</div>
                  {s.grammar_note && <div className="grammar-note">⚠ {s.grammar_note}</div>}
                  {s.word_count <= 1 && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{T.singleWordNote}</div>}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="kid-encourage fade-in">
          <div className="kid-encourage-title">{T.encourageTitle}</div>
          <div className="kid-encourage-sub">{T.encourageSub}</div>
        </div>
      </div>
    </div>
  );
}
