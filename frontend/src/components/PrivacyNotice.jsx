import { Link } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { useAuth } from '../auth/AuthContext';

export default function PrivacyNotice({ phase = 'before', full = false }) {
  const { t } = useApp();
  const paragraphs = full ? ['identity', 'children', 'storage', 'uploads', 'deletion'] : ['identity', 'children', 'deletion'];
  return <section className="privacy-notice" aria-label={t('privacy.title')}>
    <h3>{t(phase === 'after' ? 'privacy.after' : 'privacy.before')}</h3>
    {paragraphs.map((key) => <p key={key}>{t(`privacy.${key}`)}</p>)}
    {!full && <Link to="/privacy">{t('privacy.read')}</Link>}
  </section>;
}
export function PostSignupNotice() {
  const { privacyNoticePending, dismissPrivacyNotice } = useAuth();
  const { t } = useApp();
  if (!privacyNoticePending) return null;
  return <div className="post-signup-notice" role="status"><PrivacyNotice phase="after" /><button className="soft-btn" onClick={dismissPrivacyNotice}>{t('privacy.continue')}</button></div>;
}
