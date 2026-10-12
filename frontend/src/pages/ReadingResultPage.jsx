import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { formatDate } from '../utils/format';

export default function ReadingResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { readingRuns, language, t } = useApp();
  const run = readingRuns.find((item) => item.id === id);
  if (!run) return <div className="not-found-card"><h2>{t('results.resultNotFound')}</h2><button className="primary-action" onClick={() => navigate('/history')}>{t('history.title')}</button></div>;
  return <div className="page-stack">
    <section className="page-intro"><h2>{t('account.readingHistory')}</h2><p>{formatDate(run.createdAt, language)}</p></section>
    <section className="result-card">
      <h3>{t('account.readingAccuracy', { value: Number(run.result.accuracy || 0).toFixed(0) })}</h3>
      <h4>{t('account.expected')}</h4><p>{run.result.expected_text}</p>
      <h4>{t('account.recognized')}</h4><p>{run.result.predicted_text}</p>
    </section>
    <button className="primary-action" onClick={() => navigate('/history')}>{t('history.title')}</button>
  </div>;
}
