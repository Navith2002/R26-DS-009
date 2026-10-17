import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import StudentGate from '../components/fluencyProfiling/Studentgate';
import PickerStage from '../components/fluencyProfiling/Pickerstage';
import SentenceStage from '../components/fluencyProfiling/Sentencestage';
import RecordStage from '../components/fluencyProfiling/Recordstage';
import CustomStage from '../components/fluencyProfiling/Customstage';
import ResultsStage from '../components/fluencyProfiling/Resultsstage';
import PracticeRecordStage from '../components/fluencyProfiling/PracticeRecordStage';
import PlanProgressStage from '../components/fluencyProfiling/PlanProgressStage';
import { LanguageProvider } from '../context/FluencyLanguageContext';
import { submitAssessment, submitCustomAssessment } from '../components/fluencyProfiling/api';

// gate -> picker -> (sentence -> record | custom) -> results
// Every screen uses the app's own .gc / .fl styling (bhasha.css). The
// app's header language toggle drives the language (FluencyLanguageContext).
//
// A second entry path exists for "කියවුම් පුහුණුව" (reading practice,
// see ReadingPracticePlanPage.jsx / ReadingPracticeActivityPage.jsx):
// navigating here with router state `{ planActivity: { planId,
// planIndex, activity } }` skips straight to recording that activity's
// exact practice sentence (plan-record), and submitting shows
// PlanProgressStage instead of the normal ResultsStage (plan-results).
// Visiting /fluency normally (no state) is completely unaffected.
function FluencyPageInner() {
  const { language: appLanguage, registerFluencyRun, createFluencyPlan, activeChild, t: appT } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const planActivity = location.state?.planActivity || null;
  // Matches FluencyLanguageContext.jsx's own mapping -- keeps the backend's
  // LLM feedback text in the same script as the rest of the page.
  const llmLang = appLanguage === 'tamil' ? 'ta' : 'si';

  const [screen, setScreen] = useState(planActivity ? 'plan-record' : 'gate');
  const [sentence, setSentence] = useState(null);
  const [result, setResult] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioUrlRef = useRef(null);
  useEffect(() => () => { if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); }, []);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // Guards against creating a duplicate plan if the student clicks
  // "Start Reading Practice" on more than one of the same result's 5
  // recommendation cards -- all 5 share one plan.
  const [planIdForResult, setPlanIdForResult] = useState(null);

  // FluencyPageInner stays mounted across navigations to this same
  // route (e.g. PlanProgressStage's "next activity" button), so the
  // initial useState above only handles the very first render -- this
  // re-syncs the screen whenever a NEW navigation lands here, keyed off
  // location.key (changes on every navigate() call, even to the same
  // path) so it never fires on the plain in-page setScreen() calls used
  // by the rest of this component.
  useEffect(() => {
    setScreen(planActivity ? 'plan-record' : 'gate');
    setResult(null);
    setPlanIdForResult(null);
    updateAudioUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  function updateAudioUrl(blob) {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = blob ? URL.createObjectURL(blob) : null;
    audioUrlRef.current = url;
    setAudioUrl(url);
  }

  function errorKey(err) {
    if (err.code === 'history-too-large') return 'account.historyTooLarge';
    if (err.code === 'history-save-failed') return 'account.saveError';
    return 'account.analysisError';
  }

  // "ඇගයීම ආරම්භ කරන්න" starts a fresh session: straight to choosing the
  // assessment method. Earlier results stay in History / Progress.
  function handleStart() {
    setSubmitError('');
    setResult(null);
    setPlanIdForResult(null);
    updateAudioUrl(null);
    setScreen('picker');
  }

  function handleSentenceSelect(s) {
    setSentence(s);
    setSubmitError('');
    setScreen('record');
  }

  async function handleAudioSubmit(blob) {
    setSubmitting(true);
    setSubmitError('');
    try {
      const data = await submitAssessment({
        audioBlob: blob,
        sentenceId: sentence.sentence_id,
        studentId: '', // Child history is stored privately in Firestore, not the public backend.
        lang: llmLang,
      });
      setResult(data);
      setPlanIdForResult(null);
      updateAudioUrl(blob);
      await registerFluencyRun(data, activeChild.id, appLanguage);
      setScreen('results');
    } catch (err) {
      setSubmitError(appT(errorKey(err)));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCustomSubmit({ audioBlob, groundTruth }) {
    setSubmitting(true);
    setSubmitError('');
    try {
      const data = await submitCustomAssessment({
        audioBlob,
        groundTruth,
        studentId: '', // Child history is stored privately in Firestore, not the public backend.
        lang: llmLang,
      });
      setResult(data);
      setPlanIdForResult(null);
      updateAudioUrl(audioBlob);
      await registerFluencyRun(data, activeChild.id, appLanguage);
      setScreen('results');
    } catch (err) {
      setSubmitError(appT(errorKey(err)));
    } finally {
      setSubmitting(false);
    }
  }

  // "කියවුම් පුහුණුව ආරම්භ කරන්න" on a recommendation card: freezes this
  // result's 5 recommendations into one plan (reused if the student
  // clicks a different card from the same result) and sends them to the
  // practice page's history/list.
  async function handleStartPractice() {
    if (!result?.recommendations?.length) return;
    setSubmitError('');
    try {
      let planId = planIdForResult;
      if (!planId) {
        const plan = await createFluencyPlan(result.recommendations, appLanguage);
        planId = plan.id;
        setPlanIdForResult(planId);
      }
      navigate('/fluency-practice');
    } catch {
      setSubmitError(appT('account.saveError'));
    }
  }

  // Submitting a recording for one activity inside a practice plan --
  // always a custom (free-text) assessment, since the activity's
  // practice_sentence isn't one of the 68 bank sentences.
  async function handlePlanSubmit(audioBlob) {
    setSubmitting(true);
    setSubmitError('');
    try {
      const data = await submitCustomAssessment({
        audioBlob,
        groundTruth: planActivity.activity.practice_sentence,
        studentId: '',
        lang: llmLang,
      });
      setResult(data);
      updateAudioUrl(audioBlob);
      await registerFluencyRun(data, activeChild.id, appLanguage, {
        planId: planActivity.planId,
        planIndex: planActivity.planIndex,
      });
      setScreen('plan-results');
    } catch (err) {
      setSubmitError(appT(errorKey(err)));
    } finally {
      setSubmitting(false);
    }
  }

  if (screen === 'plan-record' && planActivity) {
    return (
      <PracticeRecordStage
        activity={planActivity.activity}
        onSubmit={handlePlanSubmit}
        onBack={() => navigate(`/fluency-practice/${planActivity.planId}`)}
        submitting={submitting}
        submitError={submitError}
      />
    );
  }
  if (screen === 'plan-results' && result && planActivity) {
    return (
      <PlanProgressStage
        result={result}
        audioUrl={audioUrl}
        planId={planActivity.planId}
        planIndex={planActivity.planIndex}
      />
    );
  }
  if (screen === 'picker') {
    return <PickerStage onPickList={() => setScreen('sentence')} onPickCustom={() => setScreen('custom')} onBack={() => setScreen('gate')} />;
  }
  if (screen === 'sentence') {
    return <SentenceStage onSelect={handleSentenceSelect} onBack={() => setScreen('picker')} />;
  }
  if (screen === 'record' && sentence) {
    return <RecordStage sentence={sentence} onSubmit={handleAudioSubmit} onBack={() => setScreen('sentence')} submitting={submitting} submitError={submitError} />;
  }
  if (screen === 'custom') {
    return <CustomStage onSubmit={handleCustomSubmit} onBack={() => setScreen('picker')} submitting={submitting} submitError={submitError} />;
  }
  if (screen === 'results' && result) {
    return <ResultsStage result={result} audioUrl={audioUrl} onRecordAnother={() => setScreen('picker')} onBackToDashboard={() => setScreen('gate')} onStartPractice={handleStartPractice} />;
  }
  return <StudentGate onStart={handleStart} />;
}

export default function FluencyPage() {
  return (
    <LanguageProvider>
      <FluencyPageInner />
    </LanguageProvider>
  );
}
