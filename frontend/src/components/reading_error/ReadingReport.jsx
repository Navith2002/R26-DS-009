import { TryAgainCat } from '../Lottie';
import {
  AlertTriangle, CalendarDays, CheckCircle2, Ear, Gauge, Lightbulb, Printer, Star, Timer, UserRound, Volume2, Zap,
} from 'lucide-react';
import { useApp } from '../../context/useApp';
import { formatDate } from '../../utils/format';
import { wordDiff } from '../../utils/wordDiff';
import { feedbackMessage, starsFor, studentGuideFor, translateResultValue } from './readingText';

const RING = 2 * Math.PI * 52;
const TOKEN_CLASS = { wrong: 'gc-word wrong', insertion: 'gc-word wrong', deletion: 'gc-word missing' };

// Reading-error report in the shared exercise-book report-card style.
// `language` is 'Sinhala' | 'Tamil'; `actions` are the buttons on the right.
export default function ReadingReport({ result, language, when, actions = [] }) {
  const { profile, language: appLanguage, t: appT } = useApp();
  const guide = studentGuideFor(language);
  const accuracy = Math.round(Number(result.accuracy || 0));
  const stars = starsFor(accuracy);
  const correct = result.error_type === 'Correct';
  const tokens = wordDiff(result.expected_text, result.predicted_text);
  const tiles = [
    { icon: Volume2, label: guide.voiceEnergy, value: translateResultValue(result.voice_energy, language) },
    { icon: Gauge, label: guide.confidence, value: translateResultValue(result.confidence, language) },
    { icon: Zap, label: guide.speechBehavior, value: translateResultValue(result.speech_behavior, language) },
    { icon: correct ? CheckCircle2 : AlertTriangle, label: guide.errorType, value: translateResultValue(result.error_type, language), tone: correct ? 'ok' : 'bad' },
  ];

  return (
    <div className="page-stack gc fl re gc-report">
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
            <span className="gc-cheer">{appT(`fl.cheer${stars}`)}</span>
          </span>
          <h2>{guide.resultTitle}</h2>
          <span className="gc-hero-meta">
            <span className={`re-status ${correct ? 'ok' : 'bad'}`}>
              {correct ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              {correct ? guide.correctReading : translateResultValue(result.error_type, language)}
            </span>
            {profile?.name && <span><UserRound size={15} />{profile.name}</span>}
            <span><CalendarDays size={15} />{formatDate(when || new Date(), appLanguage)}</span>
          </span>
        </div>
        <div className="gc-hero-actions">
          {actions.map(({ label, icon: Icon, onClick, kind }) => (
            <button key={label} type="button" className={`chunky-btn ${kind || 'white'}`} onClick={onClick}><Icon size={17} />{label}</button>
          ))}
          <button type="button" className="gc-ghost" onClick={() => window.print()}><Printer size={16} />{appT('fl.print')}</button>
        </div>
      </section>

      <section className="gc-coach" style={{ '--c': '#2f8fd8' }}>
        <span className="gc-coach-icon"><Lightbulb size={22} /></span>
        <span className="gc-coach-body">
          <small>{guide.feedbackTitle}</small>
          <span className="gc-coach-tip re-feedback">{feedbackMessage(accuracy, language)}</span>
        </span>
      </section>

      <section className="gc-card fl-compare">
        <header className="gc-card-head">
          <h3><Ear size={20} />{appT('fl.compareTitle')}</h3>
          <span className="fl-metrics">
            <span>WER <b>{result.wer ?? '-'}</b></span>
            <span><Timer size={14} /> {guide.readingTime} <b>{result.duration ?? '-'}s</b></span>
            <span>{guide.wordsPerSecond} <b>{result.speech_rate ?? '-'}</b></span>
          </span>
        </header>
        <div className="fl-compare-grid">
          <div className="fl-compare-col">
            <span className="fl-compare-label">{guide.expectedLabel}</span>
            <p>{result.expected_text}</p>
          </div>
          <div className="fl-compare-col heard">
            <span className="fl-compare-label">{guide.predictedLabel}</span>
            <p>
              {tokens.length
                ? tokens.map((tok, i) => <span key={i} className={TOKEN_CLASS[tok.type]}>{tok.text}{i < tokens.length - 1 ? ' ' : ''}</span>)
                : result.predicted_text || '-'}
            </p>
          </div>
        </div>
      </section>

      <section className="gc-card">
        <header className="gc-card-head"><h3>{guide.voiceAnalysis}</h3></header>
        <div className="re-tiles">
          {tiles.map(({ icon: Icon, label, value, tone }) => (
            <div key={label} className={`re-tile ${tone || ''}`}>
              <span className="re-tile-icon"><Icon size={20} /></span>
              <span className="re-tile-body"><small>{label}</small><strong>{value}</strong></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
