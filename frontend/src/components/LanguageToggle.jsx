import { Languages } from 'lucide-react';
import { useApp } from '../context/useApp';

export default function LanguageToggle({ compact = false }) {
  const { language, setLanguage, t } = useApp();

  return (
    <div className={`global-language-toggle ${compact ? 'compact' : ''}`} role="group" aria-label={t('language.switchLabel')}>
      {!compact && <Languages size={17} />}
      <button
        type="button"
        className={language === 'sinhala' ? 'active sinhala' : 'sinhala'}
        onClick={() => setLanguage('sinhala')}
        aria-pressed={language === 'sinhala'}
        title={t('language.sinhalaModel')}
      >
        <span className="toggle-script">අ</span>
        <span>සිංහල</span>
      </button>
      <button
        type="button"
        className={language === 'tamil' ? 'active tamil' : 'tamil'}
        onClick={() => setLanguage('tamil')}
        aria-pressed={language === 'tamil'}
        title={t('language.tamilModel')}
      >
        <span className="toggle-script">அ</span>
        <span>தமிழ்</span>
      </button>
    </div>
  );
}
