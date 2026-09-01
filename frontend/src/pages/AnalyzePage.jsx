<<<<<<< HEAD
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

=======
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
>>>>>>> origin/test
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
<<<<<<< HEAD

import {
  analyzeHandwriting,
  getHealth,
} from '../services/api';

import { useApp } from '../context/useApp';


const allowedTypes = [
  'image/jpeg',
  'image/png',
  'image/bmp',
  'image/tiff',
];

const maxBytes = 10 * 1024 * 1024;


export default function AnalyzePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    language,
    registerAnalysis,
    setLatestPreview,
    t,
  } = useApp();

  const uploadRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
=======
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
>>>>>>> origin/test
  const controllerRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
<<<<<<< HEAD
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
=======
>>>>>>> origin/test
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);

<<<<<<< HEAD

  // =========================================================
  // BACKEND HEALTH
  // =========================================================

  useEffect(() => {
    let active = true;

    getHealth()
      .then((data) => {
        if (active) {
          setHealth(data);
        }
      })
      .catch(() => {
        if (active) {
          setHealth({
            status: 'offline',
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);


  // =========================================================
  // ATTACH THE LIVE STREAM AFTER <video> IS RENDERED
  // =========================================================

  useEffect(() => {
    if (
      !cameraOpen
      || !videoRef.current
      || !streamRef.current
    ) {
      return;
    }

    const video = videoRef.current;

    video.srcObject = streamRef.current;

    const playPromise = video.play();

    if (playPromise?.catch) {
      playPromise.catch((err) => {
        console.error(
          'Camera playback failed:',
          err,
        );
      });
    }

    return () => {
      if (video.srcObject) {
        video.srcObject = null;
      }
    };
  }, [cameraOpen]);


  // =========================================================
  // OPTIONAL URL MODE
  //
  // /analyze?mode=camera
  // /analyze?mode=upload
  //
  // File pickers/camera permission may still require a direct
  // user action depending on the browser.
  // =========================================================

  useEffect(() => {
    const mode = new URLSearchParams(
      location.search,
    ).get('mode');

    if (!mode) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (mode === 'camera') {
        openCamera();
      }

      if (mode === 'upload') {
        openUpload();
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
    // openCamera/openUpload intentionally omitted because they are
    // stable page-local functions and this effect should only react
    // to the URL mode changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);


  // =========================================================
  // CLEANUP WHEN LEAVING PAGE
  // =========================================================

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      stopCameraStream();
    };
  }, []);


  // =========================================================
  // PREVIEW URL CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      if (
        preview
        && preview.startsWith('blob:')
      ) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);


  // =========================================================
  // FILE VALIDATION
  // =========================================================

  function validateFile(nextFile) {
    if (!nextFile) {
      return t('analyze.errNoFile');
    }

    if (nextFile.size > maxBytes) {
      return t('analyze.errLarge');
    }

    if (
      nextFile.type
      && !allowedTypes.includes(nextFile.type)
    ) {
      return t('analyze.errType');
    }

    return '';
  }


  // =========================================================
  // ACCEPT CAMERA / UPLOAD IMAGE
  // =========================================================

  function acceptFile(nextFile) {
    if (!nextFile) {
      return;
    }

    const message = validateFile(nextFile);

=======
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
>>>>>>> origin/test
    if (message) {
      setError(message);
      return;
    }
<<<<<<< HEAD

    const nextPreview = URL.createObjectURL(
      nextFile,
    );

    setFile(nextFile);
    setPreview(nextPreview);
    setLatestPreview(nextPreview);

=======
    if (preview) URL.revokeObjectURL(preview);
    const nextPreview = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setPreview(nextPreview);
    setLatestPreview(nextPreview);
>>>>>>> origin/test
    setError('');
    setStatus('idle');
  }

<<<<<<< HEAD

  // =========================================================
  // FILE UPLOAD
  // =========================================================

  function openUpload() {
    if (!uploadRef.current) {
      return;
    }

    uploadRef.current.value = '';
    uploadRef.current.click();
  }


  function handleUploadChange(event) {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    acceptFile(selectedFile);
  }


  // =========================================================
  // LIVE CAMERA
  // =========================================================

  function stopCameraStream() {
    const stream = streamRef.current;

    if (stream) {
      stream
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }


  async function openCamera() {
    setError('');
    setCameraStarting(true);

    try {
      if (
        !navigator.mediaDevices
        || !navigator.mediaDevices.getUserMedia
      ) {
        console.error(
          'getUserMedia is unavailable. Use HTTPS or localhost and a supported browser.',
        );

        setError(t('analyze.errGeneric'));
        return;
      }

      stopCameraStream();

      /*
       * "ideal: environment" prefers the rear camera on phones/tablets.
       * On laptops/desktops the available webcam is used.
       */
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: 'environment',
            },
            width: {
              ideal: 1920,
            },
            height: {
              ideal: 1080,
            },
          },
          audio: false,
        });

      streamRef.current = stream;

      setCameraOpen(true);
      setError('');
    } catch (err) {
      console.error(
        'Could not open camera:',
        err,
      );

      stopCameraStream();
      setCameraOpen(false);

      /*
       * Keep the child-facing error localized using the existing
       * translation key. The browser console keeps the technical
       * permission/device error for development.
       */
      setError(t('analyze.errGeneric'));
    } finally {
      setCameraStarting(false);
    }
  }


  function closeCamera() {
    stopCameraStream();

    setCameraOpen(false);
    setCameraStarting(false);
    setError('');
  }


  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      console.error(
        'Camera frame is not ready yet.',
      );

      setError(t('analyze.errGeneric'));
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context =
      canvas.getContext('2d');

    if (!context) {
      setError(t('analyze.errGeneric'));
      return;
    }

    context.drawImage(
      video,
      0,
      0,
      width,
      height,
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError(t('analyze.errGeneric'));
          return;
        }

        /*
         * Convert the captured frame into a normal File so the
         * existing analyzeHandwriting() API receives exactly the
         * same kind of object as a normal uploaded image.
         */
        const capturedFile = new File(
          [blob],
          `handwriting-${Date.now()}.jpg`,
          {
            type: 'image/jpeg',
            lastModified: Date.now(),
          },
        );

        acceptFile(capturedFile);
        closeCamera();
      },
      'image/jpeg',
      0.94,
    );
  }


  // =========================================================
  // DRAG AND DROP
  // =========================================================

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);

    const droppedFile =
      event.dataTransfer.files?.[0];

    acceptFile(droppedFile);
  }


  // =========================================================
  // REMOVE SELECTED IMAGE
  // =========================================================

  function removeImage() {
    if (
      preview
      && preview.startsWith('blob:')
    ) {
      URL.revokeObjectURL(preview);
    }

    setFile(null);
    setPreview(null);
    setLatestPreview(null);
    setError('');
    setStatus('idle');

    if (uploadRef.current) {
      uploadRef.current.value = '';
    }
  }


  // =========================================================
  // SEND TO HANDWRITING ANALYSIS BACKEND
  // =========================================================

  async function submit() {
    const message = validateFile(file);

    if (message) {
      setError(message);
      return;
    }

    setStatus('loading');
    setError('');

    controllerRef.current?.abort();

    controllerRef.current =
      new AbortController();

    try {
      /*
       * `file` may come from:
       * - live camera capture
       * - normal file/gallery upload
       * - drag and drop
       *
       * All three use the SAME handwriting-analysis backend.
       */
      const result =
        await analyzeHandwriting({
          file,
          language,
          signal:
            controllerRef.current.signal,
        });

      const entry =
        registerAnalysis(result);

      setStatus('success');

      navigate(
        `/results/${entry.id}`,
        {
          state: {
            result,
            preview,
          },
        },
      );
    } catch (err) {
      if (err?.name === 'AbortError') {
        return;
      }

      console.error(
        'Handwriting analysis failed:',
        err,
      );

      setStatus('error');
=======
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
>>>>>>> origin/test
      setError(t('analyze.errGeneric'));
    }
  }

