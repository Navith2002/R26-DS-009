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

// Drops each line's embedded base64 photo (Dashboard.jsx already falls
// back to a blank thumbnail when line_img is missing) without touching
// anything else on the entry -- specifically not errorCounts/skillScores/
// total/correct/charCount, the derived fields registerGrammarRun already
// flattened onto it, which is all the Skill Profile / progress charts
// ever read. Only the History page's "view original photo" detail
// degrades.
function withoutLineImages(entry) {
  if (!entry.result || !Array.isArray(entry.result.lines)) return entry;
  return {
    ...entry,
    result: {
      ...entry.result,
      lines: entry.result.lines.map(({ line_img, ...rest }) => rest),
    },
  };
}

function withoutResult(entry) {
  const { result, ...rest } = entry;
  return rest;
}

export function saveGrammarRuns(runs) {
  const capped = runs.slice(-40);

  // Each retry below is strictly smaller than the last, and every one of
  // them keeps every run's derived stats intact -- only the embedded
  // photo data degrades. This matters because the old version's only
  // fallback (slice(-20)) shrinks *count*, which does nothing once
  // there are already fewer than 20 runs (the common case): the whole
  // write -- including today's just-finished run -- silently failed and
  // was never actually on disk, even though it kept working fine until
  // the next refresh reloaded the last entry that *did* save.
  const attempts = [
    capped,
    // Keep images for the 3 most recent runs (so a check you just did
    // still has its full detail view), drop them from older ones.
    capped.map((entry, i) => (i < capped.length - 3 ? withoutLineImages(entry) : entry)),
    // Still too big -- drop every run's images, keep every run's stats.
    capped.map(withoutLineImages),
    // Last resort -- drop the raw response entirely for every run except
    // the newest, so at least *a* full detail view survives. Every run's
    // derived stats (and therefore the Skill Profile) survive regardless
    // of which attempt below finally fits.
    capped.map((entry, i) => (i < capped.length - 1 ? withoutResult(entry) : entry)),
  ];

  for (const attempt of attempts) {
    try {
      localStorage.setItem(GRAMMAR_RUNS_KEY, JSON.stringify(attempt));
      return;
    } catch {
      // quota exceeded even at this size -- fall through to the next, smaller attempt
    }
  }
  /* give up silently -- next successful run will save normally */
}

export function loadLanguage() {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  return saved === 'tamil' || saved === 'sinhala' ? saved : 'sinhala';
}

export function saveLanguage(language) {
  localStorage.setItem(LANGUAGE_KEY, language);
}
