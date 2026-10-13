import { useState } from 'react'
import { ArrowRight, FileAudio, Mic, RotateCcw, Square, Upload } from 'lucide-react'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { useLanguage } from '../../context/FluencyLanguageContext'

// Record-or-upload panel shared by the sentence-bank and own-sentence
// stages: big mic button with pulsing rings + live timer, playback with
// "record again", or an audio drop zone; then one submit button.
export default function Recorder({ onSubmit, submitting, submitLabel }) {
  const [tab, setTab] = useState('record') // record | upload
  const [uploadedFile, setUploadedFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const { t } = useLanguage()
  const rec = useAudioRecorder()

  function switchTab(next) {
    setTab(next)
    if (next === 'record') setUploadedFile(null)
    else rec.reset()
  }

  function pickFile(file) {
    if (file) setUploadedFile(file)
  }

  const audioBlob = tab === 'upload' ? uploadedFile : rec.getBlob()
  const canSubmit = Boolean(audioBlob) && !submitting
  const mm = String(Math.floor(rec.seconds / 60)).padStart(2, '0')
  const ss = String(rec.seconds % 60).padStart(2, '0')
  const recording = rec.status === 'recording'

  return (
    <section className="gc-card fl-recorder">
      <div className="fl-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'record'} className={tab === 'record' ? 'on' : ''} onClick={() => switchTab('record')}>
          <Mic size={17} />{t('common.tabRecord')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'upload'} className={tab === 'upload' ? 'on' : ''} onClick={() => switchTab('upload')}>
          <Upload size={17} />{t('common.tabUpload')}
        </button>
      </div>

      {tab === 'record' && (
        <div className="fl-mic-area">
          {rec.status !== 'recorded' ? (
            <>
              <button
                type="button"
                className={`fl-mic ${recording ? 'live' : ''}`}
                onClick={recording ? rec.stop : rec.start}
                disabled={rec.status === 'requesting' || submitting}
                aria-label={recording ? t('common.ariaStopRecording') : t('common.ariaStartRecording')}
              >
                <span className="fl-mic-ring one" aria-hidden="true" />
                <span className="fl-mic-ring two" aria-hidden="true" />
                <span className="fl-mic-core">{recording ? <Square size={30} fill="currentColor" /> : <Mic size={36} />}</span>
              </button>
              <span className="fl-mic-label">{recording ? t('common.recordRecording') : t('common.recordIdle')}</span>
              {recording && (
                <span className="fl-timer" aria-live="polite">
                  <i className="fl-live-dot" aria-hidden="true" />{mm}:{ss}
                  <span className="fl-wave" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map((i) => <b key={i} style={{ animationDelay: `${i * 0.09}s` }} />)}</span>
                </span>
              )}
            </>
          ) : (
            <div className="fl-playback">
              <span className="fl-playback-done"><Mic size={18} />{t('common.recordDone')}</span>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={rec.audioUrl} />
              <button type="button" className="gc-ghost" onClick={rec.reset} disabled={submitting}><RotateCcw size={15} />{t('common.recordAgain')}</button>
            </div>
          )}
          {rec.errorMsg && <p className="fl-error">{rec.errorMsg}</p>}
        </div>
      )}

      {tab === 'upload' && (
        <label
          className={`gc-drop fl-audio-drop ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }}
        >
          <span className="gc-drop-orbit"><FileAudio size={30} /></span>
          <strong className="gc-drop-title">{uploadedFile ? `${uploadedFile.name} ${t('common.uploadedSuffix')} ✓` : t('common.uploadPrompt')}</strong>
          <span className="gc-drop-paste">{t('common.uploadSupported')}</span>
          <input type="file" hidden accept=".wav,.mp3,.m4a,.ogg,.webm,audio/*" onChange={(e) => pickFile(e.target.files?.[0])} />
        </label>
      )}

      <button className="chunky-btn orange gc-submit" type="button" onClick={() => audioBlob && onSubmit(audioBlob)} disabled={!canSubmit}>
        {submitting ? t('common.scoring') : submitLabel} {!submitting && <ArrowRight size={18} />}
      </button>
    </section>
  )
}