<<<<<<< HEAD

  // =========================================================
  // API / MODEL READY STATE
  // =========================================================

  const selectedModel =
    health?.models?.[language];

  const healthLoaded =
    health !== null;

  const apiOnline =
    healthLoaded
    && health?.status !== 'offline';

  /*
   * Respect explicit backend model readiness when provided.
   * Otherwise treat the model as usable once the API is online.
   */
  const modelReady =
    selectedModel
      ? selectedModel.ready !== false
      : apiOnline;

  const ready =
    apiOnline && modelReady;


  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="analyze-page page-stack">

      {/* =====================================================
          PAGE HEADER
          ===================================================== */}

      <section className="page-intro split-intro kid-analyze-intro">
        <div>
          <span className="eyebrow">
            {t('analyze.eyebrow')}
          </span>

          <h2>
            {t('analyze.title')}
          </h2>
        </div>

        <div
          className={`
            api-status
            kid-ready-status
            ${ready ? 'online' : 'offline'}
          `}
        >
          <Sparkles size={18} />

          <div>
            <strong>
              {ready
                ? t('analyze.ready')
                : t('analyze.notReady')}
            </strong>
=======
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
>>>>>>> origin/test
          </div>
        </div>
      </section>

<<<<<<< HEAD

      <div className="analyze-layout">

        {/* ===================================================
            CAMERA / IMAGE UPLOAD
            =================================================== */}

        <section className="analyze-card upload-section">

          <div className="analyze-section-title">
            <h3>
              {t('analyze.photoHeading')}
            </h3>
          </div>


          {/* =================================================
              LIVE CAMERA
              ================================================= */}

          {cameraOpen && (
            <div className="live-camera-shell">

              <div className="live-camera-preview">

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                />

                <div className="camera-guide-frame">
                  <span>
                    {t('analyze.bestPhotoText')}
                  </span>
                </div>

              </div>


              <canvas
                ref={canvasRef}
                hidden
              />


              <div className="live-camera-actions">

                <button
                  className="soft-btn orange camera-capture-btn"
                  type="button"
                  onClick={capturePhoto}
                >
                  <Camera size={18} />

                  {t('analyze.takePhoto')}
                </button>


                <button
                  className="soft-btn camera-close-btn"
                  type="button"
                  onClick={closeCamera}
                  aria-label={t('analyze.removePhoto')}
                  title={t('analyze.removePhoto')}
                >
                  <XCircle size={18} />
                </button>

              </div>

            </div>
          )}


          {/* =================================================
              EMPTY / UPLOAD STATE
              ================================================= */}

          {!preview && !cameraOpen && (
            <div
              className={`dropzone ${dragging ? 'dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => {
                setDragging(false);
              }}
              onDrop={onDrop}
            >

              <div className="upload-orbit">
                {cameraStarting
                  ? (
                    <LoaderCircle
                      className="spin"
                      size={35}
                    />
                  )
                  : (
                    <UploadCloud
                      size={35}
                    />
                  )}
              </div>


              <h4>
                {t('analyze.dropTitle')}
              </h4>


              <div className="upload-actions">

                {/* LIVE CAMERA */}
                <button
                  className="soft-btn orange"
                  type="button"
                  onClick={openCamera}
                  disabled={cameraStarting}
                >
                  {cameraStarting
                    ? (
                      <LoaderCircle
                        className="spin"
                        size={18}
                      />
                    )
                    : (
                      <Camera
                        size={18}
                      />
                    )}

                  {t('analyze.takePhoto')}
                </button>


                {/* FILE / GALLERY */}
                <button
                  className="soft-btn teal"
                  type="button"
                  onClick={openUpload}
                  disabled={cameraStarting}
                >
                  <ImagePlus size={18} />

                  {t('analyze.choosePhoto')}
                </button>

              </div>

            </div>
          )}


          {/* =================================================
              CAPTURED / UPLOADED IMAGE PREVIEW
              ================================================= */}

          {preview && !cameraOpen && (
            <div className="image-preview-shell">

              <div className="image-preview">
                <img
                  src={preview}
                  alt={t('analyze.selectedAlt')}
                />
              </div>


              <div className="file-row">

                <FileImage size={20} />

                <div>
                  <strong>
                    {file?.name}
                  </strong>

                  <span>
                    {file
                      ? `${(
                        file.size
                        / 1024
                        / 1024
                      ).toFixed(2)} MB`
                      : ''}
                  </span>
                </div>


                <button
                  type="button"
                  onClick={removeImage}
                  aria-label={t('analyze.removePhoto')}
                >
                  <XCircle size={20} />
                </button>

              </div>


              <div className="preview-change-actions">

                <button
                  className="change-image-btn"
                  type="button"
                  onClick={openCamera}
                >
                  <Camera size={16} />

                  {t('analyze.takePhoto')}
                </button>


                <button
                  className="change-image-btn"
                  type="button"
                  onClick={openUpload}
                >
                  <RefreshCcw size={16} />

                  {t('analyze.changePhoto')}
                </button>

              </div>

            </div>
          )}


          {/* =================================================
              NORMAL FILE PICKER
              ================================================= */}

          <input
            ref={uploadRef}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/bmp,image/tiff,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
            onChange={handleUploadChange}
          />

        </section>


        {/* ===================================================
            PHOTO QUALITY TIP
            =================================================== */}

        <section className="analysis-note-card kid-photo-tips compact-photo-tip">

          <div className="note-icon">
            📷
          </div>

          <div>
            <h4>
              {t('analyze.bestPhoto')}
            </h4>

            <p>
              {t('analyze.bestPhotoText')}
            </p>
          </div>

        </section>


        {/* ===================================================
            ERROR
            =================================================== */}

        {error && (
          <div className="error-banner">

            <XCircle size={19} />

            <span>
              {error}
            </span>

          </div>
        )}


        {/* ===================================================
            ANALYSE BUTTON
            =================================================== */}

        <button
          className="analyze-submit"
          type="button"
          disabled={
            !file
            || status === 'loading'
            || !ready
            || cameraOpen
          }
          onClick={submit}
        >
          {status === 'loading'
            ? (
              <>
                <LoaderCircle
                  className="spin"
                  size={20}
                />

                {t('analyze.checking')}
              </>
            )
            : (
              <>
                {t('analyze.submit')}

                <span>
                  →
                </span>
              </>
            )}
        </button>

      </div>

=======
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
>>>>>>> origin/test
    </div>
  );
}
