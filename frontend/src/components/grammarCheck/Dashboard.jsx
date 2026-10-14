import { TryAgainCat } from '../Lottie';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarDays, CheckCircle2, Eye, FilePlus2, Lightbulb, Printer, RotateCcw, UserRound,
  Sparkles, Star,
} from 'lucide-react';
import { translate } from '../../i18n/translations';
import { useApp } from '../../context/useApp';
import { formatDate } from '../../utils/format';
import { burstConfetti } from '../../utils/confetti';
import { ERROR_META, ERROR_META_TA, UI_TEXT } from './i18n';

const RING = 2 * Math.PI * 52;

// Word-by-word comparison (exact: a ල/ළ swap IS a spelling mistake here).
// Returns the `words` of `text` marked changed where they differ from `other`.
function markChanges(text, other) {
  const a = (text || '').trim().split(/\s+/).filter(Boolean);
  const b = (other || '').trim().split(/\s+/).filter(Boolean);
  return a.map((word, i) => ({ word, changed: word !== b[i] }));
}

// Every error type a line carries (backend may list several).
const typesOf = (line) => (line.all_errors?.length ? line.all_errors : [line.error_type || 'other']);

function Words({ words, tone }) {
  return words.map(({ word, changed }, i) => (
    <span key={i} className={changed ? `gc-word ${tone}` : undefined}>{word}{i < words.length - 1 ? ' ' : ''}</span>
  ));
}

