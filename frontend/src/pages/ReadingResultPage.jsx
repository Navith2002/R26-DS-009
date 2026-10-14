import { useNavigate, useParams } from 'react-router-dom';
import { History, Mic } from 'lucide-react';
import { useApp } from '../context/useApp';
import ReadingReport from '../components/reading_error/ReadingReport';

// One past reading-error check from History, shown with the same report
// the live check uses.
export default function ReadingResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { readingRuns, language, t } = useApp();
  const run = readingRuns.find((item) => item.id === id);

  if (!run) {
    return (
      <div className="not-found-card">
        <h2>{t('results.resultNotFound')}</h2>
        <button className="primary-action" onClick={() => navigate('/history')}>{t('history.title')}</button>
      </div>
    );
  }

  const readingLanguage = (run.language || language) === 'tamil' ? 'Tamil' : 'Sinhala';
  return (
    <ReadingReport
      result={run.result}
      language={readingLanguage}
      when={run.createdAt}
      actions={[
        { label: t('nav.readingError'), icon: Mic, kind: 'orange', onClick: () => navigate('/reading-error') },
        { label: t('history.title'), icon: History, kind: 'white', onClick: () => navigate('/history') },
      ]}
    />
  );
}
