import { PeekingCat } from '../Lottie';
import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Camera, CheckCircle2, ClipboardPaste, ImagePlus,
  PenLine, RefreshCw, ScanText, Trash2, UploadCloud,
} from 'lucide-react';

// Quick in-browser photo check: average brightness from a downscaled copy
// and the photo's pixel size. Advisory only, the check still runs.
function usePhotoQuality(previewUrl) {
  const [quality, setQuality] = useState(null);
  useEffect(() => {
    if (!previewUrl) { setQuality(null); return undefined; }
    let alive = true;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 48; canvas.height = 48;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 48, 48);
      const { data } = ctx.getImageData(0, 0, 48, 48);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const brightness = sum / (data.length / 4);
      if (alive) {
        setQuality({
          light: brightness < 70 ? 'dark' : brightness > 230 ? 'bright' : 'good',
          size: Math.min(img.naturalWidth, img.naturalHeight) < 700 ? 'small' : 'good',
          width: img.naturalWidth, height: img.naturalHeight,
        });
      }
    };
    img.src = previewUrl;
    return () => { alive = false; };
  }, [previewUrl]);
  return quality;
}

function formatBytes(bytes) {
  if (!bytes) return '';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function UploadScreen({
  t, previewUrl, file, onFileSelect, onClear, canAnalyze, onAnalyze, recentRuns = [], onOpenRun, formatWhen,
}) {
  const uploadRef = useRef(null);
  const cameraRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const quality = usePhotoQuality(previewUrl);

  // Paste a photo straight from the clipboard (Ctrl + V).
  useEffect(() => {
    function onPaste(event) {
      const pasted = [...(event.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
      if (pasted) { event.preventDefault(); onFileSelect(pasted); }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFileSelect]);

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFileSelect(dropped);
  }

  const checks = quality ? [
    { ok: quality.light === 'good', text: quality.light === 'good' ? t.qGoodLight : quality.light === 'dark' ? t.qDark : t.qBright },
    { ok: quality.size === 'good', text: quality.size === 'good' ? t.qGoodSize : t.qSmall },
  ] : [];

  return (
    <div className="page-stack gc">
      <section className="page-intro gc-intro">
        <span className="eyebrow">{t.eyebrow}</span>
        <h2>{t.title}</h2>
      </section>

      <div className={`gc-upload-grid ${recentRuns.length ? '' : 'solo'}`}>
        <section className="gc-card gc-upload">
          <header className="gc-card-head"><h3>{t.photoHeading}</h3></header>

          {!previewUrl ? (
            <div
              className={`gc-drop has-peek ${dragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <PeekingCat />
              <span className="gc-drop-orbit"><UploadCloud size={30} /></span>
              <strong className="gc-drop-title">{t.dropTitle}</strong>
              <span className="gc-drop-paste"><ClipboardPaste size={15} /> {t.pasteHint}</span>
              <div className="gc-drop-actions">
                <button className="chunky-btn orange" type="button" onClick={() => cameraRef.current?.click()}>
                  <Camera size={18} /> {t.takePhoto}
                </button>
                <button className="chunky-btn white" type="button" onClick={() => uploadRef.current?.click()}>
                  <ImagePlus size={18} /> {t.choosePhoto}
                </button>
              </div>
            </div>
          ) : (
            <div className="gc-preview">
              <div className="gc-preview-frame"><img src={previewUrl} alt="" /></div>
              <div className="gc-preview-meta">
                <span className="gc-file">
                  <ImagePlus size={16} />
                  <span>{file?.name}</span>
                  <small>{[formatBytes(file?.size), quality ? `${quality.width}×${quality.height}` : ''].filter(Boolean).join(' · ')}</small>
                </span>
                <span className="gc-preview-actions">
                  <button type="button" className="gc-ghost" onClick={() => uploadRef.current?.click()}><RefreshCw size={15} /> {t.change}</button>
                  <button type="button" className="gc-ghost danger" onClick={onClear}><Trash2 size={15} /> {t.remove}</button>
                </span>
              </div>
              {!!checks.length && (
                <div className="gc-quality" aria-label={t.qualityTitle}>
                  {checks.map((check) => (
                    <span key={check.text} className={`gc-check ${check.ok ? 'ok' : 'warn'}`}>
                      {check.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{check.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <input ref={uploadRef} type="file" hidden accept="image/*" onChange={(e) => onFileSelect(e.target.files?.[0])} />
          <input ref={cameraRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => onFileSelect(e.target.files?.[0])} />

          <button className="chunky-btn orange gc-submit" type="button" onClick={onAnalyze} disabled={!canAnalyze}>
            <ScanText size={19} /> {t.submit} <ArrowRight size={18} />
          </button>
        </section>

        {!!recentRuns.length && (
          <aside className="gc-side">
            <section className="gc-card gc-recent">
              <header className="gc-card-head"><h3>{t.recentTitle}</h3></header>
              {recentRuns.map((run) => {
                const accuracy = run.total > 0 ? Math.round((run.correct / run.total) * 100) : 0;
                return (
                  <button key={run.id} type="button" className="gc-recent-row" onClick={() => onOpenRun(run)}>
                    <span className="gc-recent-icon"><PenLine size={16} /></span>
                    <span className="gc-recent-when">{formatWhen(run.createdAt)}</span>
                    <span className={`gc-recent-score ${accuracy >= 80 ? 'good' : accuracy >= 50 ? 'mid' : 'low'}`}>{accuracy}%</span>
                  </button>
                );
              })}
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