export default function Dashboard({ data, language, onNewPage, onNewSession, celebrate = false, when }) {
  const { profile } = useApp();
  const lang = language || 'si';
  const T = UI_TEXT[lang] || UI_TEXT.si;
  const EM = lang === 'ta' ? ERROR_META_TA : ERROR_META;
  const [filter, setFilter] = useState('all');
  const [showWritten, setShowWritten] = useState(false);

  const lines = useMemo(() => data.lines || [], [data]);
  const total = data.total_lines || lines.length;
  const correct = data.correct_lines || lines.filter((l) => l.error_type === 'correct').length;
  const accuracy = Math.round(data.accuracy_score || (correct / Math.max(total, 1)) * 100);
  const errors = Math.max(total - correct, 0);
  const dominant = data.dominant_error || 'other';
  const feedback = data.primary_feedback || { si: '' };
  const sentences = data.sentences || [];
  const stars = accuracy >= 80 ? 3 : accuracy >= 50 ? 2 : accuracy > 0 ? 1 : 0;
  const cheer = stars === 3 ? T.starsGreat : stars === 2 ? T.starsGood : T.starsTry;

  // A good fresh result gets a little celebration.
  useEffect(() => {
    if (celebrate && accuracy >= 80) {
      const timer = setTimeout(() => burstConfetti({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 3 }, 36), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [celebrate, accuracy]);

  const typeCounts = useMemo(() => {
    const counts = {};
    lines.forEach((line) => typesOf(line).filter((type) => type !== 'correct').forEach((type) => { counts[type] = (counts[type] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [lines]);
  const visible = lines.map((line, i) => ({ line, i })).filter(({ line }) => {
    if (filter === 'all') return true;
    if (filter === 'correct') return line.error_type === 'correct';
    if (filter === 'errors') return line.error_type !== 'correct';
    return typesOf(line).includes(filter.slice(5));
  });
  const dominantMeta = EM[dominant] || EM.other;

  return (
    <div className="page-stack gc gc-report">
      {/* Score hero, styled as an exercise-book report card */}
      <section className="gc-hero">
        <div className="gc-medal">
          <span className="gc-medal-rosette" aria-hidden="true" />
          <div className="gc-gauge">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="52" className="track" />
              <circle cx="60" cy="60" r="52" className="value" strokeDasharray={RING} strokeDashoffset={RING * (1 - accuracy / 100)} />
            </svg>
            <span className="gc-gauge-value"><strong>{accuracy}%</strong></span>
          </div>
          <span className="gc-medal-ribbon left" aria-hidden="true" />
          <span className="gc-medal-ribbon right" aria-hidden="true" />
        </div>
        {stars <= 1 && <TryAgainCat />}
        <div className="gc-hero-copy">
          <span className="gc-stars" aria-label={`${stars} / 3`}>
            {[0, 1, 2].map((i) => <Star key={i} size={22} className={i < stars ? 'on' : ''} fill={i < stars ? 'currentColor' : 'none'} style={{ animationDelay: `${0.4 + i * 0.15}s` }} />)}
            <span className="gc-cheer">{cheer}</span>
          </span>
          <h2>{T.dashTitle}</h2>
          <span className="gc-hero-meta">
            {profile?.name && <span><UserRound size={15} />{profile.name}</span>}
            <span><CalendarDays size={15} />{formatDate(when || new Date(), lang === 'ta' ? 'tamil' : 'sinhala')}</span>
          </span>
        </div>
        <div className="gc-hero-actions">
          <button type="button" className="chunky-btn orange" onClick={onNewPage} title={T.btnNewPageTitle}><FilePlus2 size={17} />{T.btnNewPage.replace(/^\+\s*/, '')}</button>
          <button type="button" className="chunky-btn white" onClick={onNewSession} title={T.btnNewSessionTitle}><RotateCcw size={17} />{T.btnNewSession.replace(/^↺\s*/, '')}</button>
          <button type="button" className="gc-ghost" onClick={() => window.print()}><Printer size={16} />{T.print}</button>
        </div>
      </section>

      {data.grammar_unavailable && (
        <section className="gc-notice" role="status">
          <AlertTriangle size={20} />
          <span>{T.grammarUnavailable}</span>
          {onNewPage && <button type="button" className="gc-ghost" onClick={onNewPage}><RotateCcw size={15} />{T.btnNewPage.replace(/^\+\s*/, '')}</button>}
        </section>
      )}

      {/* Coach card for the most common mistake */}
      {dominant !== 'correct' && (feedback.si || dominantMeta) && (
        <section className="gc-coach" style={{ '--c': dominantMeta.color }}>
          <span className="gc-coach-icon"><Lightbulb size={22} /></span>
          <span className="gc-coach-body">
            <small>{T.coachTitle}</small>
            <strong>{dominantMeta.label || T.noAnalysisFallback}</strong>
            {feedback.si && <span className="gc-coach-tip">{feedback.si}</span>}
          </span>
        </section>
      )}

      {/* Line by line */}
      <section className="gc-card gc-lines">
        <header className="gc-card-head">
          <h3>{T.linesSectionTitle}</h3>
          <label className="gc-switch">
            <input type="checkbox" checked={showWritten} onChange={(e) => setShowWritten(e.target.checked)} />
            <span className="gc-switch-track" aria-hidden="true" />
            <Eye size={16} />{T.showWritten}
          </label>
        </header>
        <div className="gc-filters" role="group">
          {[['all', T.filterAll, lines.length], ['errors', T.filterErrors, errors], ['correct', T.filterCorrect, correct]].map(([key, label, count]) => (
            <button key={key} type="button" className={`gc-chip ${filter === key ? 'on' : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label}<b>{count}</b>
            </button>
          ))}
          {typeCounts.map(([type, count]) => (
            <button key={type} type="button" className={`gc-chip typed ${filter === `type:${type}` ? 'on' : ''}`} style={{ '--c': (EM[type] || EM.other).color }}
              aria-pressed={filter === `type:${type}`} onClick={() => setFilter(filter === `type:${type}` ? 'all' : `type:${type}`)}>
              <i />{(EM[type] || EM.other).label}<b>{count}</b>
            </button>
          ))}
        </div>

        <div className="gc-line-list">
          {visible.length ? visible.map(({ line, i }) => {
            const ok = line.error_type === 'correct';
            const meta = EM[line.error_type] || EM.other;
            const corrected = line.corrected_text || line.raw_text || '—';
            const changed = (line.raw_text || '').trim() !== (line.corrected_text || '').trim();
            return (
              <article key={i} className={`gc-line ${ok ? 'ok' : 'bad'}`} style={{ '--c': meta.color, animationDelay: `${Math.min(i, 10) * 0.04}s` }}>
                <span className="gc-line-num">{i + 1}</span>
                {line.line_img && <img className="gc-line-img" src={`data:image/png;base64,${line.line_img}`} alt="" />}
                <div className="gc-line-body">
                  <p className="gc-line-text"><Words words={markChanges(corrected, line.raw_text)} tone="fixed" /></p>
                  {showWritten && changed && (
                    <p className="gc-line-raw"><span>{T.machineRead}</span> <Words words={markChanges(line.raw_text, corrected)} tone="wrong" /></p>
                  )}
                  {line.feedback_si && <p className="gc-line-tip">{line.feedback_si}</p>}
                </div>
                <span className="gc-type"><i />{ok ? <CheckCircle2 size={15} /> : null}{ok ? T.filterCorrect : meta.label}</span>
              </article>
            );
          }) : <p className="gc-empty">{T.noLinesInFilter}</p>}
        </div>
      </section>

      {/* Grammar, sentence by sentence */}
      {sentences.length > 0 && (
        <section className="gc-card gc-sentences">
          <header className="gc-card-head">
            <h3>{T.sentencesTitle}</h3>
            <span className="gc-muted">{T.sentencesSub.replace(/^\s*[—-]\s*/, '')}</span>
          </header>
          {sentences.map((s, i) => {
            const unavailable = /^grammar check (skipped|failed)/i.test(s.grammar_note || '');
            const before = s.raw_before_grammar;
            const fixed = before && before.trim() !== (s.text || '').trim();
            const state = unavailable ? 'warn' : fixed || s.grammar_note ? 'fixed' : 'ok';
            return (
              <article key={i} className={`gc-sentence ${state}`}>
                <span className="gc-sentence-icon">
                  {state === 'ok' ? <CheckCircle2 size={18} /> : state === 'fixed' ? <Sparkles size={18} /> : <AlertTriangle size={18} />}
                </span>
                <div className="gc-sentence-body">
                  {fixed && <p className="gc-before"><Words words={markChanges(before, s.text)} tone="wrong" /></p>}
                  <p className="gc-after">{fixed ? <Words words={markChanges(s.text, before)} tone="fixed" /> : s.text}</p>
                  {s.grammar_note && (
                    <p className="gc-note">{unavailable ? translate(lang === 'ta' ? 'tamil' : 'sinhala', 'account.grammarUnavailable') : s.grammar_note}</p>
                  )}
                  {s.word_count <= 1 && <p className="gc-muted">{T.singleWordNote}</p>}
                </div>
                <span className={`gc-sentence-tag ${state}`}>
                  {state === 'ok' ? T.grammarOk : state === 'fixed' ? T.grammarChanged : '!'}
                  {s.is_combined && <small>{T.linesMerged}</small>}
                </span>
              </article>
            );
          })}
        </section>
      )}

      <section className="gc-encourage">
        <span className="gc-encourage-stars" aria-hidden="true">{[0, 1, 2].map((i) => <Star key={i} size={20} fill="currentColor" />)}</span>
        <strong>{T.encourageTitle}</strong>
        <span>{T.encourageSub}</span>
      </section>
    </div>
  );
}
