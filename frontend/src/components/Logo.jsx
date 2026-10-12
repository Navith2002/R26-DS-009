import { PenLine } from 'lucide-react';
import { useApp } from '../context/useApp';

export default function Logo({ compact = false }) {
  const { t } = useApp();
  return (
    <div className="logo">
      <div className="logo-symbol"><PenLine size={23} strokeWidth={2.6} /></div>
      {!compact && (
        <div className="logo-text">
          <h2>WriteBright</h2>
          <span>{t('logo.tagline')}</span>
        </div>
      )}
    </div>
  );
}
