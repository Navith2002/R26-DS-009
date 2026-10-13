import logo from '../assets/bhasha-logo.webp';
import mark from '../assets/bhasha-mark.webp';
import { useApp } from '../context/useApp';

// The wordmark already reads "Bhasha", so the brand name is only given to
// screen readers. The square mark replaces the wordmark where the sidebar
// collapses to icons (styles: .logo-mark in bhasha.css).
export default function Logo({ compact = false }) {
  const { t } = useApp();
  return (
    <div className="logo">
      {!compact && <img className="logo-wordmark" src={logo} alt={t('account.brand')} />}
      <img className="logo-mark" src={mark} alt={compact ? t('account.brand') : ''} aria-hidden={compact ? undefined : 'true'} />
    </div>
  );
}
