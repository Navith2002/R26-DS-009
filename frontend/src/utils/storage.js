const HISTORY_KEY = 'writebright_history_v1';
const PROFILE_KEY = 'writebright_profile_v1';
const LANGUAGE_KEY = 'writebright_language_v1';
const GRAMMAR_RUNS_KEY = 'writebright_grammar_runs_v1';

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 60)));
}

export function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

// Persists the grammar-check component's full run history (raw /analyze
// response per run, each line including its own base64 image -- see
// AppContext's registerGrammarRun) so both the Progress page's skill
// profile and the History page's per-run detail view work without a
// second network round-trip. Capped much tighter than saveHistory's 60
// (below) since each entry embeds images rather than just referencing
// output files by path, so it's a much heavier payload per run against
// the same ~5-10MB localStorage-per-origin budget; wrapped in try/catch
// since that quota is a real risk here, not just a formality.
export function loadGrammarRuns() {
  try {
    return JSON.parse(localStorage.getItem(GRAMMAR_RUNS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveGrammarRuns(runs) {
  try {
    localStorage.setItem(GRAMMAR_RUNS_KEY, JSON.stringify(runs.slice(-40)));
  } catch {
    // Quota exceeded (embedded images add up) -- drop the oldest half and
    // retry once rather than losing today's run entirely.
    try {
      localStorage.setItem(GRAMMAR_RUNS_KEY, JSON.stringify(runs.slice(-20)));
    } catch {
      /* give up silently -- next successful run will save normally */
    }
  }
}

export function loadLanguage() {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  return saved === 'tamil' || saved === 'sinhala' ? saved : 'sinhala';
}

export function saveLanguage(language) {
  localStorage.setItem(LANGUAGE_KEY, language);
}
