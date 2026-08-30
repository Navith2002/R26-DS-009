import { useLanguage } from '../../context/FluencyLanguageContext'

export default function PickerStage({ onPickList, onPickCustom, onBack }) {
  const { t } = useLanguage()

  return (
    <section className="stage">
      <button type="button" className="link-back" onClick={onBack}>
        ← {t('picker.back')}
      </button>

      <h2>{t('picker.heading')}</h2>
      <p className="stage__subhead">{t('picker.subhead')}</p>

      <div className="opt-grid">
        <button type="button" className="opt-card" onClick={onPickList}>
          <span className="opt-card__icon">📖</span>
          <span className="opt-card__title">{t('picker.bankTitle')}</span>
          <span className="opt-card__desc">{t('picker.bankDesc')}</span>
        </button>
        <button type="button" className="opt-card" onClick={onPickCustom}>
          <span className="opt-card__icon">✏️</span>
          <span className="opt-card__title">{t('picker.customTitle')}</span>
          <span className="opt-card__desc">{t('picker.customDesc')}</span>
        </button>
      </div>
    </section>
  )
}