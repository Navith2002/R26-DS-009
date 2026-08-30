import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/useApp';
import { UI_TEXT } from '../components/grammarCheck/i18n';
import { getDemoData } from '../components/grammarCheck/demoData';
import { analyzeGrammar } from '../services/grammarApi';
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
  const { language, registerGrammarRun } = useApp();

  const [screen, setScreen] = useState('upload'); // 'upload' | 'loading' | 'dashboard'
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [step, setStep] = useState(1);
  const [result, setResult] = useState(null);

  const stepIntervalRef = useRef(null);

  const shortLang = toShortCode(language);

  useEffect(() => {
    document.documentElement.style.setProperty('--script', shortLang === 'ta' ? 'var(--tam)' : 'var(--sinh)');
  }, [shortLang]);

  useEffect(() => () => clearInterval(stepIntervalRef.current), []);

  const t = UI_TEXT[shortLang] || UI_TEXT.si;

  function onFileSelect(file) {
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function finishAnalyze(data) {
    registerGrammarRun(data, shortLang);
    setResult(data);
    setScreen('dashboard');
  }

  async function analyze() {
    if (!selectedFile) return;
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
      setTimeout(() => finishAnalyze(data), 600);
    } catch {
      clearInterval(stepIntervalRef.current);
      // Demo mode if the grammar-check backend isn't reachable, same
      // fallback the standalone project used.
      finishAnalyze(getDemoData());
    }
  }

  function reset() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setScreen('upload');
  }

  // The upload screen now uses WriteBright's own page styling (see
  // UploadScreen.jsx) so it isn't wrapped in .grammar-check-scope --
  // that class's CSS variables would otherwise repaint it with this
  // component's separate palette instead of the app's own colors.
  // Loading/Dashboard keep their existing look for now.
  if (screen === 'upload') {
    return (
      <UploadScreen
        t={t}
        previewUrl={previewUrl}
        onFileSelect={onFileSelect}
        canAnalyze={!!selectedFile}
        onAnalyze={analyze}
      />
    );
  }

  return (
    <div className="grammar-check-scope">
      {screen === 'loading' && <LoadingScreen t={t} step={step} />}

      {screen === 'dashboard' && result && (
        <Dashboard
          data={result}
          language={result.language || shortLang}
          onNewPage={reset}
          onNewSession={reset}
        />
      )}
    </div>
  );
}
