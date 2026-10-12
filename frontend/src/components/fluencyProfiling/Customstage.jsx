import { useState } from 'react'
import { XCircle } from 'lucide-react'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { useLanguage } from '../../context/FluencyLanguageContext'

export default function CustomStage({ onSubmit, onBack, submitting, submitError }) {
  const [step, setStep] = useState('text') // text | capture
  const [groundTruth, setGroundTruth] = useState('')
  const [textError, setTextError] = useState('')
  const [tab, setTab] = useState('record') // record | upload
  const [uploadedFile, setUploadedFile] = useState(null)
  const { t, lang } = useLanguage()

  const rec = useAudioRecorder()

  function confirmSentence() {
    const val = groundTruth.trim()
    if (!val) {
      setTextError(t('custom.textErrorEmpty'))
      return
    }
    setTextError('')
    setGroundTruth(val)
    setStep('capture')
  }

  function switchTab(next) {
    setTab(next)
    if (next === 'record') setUploadedFile(null)
    else rec.reset()
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) setUploadedFile(file)
  }

  const recordedBlob = rec.getBlob()
  const audioBlob = tab === 'upload' ? uploadedFile : recordedBlob
  const canSubmit = Boolean(audioBlob) && !submitting

  function handleSubmit() {
    if (!audioBlob) return
    onSubmit({ audioBlob, groundTruth })
  }

  const mm = String(Math.floor(rec.seconds / 60)).padStart(2, '0')
  const ss = String(rec.seconds % 60).padStart(2, '0')

  // Restyled to match WriteBright's own page styling exactly, same
  // treatment as Pickerstage.jsx/Sentencestage.jsx -- self-contained
  // (no .app.fluency-scope ancestor needed), reusing
  // page-stack/page-intro/results-topbar/analyze-layout/analyze-card.
  if (step === 'text') {
    return (
      <div className="page-stack">
        <div className="results-topbar">
          <button type="button" onClick={onBack}>← {t('common.back')}</button>
        </div>

        <section className="page-intro">
          <h2>{t('custom.heading')}</h2>
          <p>{t('custom.subhead')}</p>
        </section>

        <div className="analyze-layout">
          <section className="analyze-card">
            <textarea
              rows={4}
              value={groundTruth}
              onChange={(e) => setGroundTruth(e.target.value)}
              placeholder="උදාහරණ: අම්මා කඩේට ගියා."
              lang="si"
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '14px 16px',
                outline: 0,
                fontSize: 16,
                lineHeight: 1.6,
                color: 'var(--text)',
                background: '#fff',
                resize: 'vertical',
                minHeight: 110,
              }}
            />
            {textError && (
              <div className="error-banner" style={{ marginTop: 12 }}>
                <XCircle size={18} /><span>{textError}</span>
              </div>
            )}
            <button className="soft-btn orange" style={{ justifyContent: 'center', marginTop: 16 }} onClick={confirmSentence}>
              {t('custom.confirmBtn')} →
            </button>
          </section>
        </div>
      </div>
    )
  }

  // step === 'capture' -- kept in its original fluencyProfiling.css look
  // for now (recording/upload UI is a bigger restyle than this pass
  // covers). Wrapped in its own local .fluency-scope div rather than
  // relying on FluencyPage's outer wrapper (the 'text' step above no
  // longer needs one), so this subtree's own CSS vars/classes
  // (.reading-card/.tab-row/.seal/.upload-zone etc) still resolve.
  return (
    <div className="fluency-scope" lang={lang === 'ta' ? 'ta' : 'si'}>
      <section className="stage custom-stage">
        <button type="button" className="link-back" onClick={onBack}>
          ← {t('common.back')}
        </button>

        <div className="gt-confirm">
          <span className="gt-confirm__label">✓ {t('custom.confirmedLabel')}</span>
          <button type="button" className="gt-edit" onClick={() => setStep('text')}>
            {t('custom.edit')}
          </button>
        </div>

        <div className="reading-card" style={{ marginBottom: 20 }}>
          <p className="reading-card__text" lang="si">
            {groundTruth}
          </p>
        </div>

        <div className="tab-row">
          <button
            type="button"
            className={`tab-btn ${tab === 'record' ? 'tab-btn--active' : ''}`}
            onClick={() => switchTab('record')}
          >
            🎤 {t('common.tabRecord')}
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'upload' ? 'tab-btn--active' : ''}`}
            onClick={() => switchTab('upload')}
          >
            ⬆ {t('common.tabUpload')}
          </button>
        </div>

        {tab === 'record' && (
          <div className="recorder">
            <button
              type="button"
              className={`seal seal--${rec.status}`}
              onClick={rec.status === 'recording' ? rec.stop : rec.start}
              disabled={rec.status === 'requesting' || rec.status === 'recorded' || submitting}
              aria-label={
                rec.status === 'recording' ? t('common.ariaStopRecording') : t('common.ariaStartRecording')
              }
            >
              <span className="seal__ring seal__ring--1" />
              <span className="seal__ring seal__ring--2" />
              <span className="seal__core">
                {rec.status === 'recording'
                  ? t('common.recordRecording')
                  : rec.status === 'recorded'
                    ? t('common.recordDone')
                    : t('common.recordIdle')}
              </span>
            </button>

            {rec.status === 'recording' && <p className="recorder__timer">{mm}:{ss}</p>}
            {rec.errorMsg && <p className="hint hint--error">{rec.errorMsg}</p>}

            {rec.status === 'recorded' && (
              <div className="recorder__playback">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio controls src={rec.audioUrl} />
                <button className="btn btn--ghost" onClick={rec.reset} disabled={submitting}>
                  {t('common.recordAgain')}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'upload' && (
          <div className="upload-zone-wrap">
            <label className="upload-zone" htmlFor="custom-audio-file">
              <span className="upload-zone__icon">🎵</span>
              <span className="upload-zone__title">
                {uploadedFile
                  ? `${uploadedFile.name} ${t('common.uploadedSuffix')} ✓`
                  : t('common.uploadPrompt')}
              </span>
              <span className="upload-zone__sub">{t('common.uploadSupported')}</span>
            </label>
            <input
              id="custom-audio-file"
              type="file"
              accept=".wav,.mp3,.m4a,.ogg,.webm,audio/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        )}

        <button
          className="btn btn--primary btn--full"
          style={{ marginTop: 16 }}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? t('common.scoring') : t('custom.submitAndAnalyse')}
        </button>

        {/* Was rendered by FluencyPage.jsx right after <CustomStage/>
            (still wrapped in .fluency-scope back then); now lives here
            instead since the 'text' step above no longer has that
            ancestor to rely on, and this .hint--error class does. */}
        {submitError && <p className="hint hint--error">{submitError}</p>}
      </section>
    </div>
  )
}
