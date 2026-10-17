import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpenCheck } from 'lucide-react'
import ProfileSummary from './Profilesummary'
import { useApp } from '../../context/useApp'

// Shown right after submitting one activity's recording while working
// through a "කියවුම් පුහුණුව" practice plan (see FluencyPage.jsx's
// handlePlanSubmit). Reuses ProfileSummary for the report but hides its
// usual "suggested next activities" -- inside a plan the student already
// has their fixed 5, so this replaces that section with one button: move
// on to the next plan activity, or (on the 5th) go to the full summary.
export default function PlanProgressStage({ result, audioUrl, planId, planIndex }) {
  const navigate = useNavigate()
  const { fluencyPlans, t: appT } = useApp()
  const plan = fluencyPlans.find((item) => item.id === planId)
  const activities = plan?.activities || []
  const isLast = planIndex >= activities.length - 1
  const nextActivity = !isLast ? activities[planIndex + 1] : null

  function goNext() {
    navigate('/fluency', {
      replace: true,
      state: { planActivity: { planId, planIndex: planIndex + 1, activity: nextActivity } },
    })
  }

  return (
    <div className="page-stack gc fl gc-report">
      <section className="gc-hero fl-hero">
        <div className="gc-hero-copy">
          <h2>{appT('fl.activityDoneTitle')}</h2>
          {plan && <span className="fl-plan-progress">{appT('fl.planProgress', { done: planIndex + 1, total: activities.length })}</span>}
        </div>
        <div className="gc-hero-actions">
          {!isLast && nextActivity && (
            <button type="button" className="chunky-btn orange" onClick={goNext}>
              {appT('fl.nextActivity')}<ArrowRight size={17} />
            </button>
          )}
          {isLast && (
            <button type="button" className="chunky-btn orange" onClick={() => navigate(`/fluency-practice/${planId}/summary`)}>
              <BookOpenCheck size={17} />{appT('fl.viewFullSummary')}
            </button>
          )}
        </div>
      </section>

      <ProfileSummary result={result} audioUrl={audioUrl} hideRecommendations />
    </div>
  )
}
