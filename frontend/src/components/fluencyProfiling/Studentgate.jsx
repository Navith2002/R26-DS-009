import { useState } from 'react'
import { useLanguage } from '../../context/FluencyLanguageContext'

// Restyled to match WriteBright's own AnalyzePage/ProfilePage layout,
// fonts, sizes and colors exactly (page-stack/page-intro/analyze-card/
// profile-form/primary-action, all straight from styles.css) instead of
// this component's own fluencyProfiling.css palette, which only
// approximated the same look with its own separately-tuned tokens.
// Same treatment as UploadScreen.jsx in the grammar-check component.
export default function StudentGate({ onStart }) {
  const [studentId, setStudentId] = useState('')
  const { t } = useLanguage()

  function handleSubmit(e) {
    e.preventDefault()
    onStart(studentId.trim())
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <span className="eyebrow">{t('gate.eyebrow')}</span>
        <h2>{t('gate.heading')}</h2>
      </section>

      {/* .analyze-layout carries a global max-width:900px (see styles.css's
          "Compact UI refinement" section) -- wrapping in it here keeps
          this card's width identical to AnalyzePage's, rather than
          stretching to fill the full page-stack width. Same fix as
          UploadScreen.jsx in the grammar-check component. */}
      <div className="analyze-layout">
        <section className="analyze-card">
          {/* 18px matches .analyze-section-title h3's actual computed size
              on AnalyzePage ("ඡායාරූපය එක් කරන්න") -- requested explicitly,
              same size for this body text and the label below. */}
          <p style={{ color: 'var(--muted)', fontSize: 18, lineHeight: 1.6, marginBottom: 18 }}>
            {t('gate.body')}
          </p>

          <form className="profile-form" onSubmit={handleSubmit}>
            <label htmlFor="student-id" style={{ fontSize: 18 }}>
              {t('gate.studentIdLabel')}
              <input
                id="student-id"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder={t('gate.studentIdPlaceholder')}
                autoComplete="off"
              />
            </label>

            {/* .soft-btn.orange, not .primary-action -- matches
                "ඡායාරූපයක් ගන්න" on AnalyzePage exactly (font-size:16px,
                padding:12px 15px, auto width) instead of .primary-action's
                width:100% + the unscoped "compact" override elsewhere in
                styles.css that was shrinking it to font-size:12px. */}
            {/* alignSelf:flex-start -- .profile-form is a flex column
                (default align-items:stretch), which would otherwise
                stretch this to the input's full width; "ඡායාරූපයක් ගන්න"
                sits in a flex row instead, so it's naturally auto-width. */}
            <button type="submit" className="soft-btn orange" style={{ justifyContent: 'center', alignSelf: 'flex-start' }}>
              {t('gate.beginBtn')}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
