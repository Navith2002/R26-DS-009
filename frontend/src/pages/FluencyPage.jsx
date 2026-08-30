import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/useApp';
import StudentGate from '../components/fluencyProfiling/Studentgate';
import Dashboard from '../components/fluencyProfiling/Dashboard';
import PickerStage from '../components/fluencyProfiling/Pickerstage';
import SentenceStage from '../components/fluencyProfiling/Sentencestage';
import RecordStage from '../components/fluencyProfiling/Recordstage';
import CustomStage from '../components/fluencyProfiling/Customstage';
import ResultsStage from '../components/fluencyProfiling/Resultsstage';
import { LanguageProvider, useLanguage } from '../context/FluencyLanguageContext';
import { submitAssessment, submitCustomAssessment, fetchProfile } from '../components/fluencyProfiling/api';
import EmptyState from '../components/EmptyState';
import '../fluencyProfiling.css';

// gate -> dashboard -> picker -> (sentence -> record | custom) -> results -> dashboard
// Adapted near-verbatim from the standalone project's own App.jsx (same
// state machine, same handlers) -- the only real changes are: no
// standalone <LanguageSwitcher/> (WriteBright's own header toggle drives
// this page instead, via the sync effect below) and the .fluency-scope/
// lang wrapper (see fluencyProfiling.css) instead of a bare <main className="app">.
function FluencyPageInner() {
  const { language: appLanguage } = useApp(); // 'sinhala' | 'tamil', from WriteBright's global toggle
  const { lang, setLang, t } = useLanguage();

  // Keeps this component's own LanguageContext (used internally by every
  // stage component below) in lockstep with WriteBright's global language
  // toggle, instead of requiring a second, separate language control on
  // this page. This component supports 'en' too (its own LanguageContext
  // has 3 languages), but WriteBright's global toggle only ever offers
  // 'sinhala'/'tamil' -- so 'en' is simply never reachable here, same as
  // the grammar-check component.
  useEffect(() => {
    setLang(appLanguage === 'tamil' ? 'ta' : 'si');
  }, [appLanguage, setLang]);

  const [screen, setScreen] = useState('gate');
  const [studentId, setStudentId] = useState('');
  const [sentence, setSentence] = useState(null);

  const [result, setResult] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioUrlRef = useRef(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function updateAudioUrl(blob) {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = blob ? URL.createObjectURL(blob) : null;
    audioUrlRef.current = url;
    setAudioUrl(url);
  }

  async function handleStart(id) {
    setStudentId(id);
    setSubmitError('');

    if (!id) {
      setResult(null);
      updateAudioUrl(null);
      setProfileLoadError(false);
      setScreen('dashboard');
      return;
    }

    setScreen('dashboard');
    setProfileLoading(true);
    setProfileLoadError(false);
    try {
      const data = await fetchProfile(id);
      setResult(data);
      updateAudioUrl(null); // saved profiles don't carry audio back
      setProfileLoadError(false);
    } catch {
      setResult(null);
      setProfileLoadError(true);
    } finally {
      setProfileLoading(false);
    }
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
        studentId,
      });
      setResult(data);
      updateAudioUrl(blob);
      setScreen('results');
    } catch (err) {
      setSubmitError(err.message || 'Assessment failed. Try again.');
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
        studentId,
      });
      setResult(data);
      updateAudioUrl(audioBlob);
      setScreen('results');
    } catch (err) {
      setSubmitError(err.message || 'Assessment failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // The gate/start screen now uses WriteBright's own page styling (see
  // Studentgate.jsx) so it isn't wrapped in .app.fluency-scope -- that
  // wrapper's own background/font-family (fluencyProfiling.css) would
  // otherwise repaint it with this component's separate palette instead
  // of the app's own colors/fonts, the same fix already made for the
  // grammar-check component's upload screen. Every other stage keeps its
  // existing look for now, still wrapped as before.
  if (screen === 'gate') {
    return <StudentGate onStart={handleStart} />;
  }

  // Same fix as the gate screen, applied to Dashboard's own "welcome
  // back, no result yet" sub-state (the one actually shown right after
  // the gate) -- pulled outside .app.fluency-scope and rebuilt with
  // WriteBright's own EmptyState component (the same one Home/History use
  // for their empty states), instead of Dashboard.jsx's fluencyProfiling-
  // styled markup. The "loading" and "has a result" sub-states of this
  // same screen keep their existing look for now (still rendered via
  // <Dashboard> below, still wrapped) -- ProfileSummary's charts are a
  // bigger restyle than this pass covers.
  if (screen === 'dashboard' && !profileLoading && !result) {
    return (
      <div className="page-stack">
        <div className="section-heading" style={{ justifyContent: 'center', gap: 20 }}>
          <span style={{ color: 'var(--muted)', fontSize: 15 }}>
            {studentId ? `${t('dashboard.studentPrefix')} ${studentId}` : t('dashboard.anonymous')}
          </span>
          {/* Matches "ඇගයීම ආරම්භ කරන්න" (.primary-action)'s actual
              computed size exactly -- fontSize/padding/borderRadius/
              fontWeight, measured live rather than assumed, since
              .primary-action is itself still affected by the unscoped
              "compact" block elsewhere in styles.css. */}
          <button
            type="button"
            style={{ fontSize: 12, padding: '11px 17px', borderRadius: 30, fontWeight: 800 }}
            onClick={() => {
              setStudentId('');
              setResult(null);
              updateAudioUrl(null);
              setProfileLoadError(false);
              setScreen('gate');
            }}
          >
            {t('dashboard.switchStudent')}
          </button>
        </div>

        <EmptyState
          className="empty-state--lg"
          title={t('dashboard.welcomeBack')}
          text={profileLoadError ? t('dashboard.noProfileFound') : t('dashboard.emptyBody')}
          action={
            // .soft-btn.orange, not .primary-action -- matches the gate
            // screen's own "ඇගයීම ආරම්භ කරන්න" button (Studentgate.jsx)
            // exactly (font-size:16px, padding:12px 15px, auto width)
            // instead of .primary-action's width:100% + the unscoped
            // "compact" override elsewhere in styles.css that was
            // shrinking it to font-size:12px. Both buttons carry the same
            // label, so they should read as the same size everywhere on
            // this page.
            <button
              className="soft-btn orange"
              style={{ justifyContent: 'center' }}
              onClick={() => {
                setSubmitError('');
                setScreen('picker');
              }}
            >
              ▶ {t('dashboard.startBtn')}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <main className="app fluency-scope" lang={lang}>
      {screen === 'dashboard' && (
        <Dashboard
          studentId={studentId}
          result={result}
          audioUrl={audioUrl}
          loading={profileLoading}
          loadError={profileLoadError}
          onStart={() => {
            setSubmitError('');
            setScreen('picker');
          }}
          onSwitchStudent={() => {
            setStudentId('');
            setResult(null);
            updateAudioUrl(null);
            setProfileLoadError(false);
            setScreen('gate');
          }}
        />
      )}

      {screen === 'picker' && (
        <PickerStage
          onPickList={() => setScreen('sentence')}
          onPickCustom={() => setScreen('custom')}
          onBack={() => setScreen('dashboard')}
        />
      )}

      {screen === 'sentence' && (
        <SentenceStage onSelect={handleSentenceSelect} onBack={() => setScreen('picker')} />
      )}

      {screen === 'record' && (
        <>
          <RecordStage
            sentence={sentence}
            onSubmit={handleAudioSubmit}
            onBack={() => setScreen('sentence')}
            submitting={submitting}
          />
          {submitError && <p className="hint hint--error">{submitError}</p>}
        </>
      )}

      {screen === 'custom' && (
        <>
          <CustomStage
            onSubmit={handleCustomSubmit}
            onBack={() => setScreen('picker')}
            submitting={submitting}
          />
          {submitError && <p className="hint hint--error">{submitError}</p>}
        </>
      )}

      {screen === 'results' && result && (
        <ResultsStage
          result={result}
          audioUrl={audioUrl}
          onRecordAnother={() => setScreen('picker')}
          onBackToDashboard={() => setScreen('dashboard')}
        />
      )}
    </main>
  );
}

export default function FluencyPage() {
  return (
    <LanguageProvider>
      <FluencyPageInner />
    </LanguageProvider>
  );
}
