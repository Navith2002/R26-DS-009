import { ERROR_PROFILE_LABELS, ERROR_PROFILE_LABELS_TA } from './i18n';

export function summarizeRun(data) {
  const lines = data.lines || [];
  
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

  (data.sentences || []).forEach((sentence) => {
    const types = sentence.all_errors && sentence.all_errors.length
      ? sentence.all_errors
      : (sentence.error_type && sentence.error_type !== 'correct' ? [sentence.error_type] : []);
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

  
    // Skill Error Rate =
    //     cumulative errors of that skill
    //     -------------------------------- × 100
    //     cumulative runs (uploads/checks)
    //
    getCumulativeSkills(lang = 'si') {
      const labels = lang === 'ta' ? ERROR_PROFILE_LABELS_TA : ERROR_PROFILE_LABELS;

      const result = {};
      const totalRuns = this.runs.length;

      Object.entries(labels).forEach(([errType, label]) => {
        let cumErr = 0;

        // Accumulate errors of this type from all runs
        this.runs.forEach((r) => {
          cumErr += r.errorCounts[errType] || 0;
        });

        // Cumulative Skill Error Rate
        const ratio =
          totalRuns > 0
            ? (cumErr / totalRuns) * 100
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
