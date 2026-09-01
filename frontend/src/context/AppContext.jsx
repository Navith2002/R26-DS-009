import { createContext, useEffect, useMemo, useState } from 'react';
import {
  loadFluencyRuns, loadGrammarRuns, loadHistory, loadLanguage, loadProfile,
  saveFluencyRuns, saveGrammarRuns, saveHistory, saveLanguage, saveProfile,
} from '../utils/storage';
import { summarizeRun } from '../components/grammarCheck/sessionHistory';
import { translate } from '../i18n/translations';

// Exported (not just used internally) so useApp.js can consume it --
// useApp lives in its own file specifically so this file exports only
// the AppProvider component. Vite's Fast Refresh requires a file to
// export ONLY components to hot-reload cleanly; mixing in a hook export
// here made it invalidate this module on nearly every edit, briefly
// desyncing the Provider from useApp's context reference (visible as a
// recoverable "useApp must be used inside AppProvider" error each time).
export const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [profile, setProfileState] = useState(() => ({
    name: 'Nethmi',
    role: 'Student',
    ...loadProfile(),
  }));
  const [language, setLanguageState] = useState(loadLanguage);
  const [history, setHistory] = useState(loadHistory);
  const [grammarRuns, setGrammarRuns] = useState(loadGrammarRuns);

  const [fluencyRuns, setFluencyRuns] = useState(loadFluencyRuns);

  const [latestResult, setLatestResult] = useState(null);
  const [latestPreview, setLatestPreview] = useState(null);

  useEffect(() => saveHistory(history), [history]);
  useEffect(() => saveGrammarRuns(grammarRuns), [grammarRuns]);

  useEffect(() => saveFluencyRuns(fluencyRuns), [fluencyRuns]);

  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => saveLanguage(language), [language]);

  function setProfile(next) {
    setProfileState((current) => ({ ...current, ...next }));
  }

  function setLanguage(next) {
    if (next === 'sinhala' || next === 'tamil') setLanguageState(next);
  }

  function registerAnalysis(result) {
    const entry = {
      id: result.analysis_id || `${Date.now()}`,
      analysis_id: result.analysis_id,
      createdAt: new Date().toISOString(),
      language: result.language || language,
      filename: result.filename || 'handwriting-image',
      analysis_status: result.analysis_status,
      input_validation: result.input_validation,
      segmentation_reliability: result.segmentation_reliability,
      quality_prediction: result.quality_prediction,
      ml_prediction: result.ml_prediction,
      overall_score: result.overall_score,
      score_source: result.score_source,
      issues: result.issues || [],
      recommendations: result.recommendations || [],
      recommendation_texts: result.recommendation_texts || [],
      output_files: result.output_files || {},
      debug: result.debug || {},
      raw_features: result.raw_features || {},
      character_level_analysis: result.character_level_analysis || {},
      explainability: result.explainability || {},
      architecture_notes: result.architecture_notes || {},
      message: result.message,
    };

    setHistory((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
    setLatestResult(result);
    return entry;
  }

  function clearHistory() {
    setHistory([]);
  }

  // Grammar-check (spelling/grammar) component: appends one run to the
  // persisted list. Two things read this same entry differently --
  // ProgressPage's skill panel wants only the small summarized shape
  // (see sessionHistory.js's summarizeRun: skillScores/total/correct/
  // errorCounts/charCount, spread at the top level so its existing
  // cumulative-stats code needs no changes), while the new history list
  // + its per-run detail page (GrammarResultPage) want the full raw
  // /analyze response (including each line's image) to redisplay the
  // complete report -- kept under `result` rather than flattened, so it
  // doesn't collide with the summarized fields. `language` is passed in
  // explicitly (not read off `result`) because the grammar-check backend
  // doesn't echo it back in the response.
  function registerGrammarRun(result, runLanguage) {
    const entry = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      language: runLanguage,
      result,
      ...summarizeRun(result),
    };
    setGrammarRuns((current) => [...current, entry]);
    return entry;
  }

  // Reading-fluency assessment (FluencyPage.jsx): appends one completed
  // assessment (not a saved-profile *load* -- fetchProfile's read of an
  // existing student's cumulative profile isn't a new run and must not
  // call this, or opening a returning student's dashboard would create a
  // duplicate history entry every time). `result` is the raw
  // submitAssessment/submitCustomAssessment response (fluency_label,
  // profile_name, cer, wer, ground_truth, transcript, weakest, ...) --
  // kept whole, same as registerGrammarRun's `result`, so a future
  // per-run detail view has everything without a second network call.
  function registerFluencyRun(result, studentId, runLanguage) {
    const entry = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      language: runLanguage,
      studentId: studentId || '',
      result,
    };
    setFluencyRuns((current) => [...current, entry]);
    return entry;
  }
  const t = (key, vars) => translate(language, key, vars);

  const value = useMemo(() => ({
    profile,
    setProfile,
    language,
    setLanguage,
    t,
    history,
    clearHistory,
    grammarRuns,
    registerGrammarRun,
    fluencyRuns,
    registerFluencyRun,
    latestResult,
    setLatestResult,
    latestPreview,
    setLatestPreview,
    registerAnalysis,

  }), [profile, language, history, grammarRuns, fluencyRuns, latestResult, latestPreview]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
