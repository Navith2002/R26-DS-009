import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { LanguageProvider, useLanguage } from '../context/FluencyLanguageContext';
import ResultsStage from '../components/fluencyProfiling/Resultsstage';
import '../fluencyProfiling.css';

// Same idea as GrammarResultPage.jsx: detail view for one past fluency
// run, reached by clicking an entry in the "කියවුම් හැකියා පරීක්ෂණ"
// section of HistoryPage. Reuses the exact same ResultsStage/
// ProfileSummary FluencyPage.jsx shows right after an assessment
// finishes -- just fed a stored run's result instead of a fresh one.
// audioUrl is always null here: the recording only ever existed as a
// transient blob: URL, which isn't (and can't be) persisted -- see
// AppContext.jsx's registerFluencyRun / storage.js's saveFluencyRuns.
function FluencyResultInner({ run, onBack }) {
  const { language: appLanguage } = useApp();
  const { setLang } = useLanguage();
  const navigate = useNavigate();

  // Same sync as FluencyPage.jsx -- keeps this component tree's own
  // LanguageContext in lockstep with WriteBright's global toggle.
  useEffect(() => {
    setLang(appLanguage === 'tamil' ? 'ta' : 'si');
  }, [appLanguage, setLang]);

  return (
    <main className="app fluency-scope" lang={appLanguage === 'tamil' ? 'ta' : 'si'}>
      <ResultsStage
        result={run.result}
        audioUrl={null}
        onRecordAnother={() => navigate('/fluency')}
        onBackToDashboard={onBack}
      />
    </main>
  );
}

export default function FluencyResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fluencyRuns, t } = useApp();

  const run = fluencyRuns.find((item) => item.id === id);

  if (!run) {
    return (
      <div className="not-found-card">
        <h2>{t('results.resultNotFound')}</h2>
        <p>{t('results.resultNotFoundText')}</p>
        <button className="primary-action" onClick={() => navigate('/history')}>{t('history.title')}</button>
      </div>
    );
  }

  return (
    <LanguageProvider>
      <FluencyResultInner run={run} onBack={() => navigate('/history')} />
    </LanguageProvider>
  );
}
