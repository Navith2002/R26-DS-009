import { BookOpenCheck, Ear, Lightbulb, Star } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { localizedActivity } from '../../i18n/fluencyActivities'
import { wordDiff } from '../../utils/wordDiff'
import { useLanguage } from '../../context/FluencyLanguageContext'

const PROFILE_NAMES = {
  Accurate: 'account.accurateReader',
  'Accurate & Fast Reader': 'account.fastReader',
  'Accurate & Slow Reader & Hesitant': 'account.slowReader',
  'Moderate Accuracy': 'account.moderateReader',
  'Moderate Accuracy & Slow Reader & Hesitant': 'account.moderateSlowReader',
  'Needs Accuracy': 'account.needsAccuracyReader',
}
const LEVELS = { Beginner: 'account.beginner', Intermediate: 'account.intermediate', Advanced: 'account.advanced' }
const SKILLS = { Accuracy: 'account.accuracy', Fluency: 'account.fluency', Hesitation: 'account.hesitation', 'Sentence Length': 'account.sentenceLength' }
const TOKEN_CLASS = { wrong: 'gc-word wrong', insertion: 'gc-word wrong', deletion: 'gc-word missing' }

// Body of the fluency report: reader profile coach card, what was read vs
// heard, the 4-skill reading profile and suggested activities.
//
// hideRecommendations / onStartPractice are only used by the
// "කියවුම් පුහුණුව" (reading practice) flow (FluencyPage.jsx,
// ReadingPracticePage*.jsx): hideRecommendations drops the whole
// suggested-activities section once the student is already working
// through a frozen practice plan, and onStartPractice -- when passed --
// adds a per-activity button that turns a fresh assessment's
// recommendations into a plan. Both default to off, so every other
// caller (FluencyResultPage.jsx's history view, plain ResultsStage)
// renders exactly as before.
export default function ProfileSummary({ result, audioUrl, hideRecommendations = false, onStartPractice = null }) {
  const { t, td } = useLanguage()
  const { language, t: appT } = useApp()
  const hasGroundTruth = Boolean(result.ground_truth)
  const tokens = hasGroundTruth ? wordDiff(result.ground_truth, result.transcript) : []
  const formatDim = (key) => td(`profile.dims.${key}`, appT('account.fluency'))
  const pct = (value) => (value >= 0 ? `${(value * 100).toFixed(1)}%` : appT('account.notAvailable'))
  // profile_desc_key is the backend's accuracy-gated key (see
  // resolve_profile_desc_key in backend/fluency_profiling/main.py) -- it
  // overrides the raw RF cluster name (profile_name) whenever accuracy is
  // too low for that cluster's usual reassuring blurb to make sense next
  // to the fluency_label badge above. Falls back to profile_name for
  // older saved profiles that predate this field.
  const descKey = result.profile_desc_key || result.profile_name

  return (
    <>
      <section className="gc-coach fl-coach" style={{ '--c': '#e8a020' }}>
        <span className="gc-coach-icon"><Lightbulb size={22} /></span>
        <span className="gc-coach-body">
          <small>{appT('fl.coachTitle')}</small>
          <strong>{appT(PROFILE_NAMES[descKey] || 'account.fluency')}</strong>
          <span className="gc-coach-tip">{td(`profile.descs.${descKey}`, t('profile.keepPractising'))}</span>
          {result.feedback_text && (
            <span className="fl-feedback">{result.feedback_text}</span>
          )}
        </span>
      </section>

      <section className="gc-card fl-compare">
        <header className="gc-card-head">
          <h3><Ear size={20} />{appT('fl.compareTitle')}</h3>
          <span className="fl-metrics">
            <span>{appT('account.characterErrors')} <b>{pct(result.cer)}</b></span>
            <span>{appT('account.wordErrors')} <b>{pct(result.wer)}</b></span>
            {result.confidence >= 0 && <span>{t('profile.match')} <b>{Math.round(result.confidence * 100)}%</b></span>}
          </span>
        </header>
        {audioUrl && (
          <div className="fl-audio">
            <span className="gc-muted">{t('profile.yourRecording')}</span>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={audioUrl} />
          </div>
        )}
        <div className="fl-compare-grid">
          <div className="fl-compare-col">
            <span className="fl-compare-label">{t('profile.expected')}</span>
            {hasGroundTruth
              ? <p lang="si">{result.ground_truth}</p>
              : <p className="gc-muted">{t('profile.notSaved')}</p>}
          </div>
          <div className="fl-compare-col heard">
            <span className="fl-compare-label">{t('profile.heard')}</span>
            <p lang="si">
              {hasGroundTruth
                ? tokens.map((tok, i) => (
                  <span key={i} className={TOKEN_CLASS[tok.type]}>{tok.text}{i < tokens.length - 1 ? ' ' : ''}</span>
                ))
                : result.transcript}
            </p>
          </div>
        </div>
      </section>

      <div className="fl-two">
        <section className="gc-card fl-skills">
          <header className="gc-card-head"><h3>{t('profile.readingProfile')}</h3></header>
          {Object.entries(result.skill_4d || {}).map(([key, value]) => {
            return (
              <div className="fl-skill" key={key}>
                <span className="fl-skill-name">{formatDim(key)}</span>
                <span className="fl-skill-track"><i style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }} /></span>
                <span className="fl-skill-value">{value.toFixed(2)}</span>
              </div>
            )
          })}
        </section>

        {!hideRecommendations && result.recommendations?.length > 0 && (
          <section className="gc-card fl-recs">
            <header className="gc-card-head"><h3><BookOpenCheck size={20} />{t('profile.suggestedActivities')}</h3></header>
            {result.recommendations.map((act) => {
              const activity = localizedActivity(act, language)
              return (
                <article className="fl-rec" key={act.act_id}>
                  <span className="fl-rec-top">
                    <span className="fl-rec-level">{appT(LEVELS[act.difficulty] || 'account.beginner')}</span>
                    <span className="gc-muted">{appT(SKILLS[act.target_skill] || 'account.fluency')}</span>
                  </span>
                  <strong>{activity.name}</strong>
                  <span className="gc-muted">{act.rationale || activity.description}</span>
                  {act.practice_sentence && (
                    <span className="fl-rec-sentence">{act.practice_sentence}</span>
                  )}
                  {onStartPractice && (
                    <button type="button" className="chunky-btn orange fl-rec-practice-btn" onClick={onStartPractice}>
                      {appT('fl.startPractice')}
                    </button>
                  )}
                </article>
              )
            })}
          </section>
        )}
      </div>

      <section className="gc-encourage">
        <span className="gc-encourage-stars" aria-hidden="true">{[0, 1, 2].map((i) => <Star key={i} size={20} fill="currentColor" />)}</span>
        <strong>{t('profile.keepPractising')}</strong>
      </section>
    </>
  )
}
