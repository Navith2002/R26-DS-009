import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Camera,
  FileImage,
  ImagePlus,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { analyzeHandwriting, getHealth } from '../services/api';
import { useApp } from '../context/useApp';

const allowedTypes = ['image/jpeg', 'image/png', 'image/bmp', 'image/tiff'];
const maxBytes = 10 * 1024 * 1024;

export default function AnalyzePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, registerAnalysis, setLatestPreview, t } = useApp();
  const uploadRef = useRef(null);
  const cameraRef = useRef(null);
  const controllerRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth({ status: 'offline' }));
  }, []);

  useEffect(() => {
    const mode = new URLSearchParams(location.search).get('mode');
    if (mode === 'camera') setTimeout(() => cameraRef.current?.click(), 100);
    if (mode === 'upload') setTimeout(() => uploadRef.current?.click(), 100);
  }, [location.search]);

  useEffect(() => () => {
    controllerRef.current?.abort();
  }, []);

  function validateFile(nextFile) {
    if (!nextFile) return t('analyze.errNoFile');
    if (nextFile.size > maxBytes) return t('analyze.errLarge');
    if (nextFile.type && !allowedTypes.includes(nextFile.type)) return t('analyze.errType');
    return '';
  }

  function acceptFile(nextFile) {
    const message = validateFile(nextFile);
    if (message) {
      setError(message);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    const nextPreview = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setPreview(nextPreview);
    setLatestPreview(nextPreview);
    setError('');
    setStatus('idle');
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  async function submit() {
    const message = validateFile(file);
    if (message) return setError(message);

    setStatus('loading');
    setError('');
    controllerRef.current = new AbortController();

    try {
      // IMPORTANT: the same global language state controls both the UI language
      // and the backend model selected by POST /analyze.
      const result = await analyzeHandwriting({ file, language, signal: controllerRef.current.signal });
      const entry = registerAnalysis(result);
      setStatus('success');
      navigate(`/results/${entry.id}`, { state: { result, preview } });
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Handwriting analysis failed:', err);
      setStatus('error');
      // Keep the learner-facing UI fully localized. The technical backend
      // error remains available in the browser console for development.
      setError(t('analyze.errGeneric'));
    }
  }

  const selectedModel = health?.models?.[language];
  const ready = selectedModel?.ready !== false && health?.status !== 'offline';

  return (
    <div className="analyze-page page-stack">
      <section className="page-intro split-intro kid-analyze-intro">
        <div>
          <span className="eyebrow">{t('analyze.eyebrow')}</span>
          <h2>{t('analyze.title')}</h2>
        </div>
        <div className={`api-status kid-ready-status ${ready ? 'online' : 'offline'}`}>
          <Sparkles size={18} />
          <div>
            <strong>{ready ? t('analyze.ready') : t('analyze.notReady')}</strong>
          </div>
        </div>
      </section>

      <div className="analyze-layout">
        <section className="analyze-card upload-section">
          
          <div className="analyze-section-title">
            <h3>{t('analyze.photoHeading')}</h3>
          </div>
          {!preview ? (
            <div
              className={`dropzone ${dragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div className="upload-orbit"><UploadCloud size={35} /></div>
              <h4>{t('analyze.dropTitle')}</h4>
              <div className="upload-actions">
                <button className="soft-btn orange" type="button" onClick={() => cameraRef.current?.click()}><Camera size={18} /> {t('analyze.takePhoto')}</button>
                <button className="soft-btn teal" type="button" onClick={() => uploadRef.current?.click()}><ImagePlus size={18} /> {t('analyze.choosePhoto')}</button>
              </div>
            </div>
          ) : (
            <div className="image-preview-shell">
              <div className="image-preview"><img src={preview} alt={t('analyze.selectedAlt')} /></div>
              <div className="file-row">
                <FileImage size={20} />
                <div><strong>{file?.name}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}</span></div>
                <button type="button" onClick={() => { setFile(null); setPreview(null); setError(''); }} aria-label={t('analyze.removePhoto')}><XCircle size={20} /></button>
              </div>
              <button className="change-image-btn" type="button" onClick={() => uploadRef.current?.click()}><RefreshCcw size={16} /> {t('analyze.changePhoto')}</button>
            </div>
          )}
          <input ref={uploadRef} type="file" hidden accept="image/png,image/jpeg,image/bmp,image/tiff,.tif,.tiff" onChange={(e) => acceptFile(e.target.files?.[0])} />
          <input ref={cameraRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => acceptFile(e.target.files?.[0])} />
        </section>

        <section className="analysis-note-card kid-photo-tips compact-photo-tip">
          <div className="note-icon">📷</div>
          <h4>{t('analyze.bestPhoto')}</h4>
        </section>

        {error && <div className="error-banner"><XCircle size={19} /><span>{error}</span></div>}

        <button className="analyze-submit" disabled={!file || status === 'loading' || !ready} onClick={submit}>
          {status === 'loading'
            ? <><LoaderCircle className="spin" size={20} /> {t('analyze.checking')}</>
            : <>{t('analyze.submit')} <span>→</span></>}
        </button>
      </div>
    </div>
  );
}
