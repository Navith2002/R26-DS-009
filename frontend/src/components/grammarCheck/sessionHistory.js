import { ERROR_PROFILE_LABELS, ERROR_PROFILE_LABELS_TA } from './i18n';

// Cumulative session skill tracking, ported from dashboard.html's
// `sessionHistory` object. Kept as a plain mutable object (held in a
// useRef in App.jsx) rather than React state, since it needs to silently
// accumulate across every /analyze call in the browser session -- exactly
// like the original vanilla-JS version.
// Reduces one /analyze response down to the small plain-object shape a
// run contributes to cumulative stats -- shared by the in-page
// sessionHistory below and by AppContext's persisted grammarRuns (see
// registerGrammarRun), so both draw on exactly one computation instead of
// two copies of the same error-counting logic.
export function summarizeRun(data) {
  const lines = data.lines || [];
  // Count every error category detected for each line. If a line has
  // both retroflex and missing-letter errors, it contributes to BOTH
  // categories.
  const errorCounts = {};
  let charCount = 0;
  lines.forEach((line) => {
    const text = line.corrected_text || line.raw_text || '';
    charCount += Array.from(text).length; // rough grapheme count
    const types = line.all_errors && line.all_errors.length
      ? line.all_errors
      : (line.error_type && line.error_type !== 'correct' ? [line.error_type] : []);
    types.forEach((type) => {
      errorCounts[type] = (errorCounts[type] || 0) + 1;
    });
  });

  return {
    skillScores: data.skill_scores || {},
    total: data.total_lines || lines.length,
    correct: data.correct_lines || 0,
    errorCounts,
    charCount,
  };
}

export function createSessionHistory() {
  return {
    runs: [], // each run: { skillScores, total, correct, errorCounts, charCount }

    addRun(data) {
      this.runs.push(summarizeRun(data));
    },

   // Calculates cumulative skill difficulty across all uploads
    // in the current browser session.
    //
    // Formula:
    //
    // Skill Error Rate =
    //     cumulative errors of that skill
    //     -------------------------------- × 100
    //     cumulative characters analyzed
    //
    // This means:
    // - starts from 0 when there are no errors
    // - increases when the same type of error occurs repeatedly
    // - decreases as the child writes more characters without that error
    // - does not use arbitrary smoothing constants or weights
    getCumulativeSkills(lang = 'si') {
      const labels = lang === 'ta' ? ERROR_PROFILE_LABELS_TA : ERROR_PROFILE_LABELS;

      const result = {};

      Object.entries(labels).forEach(([errType, label]) => {
        let cumErr = 0;
        let cumChars = 0;

         // Accumulate errors and characters from all runs
        this.runs.forEach((r) => {
          cumErr += r.errorCounts[errType] || 0;
          cumChars += r.charCount || 0;
        });


        // Cumulative Skill Error Rate
      const ratio =
        cumChars > 0
          ? (cumErr / cumChars) * 100
          : 0;

    result[label] = Math.min(100, Math.round(ratio));
  });
      return result;
    },

    getCumulativeErrors() {
      const merged = {};
      this.runs.forEach((r) => {
        Object.entries(r.errorCounts).forEach(([k, v]) => {
          merged[k] = (merged[k] || 0) + v;
        });
      });
      return merged;
    },

    getTotals() {
      return {
        totalRuns: this.runs.length,
        totalLines: this.runs.reduce((s, r) => s + r.total, 0),
        totalCorrect: this.runs.reduce((s, r) => s + r.correct, 0),
      };
    },
  };
}
