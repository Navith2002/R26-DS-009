import { BookOpen, PenLine } from 'lucide-react'
import { useLanguage } from '../../context/FluencyLanguageContext'

// Restyled to match WriteBright's own page styling (colors/fonts/sizes)
// exactly, same treatment as Studentgate.jsx and FluencyPage.jsx's
// dashboard empty-state: pulled outside .app.fluency-scope (see
// FluencyPage.jsx) and rebuilt with WriteBright's shared classes instead
// of this component's own .opt-grid/.opt-card palette. The two cards
// reuse the same orange/green gradient "storybook" card treatment
// HomePage.jsx's activity-grid uses (.feature-card.card-orange/
// .card-green in styles.css), just sized up via .picker-card for a
// page's main content instead of a small dashboard tile.
export default function PickerStage({ onPickList, onPickCustom, onBack }) {
  const { t } = useLanguage()

  return (
    <div className="page-stack">
      <div className="results-topbar">
        <button type="button" onClick={onBack}>← {t('picker.back')}</button>
      </div>

      <section className="page-intro">
        <h2>{t('picker.heading')}</h2>
        <p>{t('picker.subhead')}</p>
      </section>

      <div className="activity-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        <button type="button" className="feature-card picker-card card-orange" onClick={onPickList}>
          <div className="card-icon"><BookOpen size={28} /></div>
          <div>
            <h4>{t('picker.bankTitle')}</h4>
            <p>{t('picker.bankDesc')}</p>
          </div>
        </button>
        <button type="button" className="feature-card picker-card card-green" onClick={onPickCustom}>
          <div className="card-icon"><PenLine size={28} /></div>
          <div>
            <h4>{t('picker.customTitle')}</h4>
            <p>{t('picker.customDesc')}</p>
          </div>
        </button>
      </div>
    </div>
  )
}
