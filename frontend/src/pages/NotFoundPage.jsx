import { Link } from 'react-router-dom';
import { useApp } from '../context/useApp';

export default function NotFoundPage() {
  const { t } = useApp();
  return (
    <div className="not-found-card">
      <h2>{t('notFound.title')}</h2>
      <p>{t('notFound.text')}</p>
      <Link className="primary-action" to="/">{t('notFound.home')}</Link>
    </div>
  );
}
