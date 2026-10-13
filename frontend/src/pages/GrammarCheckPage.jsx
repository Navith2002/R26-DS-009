import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { UI_TEXT } from '../components/grammarCheck/i18n';
import { analyzeGrammar } from '../services/grammarApi';
import { formatDate } from '../utils/format';
import UploadScreen from '../components/grammarCheck/UploadScreen';
import LoadingScreen from '../components/grammarCheck/LoadingScreen';
import Dashboard from '../components/grammarCheck/Dashboard';
import '../components/grammarCheck/grammarCheck.css';

// WriteBright's global language toggle (header) only knows
// 'sinhala' | 'tamil' (see LanguageToggle.jsx / AppContext); this
// component's own screens and /analyze use the short codes 'si' | 'ta'.
// Converting at the edges here keeps the copied components
// (LoadingScreen/Dashboard/i18n.js) unchanged from the standalone
// project. There's no language control on this page itself -- the
// header toggle drives it, same as every other WriteBright page.
function toShortCode(language) {
  return language === 'tamil' ? 'ta' : 'si';
}

export default function GrammarCheckPage() {
  const { language, registerGrammarRun, grammarRuns, t: appT } = useApp();
  const navigate = useNavigate();

  const [screen, setScreen] = useState('upload'); // 'upload' | 'loading' | 'dashboard'
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [step, setStep] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const stepIntervalRef = useRef(null);

  const shortLang = toShortCode(language);

  useEffect(() => () => clearInterval(stepIntervalRef.current), []);

  const t = UI_TEXT[shortLang] || UI_TEXT.si;

  function onFileSelect(file) {
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function finishAnalyze(data) {
    await registerGrammarRun(data, shortLang);
    setResult(data);
    setScreen('dashboard');
  }

  async function analyze() {
    if (!selectedFile) return;
    setError(null);
    setScreen('loading');
    setStep(1);

    // Simulate step progress while waiting, same pacing as the original.
    let stepN = 1;
    stepIntervalRef.current = setInterval(() => {
      if (stepN < 5) { stepN += 1; setStep(stepN); }
    }, 2000);

    try {
      const data = await analyzeGrammar({ file: selectedFile, language: shortLang });
      clearInterval(stepIntervalRef.current);
      setStep(5);
      await finishAnalyze(data);
    } catch (failure) {
      clearInterval(stepIntervalRef.current);
      setError(failure.code === 'history-too-large' ? 'account.historyTooLarge' : failure.code === 'history-save-failed' ? 'account.saveError' : 'account.analysisError');
      setScreen('upload');
    }
  }

  function clearFile() {
    setSelectedFile(null);
    setPreviewUrl(null);
  }

  function reset() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setScreen('upload');
  }

  // All three screens use the app's own styling (.gc-* in bhasha.css), so
  // none of them is wrapped in grammarCheck.css's .grammar-check-scope.
  if (screen === 'upload') {
    return (
      <>{error && <p className="account-error" role="alert">{appT(error)}</p>}<UploadScreen
        t={t}
        previewUrl={previewUrl}
        file={selectedFile}
        onFileSelect={onFileSelect}
        onClear={clearFile}
        canAnalyze={!!selectedFile}
        onAnalyze={analyze}
        recentRuns={[...grammarRuns].filter((run) => run.createdAt).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4)}
        onOpenRun={(run) => navigate(`/grammar-results/${run.id}`)}
        formatWhen={(when) => formatDate(when, language)}
      /></>
    );
  }

  if (screen === 'loading') {
    return <LoadingScreen t={t} step={step} previewUrl={previewUrl} />;
  }

  return result ? (
    <Dashboard data={result} language={shortLang} onNewPage={reset} onNewSession={reset} celebrate />
  ) : null;
}
