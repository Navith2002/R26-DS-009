import { useApp } from '../../context/useApp'
import { localizedActivity } from '../../i18n/fluencyActivities'
import { wordDiff, werBadgeTone } from '../../utils/wordDiff'
import { useLanguage } from '../../context/FluencyLanguageContext'

const LABEL_TONE = {
  Fluent: 'tone--green',
  Moderate: 'tone--amber',
  Struggling: 'tone--clay',
}

// CER/WER/confidence show as a small, muted line next to "Your recording"
// rather than as prominent top-of-page cards — they're detail for anyone
// curious, not the headline. showMetrics still gates the WER badge under
// the transcript comparison (WER already appears in the compact line
// above; the badge would be a third repeat of the same number) — pass
// showMetrics for a future denser/teacher view if that badge is wanted.
export default function ProfileSummary({ result, audioUrl, showMetrics = false }) {
  const { t, td } = useLanguage()
  const { language, t: appT } = useApp()
  const profileNames = { Accurate: 'account.accurateReader', 'Accurate & Fast Reader': 'account.fastReader', 'Accurate & Slow Reader & Hesitant': 'account.slowReader', 'Moderate Accuracy': 'account.moderateReader', 'Moderate Accuracy & Slow Reader & Hesitant': 'account.moderateSlowReader' }
  const levels = { Beginner: 'account.beginner', Intermediate: 'account.intermediate', Advanced: 'account.advanced' }
  const skills = { Accuracy: 'account.accuracy', Fluency: 'account.fluency', Hesitation: 'account.hesitation', 'Sentence Length': 'account.sentenceLength' }
  const weakestSet = new Set(result.weakest || [])
  const hasGroundTruth = Boolean(result.ground_truth)
  const werTone = werBadgeTone(result.wer)
  const diffTokens = hasGroundTruth ? wordDiff(result.ground_truth, result.transcript) : []

  // These three lookups are translated client-side because the values are
  // a small, known set of enum-like strings the backend already returns in
  // English (fluency_label, skill_4d keys, cluster/profile name). Anything
  // else that comes back from the API — activity name/description/skill/
  // difficulty — is free-text from the database and isn't translated here.
  function formatDim(key) {
    return td(`profile.dims.${key}`, appT('account.fluency'))
  }
  function formatFluencyLabel(label) {
    return td(`profile.fluencyLabel.${label}`, t('profile.keepPractising'))
  }
  function formatProfileDesc(name) {
    return td(`profile.descs.${name}`, t('profile.keepPractising'))
  }

  return (
    <>
      <div className={`result-banner ${LABEL_TONE[result.fluency_label] || ''}`}>
        <div>
          <span className="result-banner__label">{formatFluencyLabel(result.fluency_label)}</span>
          <span className="result-banner__profile">{appT(profileNames[result.profile_name] || 'account.fluency')}</span>
        </div>
      </div>

      <p className="profile-desc">{formatProfileDesc(result.profile_name)}</p>

      {weakestSet.size > 0 && (
        <div className="weak-tags">
          {[...weakestSet].map((dim) => (
            <span className="weak-tag" key={dim}>
              ↓ {formatDim(dim)}
            </span>
          ))}
        </div>
      )}

      <div className="analysis-card">
        {audioUrl && (
          <div className="analysis-audio">
            <div className="analysis-audio__head">
              <span className="transcript-compare__label">{t('profile.yourRecording')}</span>
              <span className="audio-meta">
                {appT('account.characterErrors')} {result.cer >= 0 ? `${(result.cer * 100).toFixed(1)}%` : appT('account.notAvailable')}
                <span className="audio-meta__dot"> · </span>
                {appT('account.wordErrors')} {result.wer >= 0 ? `${(result.wer * 100).toFixed(1)}%` : appT('account.notAvailable')}
                <span className="audio-meta__dot"> · </span>
                {(result.confidence * 100).toFixed(0)}% {t('profile.match')}
              </span>
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={audioUrl} />
          </div>
        )}

        <div className="transcript-compare">
          <div>
            <span className="transcript-compare__label">{t('profile.expected')}</span>
            {hasGroundTruth ? (
              <p lang="si">{result.ground_truth}</p>
            ) : (
              <p className="transcript-compare__missing">{t('profile.notSaved')}</p>
            )}
          </div>
          <div>
            <span className="transcript-compare__label">{t('profile.heard')}</span>
            {hasGroundTruth ? (
              <p lang="si">
                {diffTokens.map((tok, i) => (
                  <span key={i} className={`diff-tok diff-tok--${tok.type}`}>
                    {tok.text}
                    {i < diffTokens.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </p>
            ) : (
              <p lang="si">{result.transcript}</p>
            )}
          </div>
        </div>

        {showMetrics && werTone && (
          <div className="wer-badge-row">
            <span className={`wer-badge wer-badge--${werTone}`}>{appT('account.wordErrors')} {Math.round(result.wer * 100)}%</span>
            <span className="wer-hint">{t('profile.lowerIsBetter')}</span>
          </div>
        )}
      </div>

      <div className="skill-panel">
        <h3>{t('profile.readingProfile')}</h3>
        {Object.entries(result.skill_4d || {}).map(([key, value]) => (
          <div className={`skill-row ${weakestSet.has(key) ? 'skill-row--weak' : ''}`} key={key}>
            <span className="skill-row__label">{formatDim(key)}</span>
            <div className="skill-row__track">
              <div
                className="skill-row__fill"
                style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }}
              />
            </div>
            <span className="skill-row__value">{value.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {result.recommendations?.length > 0 && (
        <div className="recs">
          <h3>{t('profile.suggestedActivities')}</h3>
          <div className="recs__grid">
            {result.recommendations.map((act) => (
              <article className="rec-card" key={act.act_id}>
                <span className="rec-card__difficulty">{appT(levels[act.difficulty] || 'account.beginner')}</span>
                <h4>{localizedActivity(act, language).name}</h4>
                <p className="rec-card__skill">{appT(skills[act.target_skill] || 'account.fluency')}</p>
                <p className="rec-card__desc">{localizedActivity(act, language).description}</p>

              </article>
            ))}
          </div>
        </div>
      )}

      {result.note && <p className="result-note">{t('profile.keepPractising')}</p>}
    </>
  )
}