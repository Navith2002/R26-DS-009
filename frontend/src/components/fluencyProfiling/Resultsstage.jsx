import { TryAgainCat } from '../Lottie'
import { CalendarDays, Mic, Printer, RotateCcw, Star, UserRound } from 'lucide-react'
import ProfileSummary from './Profilesummary'
import { useLanguage } from '../../context/FluencyLanguageContext'
import { useApp } from '../../context/useApp'
import { formatDateNumeric } from '../../utils/format'

const RING = 2 * Math.PI * 52
const STARS = { Fluent: 3, Moderate: 2, Struggling: 1 }

// Fluency report: same exercise-book report card as the grammar check
// (.gc-hero in bhasha.css), then the reading profile details.
export default function ResultsStage({ result, audioUrl, onRecordAnother, onBackToDashboard, when, onStartPractice }) {
  const { t, td } = useLanguage()
  const { profile, t: appT } = useApp()
  const accuracy = result.wer >= 0 ? Math.round(Math.max(0, 1 - result.wer) * 100) : 0
  const stars = STARS[result.fluency_label] || 1

  return (
    <div className="page-stack gc fl gc-report">
      <section className="gc-hero fl-hero">
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
          <h2>{appT('fl.reportTitle')}</h2>
          <span className="gc-hero-meta">
            <span className="fl-level-pill"><Mic size={15} />{td(`profile.fluencyLabel.${result.fluency_label}`, t('profile.keepPractising'))}</span>
            {profile?.name && <span><UserRound size={15} />{profile.name}</span>}
            <span><CalendarDays size={15} />{formatDateNumeric(when || new Date())}</span>
          </span>
        </div>
        <div className="gc-hero-actions">
          <button type="button" className="chunky-btn orange" onClick={onRecordAnother}><Mic size={17} />{t('results.readAnother')}</button>
          <button type="button" className="chunky-btn white" onClick={onBackToDashboard}><RotateCcw size={17} />{t('results.backToDashboard')}</button>
          <button type="button" className="gc-ghost" onClick={() => window.print()}><Printer size={16} />{appT('fl.print')}</button>
        </div>
      </section>

      <ProfileSummary result={result} audioUrl={audioUrl} onStartPractice={onStartPractice} />
    </div>
  )
}
