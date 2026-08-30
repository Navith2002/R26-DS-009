import { useState } from 'react'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { useLanguage } from '../../context/FluencyLanguageContext'

export default function CustomStage({ onSubmit, onBack, submitting }) {
  const [step, setStep] = useState('text') // text | capture
  const [groundTruth, setGroundTruth] = useState('')
  const [textError, setTextError] = useState('')
  const [tab, setTab] = useState('record') // record | upload
  const [uploadedFile, setUploadedFile] = useState(null)
  const { t } = useLanguage()

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

  return (
    <section className="stage custom-stage">
      <button type="button" className="link-back" onClick={onBack}>
        ← {t('common.back')}
      </button>

      {step === 'text' && (
        <>
          <h2>{t('custom.heading')}</h2>
          <p className="stage__subhead">{t('custom.subhead')}</p>
          <textarea
            className="gt-input"
            rows={3}
            value={groundTruth}
            onChange={(e) => setGroundTruth(e.target.value)}
            placeholder="උදාහරණ: අම්මා කඩේට ගියා."
            lang="si"
          />
          {textError && <p className="hint hint--error">{textError}</p>}
          <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={confirmSentence}>
            {t('custom.confirmBtn')} →
          </button>
        </>
      )}

      {step === 'capture' && (
        <>
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
        </>
      )}
    </section>
  )
}