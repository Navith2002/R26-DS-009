import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { loadLanguage, saveLanguage } from '../utils/storage';
import { summarizeRun } from '../components/grammarCheck/sessionHistory';
import { translate } from '../i18n/translations';
import { useAuth } from '../auth/AuthContext';
import * as familyStore from '../services/familyStore';
import { partitionHistory } from '../utils/historyRecord';

export const AppContext = createContext(null);
export function AppProvider({ children }) {
  const { user } = useAuth();
  const uid = user && !user.needsPrivacyConsent ? user.uid : null;
  const [language, setLanguageState] = useState(loadLanguage);
  const [family, setFamily] = useState(null);
  const [selection, setSelection] = useState(null);
  const [recordState, setRecordState] = useState(null);
  const [latest, setLatest] = useState(null);
  const [preview, setPreview] = useState(null);
  const [retry, setRetry] = useState(0);
  const currentFamily = family?.uid === uid ? family : null;
  const childrenList = currentFamily?.children || [];
  const activeChild = childrenList.find((item) => selection?.uid === uid && item.id === selection.id) || null;
  const scope = uid && activeChild ? `${uid}/${activeChild.id}` : null;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const activeRecords = recordState?.scope === scope ? recordState : null;
  const { history, grammarRuns, fluencyRuns, readingRuns, fluencyPlans } = partitionHistory(activeRecords?.items || []);
  const t = (key, vars) => translate(language, key, vars);

  useEffect(() => {
    saveLanguage(language);
    document.documentElement.lang = language === 'tamil' ? 'ta' : 'si';
    document.title = translate(language, 'account.brand');
  }, [language]);
  useEffect(() => { setSelection(null); }, [uid]);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    setFamily({ uid, parent: null, children: [], parentLoaded: false, childrenLoaded: false });
    const update = (patch) => { if (alive) setFamily((current) => ({ ...current, ...patch, uid })); };
    const fail = (error) => update({ error });
    const stopParent = familyStore.watchParent(uid, (parent) => update({ parent, parentLoaded: true }), fail);
    const stopChildren = familyStore.watchChildren(uid, (list) => update({ children: list, childrenLoaded: true }), fail);
    return () => { alive = false; stopParent(); stopChildren(); };
  }, [uid, retry]);
  useEffect(() => {
    setLatest(null);
    setPreview(null);
    if (!scope) return;
    let alive = true;
    setRecordState({ scope, items: [], loading: true });
    const stop = familyStore.watchHistory(uid, activeChild.id,
      (items) => { if (alive) setRecordState({ scope, items, loading: false }); },
      (error) => { if (alive) setRecordState({ scope, items: [], loading: false, error }); });
    return () => { alive = false; stop(); };
  }, [scope, retry]);

  const setLanguage = useCallback((next) => {
    if (next === 'sinhala' || next === 'tamil') setLanguageState(next);
  }, []);
  function selectChild(id) {
    if (id === null) { setSelection(null); return; }
    const child = childrenList.find((item) => item.id === id);
    if (child) {
      setSelection({ uid, id });
      if (child.language) setLanguageState(child.language);
    }
  }
  async function createChild(name, details = {}) {
    if (!name.trim() || name.trim().length > 100) throw new Error('invalid-name');
    const id = await familyStore.addChild(uid, name, details);
    setSelection({ uid, id });
    if (details.language) setLanguageState(details.language);
    return id;
  }
  async function persist(kind, entry) {
    if (!scope || !activeChild || scopeRef.current !== scope) throw new Error('child-required');
    const requestScope = scope;
    let saved;
    try { saved = await familyStore.saveRun(uid, activeChild.id, kind, entry); }
    catch (error) {
      if (error.code !== 'history-too-large') error.code = 'history-save-failed';
      throw error;
    }
    if (scopeRef.current !== requestScope) throw new Error('child-changed');
    setRecordState((current) => current?.scope === requestScope
      ? { ...current, items: [...current.items.filter((item) => item.id !== saved.id), saved] }
      : current);
    return saved;
  }
  async function registerAnalysis(result) {
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

    const saved = await persist('handwriting', entry);
    setLatest({ scope, result });
    return saved;
  }
  async function registerGrammarRun(result, runLanguage) {
    return persist('grammar', {
      createdAt: new Date().toISOString(), language: runLanguage, result,
      ...summarizeRun(result),
    });
  }
  async function registerFluencyRun(result, studentId, runLanguage, planMeta) {
    return persist('fluency', {
      createdAt: new Date().toISOString(), language: runLanguage, result,
      // planMeta ties this run back to a "කියවුම් පුහුණුව" practice plan
      // (see createFluencyPlan below) -- omitted entirely for an ordinary
      // assessment, so existing callers/shapes are unaffected.
      ...(planMeta ? { planId: planMeta.planId, planIndex: planMeta.planIndex } : {}),
    });
  }
  // Freezes one assessment's 5 recommendations into an ordered practice
  // plan the student works through on the "කියවුම් පුහුණුව" page. Stored
  // as its own history `kind` so it never appears in fluencyRuns/history
  // and can't affect the other 3 components' lists.
  async function createFluencyPlan(activities, runLanguage, sourceRunId) {
    return persist('fluencyPlan', {
      createdAt: new Date().toISOString(), language: runLanguage, activities,
      sourceRunId: sourceRunId || null,
    });
  }
  async function registerReadingRun(result, runLanguage) {
    return persist('reading', { createdAt: new Date().toISOString(), language: runLanguage, result });
  }
  async function deleteHistoryEntry(id) {
    if (!scope) return;
    await familyStore.deleteRun(uid, activeChild.id, id);
    if (scopeRef.current === scope) {
      setRecordState((current) => current?.scope === scope ? { ...current, items: current.items.filter((item) => item.id !== id) } : current);
      setLatest(null);
      setPreview(null);
    }
  }
  async function clearHistory() {
    if (!scope) return;
    await familyStore.deleteAllRuns(uid, activeChild.id);
    // Listener updates reflect partial deletion too if a later batch fails.
    if (scopeRef.current === scope) { setLatest(null); setPreview(null); }
  }
  const value = {
    profile: { name: activeChild?.name || '', role: 'Student' },
    parent: currentFamily?.parent,
    childrenList, activeChild, selectChild, createChild,
    saveParent: (name) => familyStore.saveParent(uid, name),
    renameChild: (id, name) => familyStore.renameChild(uid, id, name),
    familyLoading: Boolean(uid && (!currentFamily?.parentLoaded || !currentFamily?.childrenLoaded)),
    familyError: currentFamily?.error,
    retryFamily: () => setRetry((count) => count + 1),
    scope, language, setLanguage, t,
    history, grammarRuns, fluencyRuns, readingRuns, fluencyPlans,
    historyLoading: Boolean(scope && (!activeRecords || activeRecords.loading)),
    historyError: activeRecords?.error,
    clearHistory, deleteHistoryEntry,
    registerAnalysis, registerGrammarRun, registerFluencyRun, registerReadingRun, createFluencyPlan,
    latestResult: latest?.scope === scope ? latest.result : null,
    setLatestResult: (result) => setLatest({ scope, result }),
    latestPreview: preview?.scope === scope ? preview.value : null,
    setLatestPreview: (value) => setPreview({ scope, value }),
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
