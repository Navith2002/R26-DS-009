import { useRef, useState } from 'react';
import { Camera, ImagePlus, UploadCloud } from 'lucide-react';

// Restyled to match WriteBright's own AnalyzePage layout/colors exactly
// (page-stack/page-intro/analyze-card/dropzone/soft-btn/analyze-submit,
// all from styles.css) instead of this component's own grammarCheck.css
// palette -- per request, so this screen reads as part of the same app,
// not a visually distinct sub-app. Deliberately does NOT include
// AnalyzePage's "use a clear photo" tip card. The language toggle in
// WriteBright's own header already drives this page (see
// GrammarCheckPage.jsx's toShortCode/toAppLanguage), so there's no
// separate inline language row here the way the standalone version had.
export default function UploadScreen({
  t, previewUrl, onFileSelect, canAnalyze, onAnalyze,
}) {
  const uploadRef = useRef(null);
  const cameraRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <span className="eyebrow">{t.eyebrow}</span>
        <h2>{t.title}</h2>
      </section>

      {/* .analyze-layout carries a global max-width:900px (see styles.css's
          "Compact UI refinement" section, which overrides its own earlier
          grid rule at every width, not just mobile) -- wrapping in it here
          keeps this card's width identical to AnalyzePage's, rather than
          stretching to fill the full page-stack width. */}
      <div className="analyze-layout">
        <section className="analyze-card upload-section">
          <div className="analyze-section-title">
            <h3>{t.photoHeading}</h3>
          </div>

          {!previewUrl ? (
            <div
              className={`dropzone ${dragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <div className="upload-orbit"><UploadCloud size={35} /></div>
              <h4>{t.dropTitle}</h4>
              <div className="upload-actions">
                <button className="soft-btn orange" type="button" onClick={() => cameraRef.current?.click()}>
                  <Camera size={18} /> {t.takePhoto}
                </button>
                <button className="soft-btn teal" type="button" onClick={() => uploadRef.current?.click()}>
                  <ImagePlus size={18} /> {t.choosePhoto}
                </button>
              </div>
            </div>
          ) : (
            <div className="image-preview-shell">
              <div className="image-preview"><img src={previewUrl} alt="" /></div>
            </div>
          )}

          <input ref={uploadRef} type="file" hidden accept="image/*" onChange={(e) => onFileSelect(e.target.files?.[0])} />
          <input ref={cameraRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => onFileSelect(e.target.files?.[0])} />
        </section>

        {canAnalyze && (
          <button className="analyze-submit" type="button" onClick={onAnalyze}>
            {t.submit} <span>→</span>
          </button>
        )}
      </div>
    </div>
  );
}
