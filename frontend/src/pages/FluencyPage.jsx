import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/useApp';
import StudentGate from '../components/fluencyProfiling/Studentgate';
import PickerStage from '../components/fluencyProfiling/Pickerstage';
import SentenceStage from '../components/fluencyProfiling/Sentencestage';
import RecordStage from '../components/fluencyProfiling/Recordstage';
import CustomStage from '../components/fluencyProfiling/Customstage';
import ResultsStage from '../components/fluencyProfiling/Resultsstage';
import { LanguageProvider } from '../context/FluencyLanguageContext';
import { submitAssessment, submitCustomAssessment } from '../components/fluencyProfiling/api';

// gate -> picker -> (sentence -> record | custom) -> results
// Every screen uses the app's own .gc / .fl styling (bhasha.css). The
// app's header language toggle drives the language (FluencyLanguageContext).
function FluencyPageInner() {
  const { language: appLanguage, registerFluencyRun, activeChild, t: appT } = useApp();

  const [screen, setScreen] = useState('gate');
  const [sentence, setSentence] = useState(null);
  const [result, setResult] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioUrlRef = useRef(null);
  useEffect(() => () => { if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); }, []);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

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
      });
      setResult(data);
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
      });
      setResult(data);
      updateAudioUrl(audioBlob);
      await registerFluencyRun(data, activeChild.id, appLanguage);
      setScreen('results');
    } catch (err) {
      setSubmitError(appT(errorKey(err)));
    } finally {
      setSubmitting(false);
    }
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
    return <ResultsStage result={result} audioUrl={audioUrl} onRecordAnother={() => setScreen('picker')} onBackToDashboard={() => setScreen('gate')} />;
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
