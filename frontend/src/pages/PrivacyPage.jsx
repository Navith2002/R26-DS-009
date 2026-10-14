import { Link } from 'react-router-dom';
import { AccountFrame } from './AccountPage';
import PrivacyNotice from '../components/PrivacyNotice';
import { useApp } from '../context/useApp';

export default function PrivacyPage() {
  const { t } = useApp();
  return <AccountFrame><h1>{t('privacy.title')}</h1><PrivacyNotice full /><Link className="soft-btn" to="/">{t('privacy.back')}</Link></AccountFrame>;
}
