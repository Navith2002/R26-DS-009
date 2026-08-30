import { ERROR_PROFILE_LABELS } from './i18n';

// Shown when the backend isn't reachable, so the UI can still be exercised
// end-to-end without a running FastAPI server. Ported verbatim from the
// original dashboard.html's getDemoData().
export function getDemoData() {
  return {
    total_lines: 7, correct_lines: 2, accuracy_score: 28.6,
    dominant_error: 'vowel',
    primary_feedback: { si: 'කෙටි ස්වරය (ි) සහ දිගු ස්වරය (ී) — දිග නිවැරදිව ලියන්න.' },
    error_counts: { vowel: 3, retroflex: 1, zwj: 1, missing: 1 },
    skill_scores: {
      [ERROR_PROFILE_LABELS.vowel]: 50, [ERROR_PROFILE_LABELS.retroflex]: 17,
      [ERROR_PROFILE_LABELS.zwj]: 17, [ERROR_PROFILE_LABELS.missing]: 17,
      [ERROR_PROFILE_LABELS.boundary]: 0, [ERROR_PROFILE_LABELS.punctuation]: 0,
      [ERROR_PROFILE_LABELS.other]: 0,
    },
    lines: [
      { line_idx: 0, raw_text: 'මම පාසලට යමි', corrected_text: 'මම පාසලට යමි', error_type: 'correct', feedback_si: 'ඔබ නිවැරදිව ලිවීය! හරිම හොඳයි!', correction_note: 'no changes', line_img: null },
      { line_idx: 1, raw_text: 'ලමා කාලය', corrected_text: 'ළමා කාලය', error_type: 'retroflex', feedback_si: 'ල සහ ළ — අකුරු හැඩය හොඳින් බලන්න.', correction_note: 'ල→ළ', line_img: null },
      { line_idx: 2, raw_text: 'සිනිදු ඇඳ', corrected_text: 'සීනිදු ඇඳ', error_type: 'vowel', feedback_si: 'කෙටි/දිගු ස්වර ලකුණු නැවත බලන්න.', correction_note: 'spell: සිනිදු→සීනිදු', line_img: null },
      { line_idx: 3, raw_text: 'ක්රීඩා', corrected_text: 'ක්‍රීඩා', error_type: 'zwj', feedback_si: 'ක්‍ර වැනි සංයෝග අකුරු විශේෂ ලකුණක් සමඟ ලියන්න.', correction_note: 'ZWJ inserted: ක්ර→ක්‍ර', line_img: null },
      { line_idx: 4, raw_text: 'ජල සම්පත', corrected_text: 'ජල සම්පත', error_type: 'correct', feedback_si: '', correction_note: 'no changes', line_img: null },
      { line_idx: 5, raw_text: 'රෑ ගෙදරට', corrected_text: 'රෑ ගෙදරට', error_type: 'vowel', feedback_si: 'ස්වර දිග නිවැරදිව ලියන්න.', correction_note: 'vowel sign', line_img: null },
      { line_idx: 6, raw_text: '. ආයුබෝවන්', corrected_text: 'ආයුබෝවන්.', error_type: 'punctuation', feedback_si: 'විරාම ලකුණු වාක්‍ය අග දමන්න, මුලට නොවේ.', correction_note: "Moved leading '.' to end", line_img: null },
    ],
    sentences: [
      { text: 'මම පාසලට ගොස් මිතුරන් සමඟ ක්‍රීඩා කලෙමි.', is_combined: true, word_count: 6, grammar_note: '' },
      { text: 'එය ඉතා සතුටුදායක දිනයක් විය.', is_combined: false, word_count: 5, grammar_note: '' },
      { text: 'ආයුබෝවන්', is_combined: false, word_count: 1, grammar_note: '' },
    ],
  };
}
