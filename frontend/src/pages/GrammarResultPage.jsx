import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/useApp';
import Dashboard from '../components/grammarCheck/Dashboard';
import '../components/grammarCheck/grammarCheck.css';

// Detail view for one past grammar-check run, reached by clicking an
// entry in the grammar-check section of HistoryPage. Reuses the same
// Dashboard the check itself shows right after analyzing (see
// GrammarCheckPage.jsx) -- just fed a stored run's full result instead
// of a fresh one.
export default function GrammarResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { grammarRuns, t } = useApp();

  const run = grammarRuns.find((item) => item.id === id);

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
    <div className="grammar-check-scope">
      <Dashboard
        data={run.result}
        language={run.language}
        onNewPage={() => navigate('/grammar-check')}
        onNewSession={() => navigate('/grammar-check')}
      />
    </div>
  );
}
