import { Mic, Play, UserRound } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { useLanguage } from '../../context/FluencyLanguageContext'

// Start screen of the reading-fluency check (same .gc style as grammar check).
export default function StudentGate({ onStart }) {
  const { activeChild, t: appT } = useApp()
  const { t } = useLanguage()

  function handleSubmit(e) {
    e.preventDefault()
    onStart()
  }

  return (
    <div className="page-stack gc fl">
      <section className="page-intro">
        <span className="eyebrow">{t('gate.eyebrow')}</span>
        <h2>{t('gate.heading')}</h2>
      </section>

      <form className="gc-card fl-gate" onSubmit={handleSubmit}>
        <span className="fl-gate-icon" aria-hidden="true"><Mic size={34} /></span>
        <div className="fl-gate-body">
          <p>{t('gate.body')}</p>
          <span className="fl-child"><UserRound size={16} />{appT('account.currentChild', { name: activeChild.name })}</span>
        </div>
        <button type="submit" className="chunky-btn orange"><Play size={18} />{t('gate.beginBtn')}</button>
      </form>
    </div>
  )
}
