import { ArrowLeft, ArrowRight, BookOpen, PenLine } from 'lucide-react'
import { useLanguage } from '../../context/FluencyLanguageContext'

// Choose how to assess: a sentence from the bank, or the child's own.
export default function PickerStage({ onPickList, onPickCustom, onBack }) {
  const { t } = useLanguage()
  const options = [
    { key: 'bank', tone: 'saffron', icon: BookOpen, title: t('picker.bankTitle'), desc: t('picker.bankDesc'), onClick: onPickList },
    { key: 'custom', tone: 'green', icon: PenLine, title: t('picker.customTitle'), desc: t('picker.customDesc'), onClick: onPickCustom },
  ]

  return (
    <div className="page-stack gc fl">
      <button type="button" className="gc-ghost fl-back" onClick={onBack}><ArrowLeft size={16} />{t('picker.back')}</button>

      <section className="page-intro">
        <h2>{t('picker.heading')}</h2>
        <p>{t('picker.subhead')}</p>
      </section>

      <div className="fl-options">
        {options.map(({ key, tone, icon: Icon, title, desc, onClick }) => (
          <button key={key} type="button" className={`fl-option tone-${tone}`} onClick={onClick}>
            <span className="fl-option-icon"><Icon size={30} /></span>
            <span className="fl-option-title">{title}</span>
            <span className="fl-option-desc">{desc}</span>
            <span className="fl-option-go"><ArrowRight size={20} /></span>
          </button>
        ))}
      </div>
    </div>
  )
}
