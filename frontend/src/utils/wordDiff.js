// Greedy word-level alignment between the expected (ground truth) sentence
// and the heard (Whisper) transcript. Not a true edit-distance alignment —
// same simplification the old static-HTML dashboard used — but it's enough
// to highlight substitutions, insertions and deletions inline without
// pulling in a diff library.
//
// Word EQUALITY here mirrors the Python backend's calculate_wer/
// calculate_cer exactly: punctuation is stripped and acoustically-
// confusable Sinhala letters are normalized to a canonical form before
// two words are compared, so a trailing "?" or a ළ/ල swap that the
// backend already treats as correct doesn't get highlighted as wrong
// here. Only the COMPARISON is normalized — the original word (with its
// real punctuation and spelling) is still what gets displayed.
//
// Returns an array of { text, type } tokens for the HEARD side, where type
// is one of: 'correct' | 'wrong' | 'insertion'. Deleted (missing) words are
// appended at the end with type 'deletion' so callers can still show what
// was expected but never said.

// Confusable letter groups — MUST stay in sync with CONFUSABLE_LETTER_GROUPS
// in audio_pipeline.py / main.py. Every letter after the first in a group
// maps to the group's first (canonical) letter.
const CONFUSABLE_LETTER_GROUPS = [
  'ලළ', 'ණන', 'ශෂ', 'කඛ', 'ගඝ', 'චඡ', 'ජඣ',
  'ටඨ', 'ඩඪ', 'තථ', 'දධ', 'පඵ', 'බභ',
]

const CONFUSABLE_MAP = new Map()
for (const group of CONFUSABLE_LETTER_GROUPS) {
  const canonical = group[0]
  for (const ch of group.slice(1)) {
    CONFUSABLE_MAP.set(ch, canonical)
  }
}

function normalizeConfusables(text) {
  let out = ''
  for (const ch of text) {
    out += CONFUSABLE_MAP.get(ch) || ch
  }
  return out
}

// Strips all Unicode punctuation (categories Pc/Pd/Pe/Pf/Pi/Po/Ps — the
// same "category starts with P" rule strip_punctuation() uses in Python,
// via unicodedata.category()). Sinhala combining marks (vowel signs,
// virama/hal kirima, anusvara) are a different Unicode category (M) and
// are correctly left untouched — they're part of the letters themselves.
function stripPunctuation(text) {
  return text.replace(/\p{P}/gu, '')
}

// Normalizes a word for COMPARISON only. The caller keeps using the
// original word for display.
function normalizeForComparison(word) {
  return normalizeConfusables(stripPunctuation(word))
}

export function wordDiff(reference, hypothesis) {
  const rawRef = (reference || '').trim().split(/\s+/).filter(Boolean)
  const rawHyp = (hypothesis || '').trim().split(/\s+/).filter(Boolean)

  // Drop tokens that are pure punctuation (normalize to nothing) — a
  // stray "." or "?" emitted as its own token isn't a real word and
  // shouldn't be flagged as an inserted/deleted word.
  const ref = rawRef.filter((w) => normalizeForComparison(w).length > 0)
  const hyp = rawHyp.filter((w) => normalizeForComparison(w).length > 0)

  if (ref.length === 0 && hyp.length === 0) return []

  const tokens = []
  let ri = 0
  let hi = 0

  while (ri < ref.length || hi < hyp.length) {
    if (ri >= ref.length) {
      tokens.push({ text: hyp[hi], type: 'insertion' })
      hi++
    } else if (hi >= hyp.length) {
      tokens.push({ text: ref[ri], type: 'deletion' })
      ri++
    } else if (normalizeForComparison(ref[ri]) === normalizeForComparison(hyp[hi])) {
      tokens.push({ text: hyp[hi], type: 'correct' })
      ri++
      hi++
    } else {
      tokens.push({ text: hyp[hi], type: 'wrong' })
      ri++
      hi++
    }
  }

  return tokens
}

export function werBadgeTone(wer) {
  if (wer == null || wer < 0) return null
  const pct = Math.round(wer * 100)
  if (pct <= 20) return 'good'
  if (pct <= 50) return 'warn'
  return 'bad'
}