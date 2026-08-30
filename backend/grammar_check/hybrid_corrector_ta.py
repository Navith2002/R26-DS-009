from __future__ import annotations

import re
import os
import glob
import csv
import unicodedata
from collections import defaultdict
from typing import Optional

from trusted_lexicon_ta import TrustedLexicon, _tamil_graphemes, RETROFLEX_PAIRS, VOWEL_PAIRS
from hybrid_corrector import HunspellDictionary  # generic .dic loader, no script-specific logic

CANDIDATE_CONFIDENCE_THRESHOLD = float(os.environ.get("SPELL_THRESHOLD_TA", "0.50"))
VERBOSE_SPELLING = os.environ.get("SPELL_VERBOSE", "1") != "0"

ZWJ = "‍"
ZWNJ = "‌"

# Tamil Unicode block
TA_BLOCK = range(0x0B80, 0x0C00)

PUNCT_CHARS = set(".,!?;:\"'()[]{}–—")
SI_DANDA = "।"   # kept only so LEADING_PUNCT_RE below can share the same
                  # character class as the Sinhala module without error;
                  # not expected to occur in Tamil text.

# No known Tamil-specific word-boundary confusions catalogued yet -- left
# empty rather than reusing Sinhala's (which are literal Sinhala words and
# would simply never match Tamil text, but populating this with guesses
# instead of real observed errors would be worse than leaving it honestly
# empty until real data justifies entries).
WORD_BOUNDARY_FIXES: list[tuple[str, str]] = []

LEADING_PUNCT_RE = re.compile(r"^([.,!?;।])\s*(.+)$")

TA_TOKEN_PATTERN = re.compile(r"([஀-௿‍‌]+|[^஀-௿‍‌]+)")


def _norm_text(text: str) -> str:
    return unicodedata.normalize("NFC", str(text or "").strip())


def edit_distance(a: str, b: str) -> int:
    """Levenshtein distance on Tamil grapheme clusters."""
    ga = _tamil_graphemes(a)
    gb = _tamil_graphemes(b)
    m, n = len(ga), len(gb)
    if m == 0:
        return n
    if n == 0:
        return m
    prev = list(range(n + 1))
    for i in range(1, m + 1):
        curr = [i] + [0] * n
        for j in range(1, n + 1):
            cost = 0 if ga[i - 1] == gb[j - 1] else 1
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        prev = curr
    return prev[n]


# ──────────────────────────────────────────────────────────────────────────────
# GROUND-TRUTH LEXICON + LABEL MAP  (built from a Tamil mistake CSV, if any)
# ──────────────────────────────────────────────────────────────────────────────
REMARK_TO_ERROR = {
    "correct": "correct",
    "punctuation": "punctuation",
    "retroflex": "retroflex",
    "vowel/diacritic": "vowel",
    "word boundary": "boundary",
    "missing word/letter": "missing",
    "missing word / letter": "missing",
}


def _resolve_gt_csv_path(csv_path: Optional[str]) -> Optional[str]:
    """
    Deliberately Tamil-specific glob patterns (not the Sinhala module's
    `*ground_truth*.csv`, which would risk matching
    Sinhala_updated_ground_truth.csv if both files sit in the same
    folder). Point gt_csv_path= explicitly once a Tamil mistake CSV
    exists -- until then this just returns None and the corpus tier
    built from it stays empty.
    """
    if csv_path and os.path.exists(csv_path):
        return csv_path

    folder = os.path.dirname(__file__)
    patterns = [
        os.path.join(folder, "Tamil_updated_ground_truth*.csv"),
        os.path.join(folder, "tamil_*ground_truth*.csv"),
    ]
    for pat in patterns:
        matches = sorted(glob.glob(pat))
        if matches:
            return matches[0]
    return csv_path


def build_gt_resources(csv_path: Optional[str]) -> tuple[set[str], dict[str, tuple[str, str, str]]]:
    vocab: set[str] = set()
    corrections: dict[str, tuple[str, str, str]] = {}
    csv_path = _resolve_gt_csv_path(csv_path)

    if not csv_path or not os.path.exists(csv_path):
        return vocab, corrections

    try:
        with open(csv_path, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                student = _norm_text(row.get("what students written", ""))
                gt = _norm_text(row.get("ground_truth", ""))
                remark_raw = _norm_text(row.get("remarks", ""))
                remark_key = remark_raw.lower()
                error_type = REMARK_TO_ERROR.get(remark_key, "other")

                if gt:
                    for token in re.findall(r"[஀-௿‍]+", gt):
                        if len(token) > 1:
                            vocab.add(token)

                if student and gt and student != gt:
                    corrections[student] = (gt, error_type, remark_raw)

        print(f"[GT Resources ta] Loaded {len(vocab):,} vocab words and {len(corrections):,} labelled corrections from {csv_path}")
    except Exception as e:
        print(f"[GT Resources ta] Could not load CSV: {e}")
    return vocab, corrections


# ──────────────────────────────────────────────────────────────────────────────
# RULE-BASED CORRECTION ENGINE
# ──────────────────────────────────────────────────────────────────────────────
class RuleEngine:
    """Deterministic rule-based fixes applied before token-level spell
    correction. Tamil has no ZWJ-conjunct issue (see trusted_lexicon_ta.py),
    so unlike the Sinhala RuleEngine there is no fix_zjw_conjuncts here."""

    @staticmethod
    def fix_leading_punctuation(text: str) -> tuple[str, list[str]]:
        notes: list[str] = []
        m = LEADING_PUNCT_RE.match(text.strip())
        if m:
            punct, rest = m.group(1), m.group(2).strip()
            text = rest + punct
            notes.append(f"Moved leading '{punct}' to end")
        return text, notes

    @staticmethod
    def fix_word_boundaries(text: str) -> tuple[str, list[str]]:
        notes: list[str] = []
        for wrong, correct in WORD_BOUNDARY_FIXES:
            if wrong in text:
                text = text.replace(wrong, correct)
                notes.append(f"Word boundary: '{wrong}'→'{correct}'")
        return text, notes

    @classmethod
    def apply_all(cls, text: str, lexicon: Optional["TrustedLexicon"] = None) -> tuple[str, list[str]]:
        all_notes: list[str] = []
        text, n = cls.fix_leading_punctuation(text)
        all_notes.extend(n)
        text, n = cls.fix_word_boundaries(text)
        all_notes.extend(n)
        return text, all_notes


# ──────────────────────────────────────────────────────────────────────────────
# TOKEN-LEVEL SPELL CORRECTOR
# ──────────────────────────────────────────────────────────────────────────────
class TokenCorrector:
    """Corrects individual Tamil tokens. Same decision path as the
    Sinhala TokenCorrector (lexicon lookup -> candidate generation ->
    multi-signal scoring against CANDIDATE_CONFIDENCE_THRESHOLD_TA), just
    gated on the Tamil Unicode block instead of Sinhala's."""

    def __init__(
        self,
        hunspell: HunspellDictionary,
        gt_vocab: set[str],
        gt_corrections: Optional[dict[str, tuple[str, str, str]]] = None,
        trusted_lexicon: Optional[TrustedLexicon] = None,
    ):
        self.hunspell = hunspell
        self.gt_vocab = gt_vocab
        self.gt_corrections = gt_corrections or {}
        self.lexicon = trusted_lexicon

    def correct_token(self, token: str, htr_confidence: Optional[float] = None) -> tuple[str, str]:
        token_norm = _norm_text(token)

        # Only try to correct Tamil tokens
        if not re.search(r"[஀-௿]", token):
            return token, ""

        if self.lexicon is None:
            raise RuntimeError(
                "TokenCorrector requires a TrustedLexicon -- pass "
                "trusted_lexicon= when constructing this."
            )

        lookup = self.lexicon.lookup(token_norm)
        if VERBOSE_SPELLING:
            print(f"[spell-ta] token='{token_norm}'  hit_count={lookup.hit_count}/4  "
                  f"(dict={lookup.in_dictionary} morph={lookup.in_morphology} "
                  f"corpus={lookup.in_corpus} freq={lookup.in_frequency})  "
                  f"status={lookup.status}")
        if lookup.hit_count >= 3:
            return token, ""

        self_score = None
        if lookup.hit_count > 0:
            self_score = self.lexicon.score_candidate(token_norm, token_norm, htr_confidence)
            if VERBOSE_SPELLING:
                print(f"[spell-ta]   self_score (evidence for keeping as-is) = {self_score:.3f}")

        unique = self.lexicon.generate_candidates(token)

        if VERBOSE_SPELLING:
            print(f"[spell-ta]   candidates: {unique}")

        if not unique:
            if VERBOSE_SPELLING:
                print(f"[spell-ta]   -> kept original (no candidates)")
            return token, "kept original (unknown, no candidates)"

        scored = sorted(
            ((self.lexicon.score_candidate(token, c, htr_confidence), c) for c in unique),
            key=lambda x: -x[0],
        )
        if VERBOSE_SPELLING:
            print("[spell-ta]   ranking:")
            for score, cand in scored:
                print(f"[spell-ta]     {cand!r:<20} score={score:.3f}")
        best_score, best = scored[0]

        if best == token:
            return token, ""

        required = CANDIDATE_CONFIDENCE_THRESHOLD if self_score is None else max(CANDIDATE_CONFIDENCE_THRESHOLD, self_score)
        if best_score < required:
            if VERBOSE_SPELLING:
                reason = f"< threshold {CANDIDATE_CONFIDENCE_THRESHOLD}" if self_score is None else \
                    f"< required {required:.3f} (threshold={CANDIDATE_CONFIDENCE_THRESHOLD}, self_score={self_score:.3f})"
                print(f"[spell-ta]   -> kept original (best '{best}' scored {best_score:.3f} {reason})")
            return token, (
                f"kept original (best candidate '{best}' scored {best_score:.2f} "
                f"below required {required:.2f})"
            )
        if VERBOSE_SPELLING:
            print(f"[spell-ta]   -> corrected: '{token}' -> '{best}'  confidence={best_score:.3f}")
        return best, f"{token}→{best} (score={best_score:.2f})"


# ──────────────────────────────────────────────────────────────────────────────
# MAIN CORRECTOR CLASS
# ──────────────────────────────────────────────────────────────────────────────
class TamilHybridCorrector:
    """
    Usage:
        corrector = TamilHybridCorrector(
            dic_path="doc/ta_IN.dic",
            aff_path="doc/ta_IN.aff",
        )
        corrected_text, note = corrector.correct("தமிழ் வாக்கியம்")
    """

    _DEFAULT_DIC = os.path.join(os.path.dirname(__file__), "doc", "ta_IN.dic")
    _DEFAULT_AFF = os.path.join(os.path.dirname(__file__), "doc", "ta_IN.aff")
    # No Tamil mistake CSV exists yet -- points at a filename that (by
    # design) won't exist, so build_gt_resources() returns empty rather
    # than erroring. Pass gt_csv_path= once one is created.
    _DEFAULT_CSV = os.path.join(os.path.dirname(__file__), "doc", "Tamil_updated_ground_truth.csv")
    # Same story for the age-appropriate corpus CSV -- pass
    # corpus_csv_path= to point at your actual file/name.
    _DEFAULT_CORPUS_CSV = os.path.join(os.path.dirname(__file__), "doc", "tamil_grade_age_appropriate_corpus.csv")

    def __init__(
        self,
        dic_path: Optional[str] = None,
        aff_path: Optional[str] = None,
        gt_csv_path: Optional[str] = None,
        corpus_csv_path: Optional[str] = None,
    ):
        dic = dic_path or self._DEFAULT_DIC
        aff = aff_path or self._DEFAULT_AFF
        gt_csv = gt_csv_path or self._DEFAULT_CSV
        corpus_csv = corpus_csv_path or self._DEFAULT_CORPUS_CSV

        self.hunspell = HunspellDictionary(dic, aff)
        self.gt_vocab, self.gt_corrections = build_gt_resources(gt_csv)
        self.lexicon = TrustedLexicon(dic_path=dic, aff_path=aff, gt_csv_path=corpus_csv)

        self.rules = RuleEngine()
        self.token_corrector = TokenCorrector(
            self.hunspell, self.gt_vocab, self.gt_corrections, trusted_lexicon=self.lexicon
        )

    def correct(self, text: str, htr_confidence: Optional[float] = None) -> tuple[str, str]:
        if not text or not text.strip():
            return text, "empty"

        raw_original = _norm_text(text)
        all_notes: list[str] = []
        text = raw_original

        text, rule_notes = self.rules.apply_all(text, self.lexicon)
        all_notes.extend(rule_notes)

        parts = TA_TOKEN_PATTERN.findall(text)
        corrected_parts: list[str] = []

        for part in parts:
            if re.search(r"[஀-௿]", part):
                fixed, note = self.token_corrector.correct_token(part, htr_confidence=htr_confidence)
                corrected_parts.append(fixed)
                if note:
                    all_notes.append(f"spell: {note}")
            else:
                corrected_parts.append(part)

        corrected = "".join(corrected_parts)

        note = "; ".join(all_notes) if all_notes else "no changes"
        return corrected, note


# ──────────────────────────────────────────────────────────────────────────────
# ERROR CLASSIFICATION  (EECF taxonomy, Tamil-adapted)
# ──────────────────────────────────────────────────────────────────────────────
ERROR_LABELS = {
    "correct":     "Correct",
    "retroflex":   "Consonant confusion",   # ண/ந/ன, ள/ழ/ல, ற/ர -- not literally "retroflex" for every pair, kept as one bucket for parity with the Sinhala dashboard's category name
    "vowel":       "Vowel sign error",
    "boundary":    "Word boundary error",
    "punctuation": "Punctuation error",
    "missing":     "Missing word / letter",
    "other":       "Other error",
}

FEEDBACK = {
    # NOTE: reuses the same "si"/"en" keys the Sinhala dashboard already
    # renders (dashboard.html never needed to change) -- "si" here holds
    # the native-script (Tamil) feedback text, not Sinhala.
    "correct":     {"si": "நீங்கள் சரியாக எழுதியுள்ளீர்கள்! மிகச் சிறப்பு!",
                    "en": "You wrote this correctly! Great work!"},
    "retroflex":   {"si": "ண/ந/ன, ள/ழ/ல, ற/ர போன்ற ஒத்த எழுத்துக்களை கவனமாகப் பாருங்கள்.",
                    "en": "Check similar Tamil letters such as ண/ந/ன, ள/ழ/ல, ற/ர."},
    "vowel":       {"si": "குறில்/நெடில் உயிர்க்குறி (ி/ீ, ு/ூ, ெ/ே, ொ/ோ) சரியாக உள்ளதா பாருங்கள்.",
                    "en": "Check short/long vowel signs (ி/ீ, ு/ூ, ெ/ே, ொ/ோ)."},
    "boundary":    {"si": "வார்த்தைகளுக்கு இடையே சரியான இடைவெளி விடவும்.",
                    "en": "Check word spacing: two words may be merged or one word may be split."},
    "punctuation": {"si": "நிறுத்தற்குறிகளை (., ?, !, ,) சரியான இடத்தில் இடவும்.",
                    "en": "Check punctuation position, especially period/comma placement."},
    "missing":     {"si": "ஓர் எழுத்து அல்லது சொல் விடுபட்டுள்ளது. வார்த்தை முழுமையாக உள்ளதா பாருங்கள்.",
                    "en": "A letter or word is missing or extra. Check whether the word is complete."},
    "other":       {"si": "இது மேற்கண்ட வகைகளுக்குள் தெளிவாக பொருந்தவில்லை. குறிப்பைப் பாருங்கள்.",
                    "en": "This does not clearly fit the main categories. See the note box."},
}

SKILL_MAP = {
    "retroflex":   "Consonant confusion — ண/ந/ன, ள/ழ/ல, ற/ர",
    "vowel":       "Vowel sign — ி/ீ, ு/ூ, ெ/ே, ொ/ோ",
    "boundary":    "Word boundary — merged/split words",
    "punctuation": "Punctuation — period/comma position",
    "missing":     "Missing word/letter",
    "other":       "Other — see note box",
    "correct":     "Correct",
}

ERROR_PROFILE_LABELS = {
    "retroflex":   "Consonant confusion — ண/ந/ன, ள/ழ/ல, ற/ர",
    "vowel":       "Vowel sign — ி/ீ, ு/ூ, ெ/ே, ொ/ோ",
    "boundary":    "Word boundary — merged/split words",
    "punctuation": "Punctuation — period/comma position",
    "missing":     "Missing word/letter",
    "other":       "Other — see note box",
}


def _remove_spaces(s: str) -> str:
    return re.sub(r"\s+", "", s)


def _remove_punctuation(s: str) -> str:
    punct = PUNCT_CHARS | {SI_DANDA}
    return "".join(ch for ch in s if ch not in punct)


def _clean_for_length(s: str) -> str:
    s = _remove_punctuation(s)
    s = _remove_spaces(s)
    return s


TAMIL_RETROFLEX_GROUPS = [
    set("ணநன"),
    set("ளழல"),
    set("றர"),
]


def _canonical_retroflex(s: str) -> str:
    mapping = {}
    for group in TAMIL_RETROFLEX_GROUPS:
        rep = sorted(group)[0]
        for ch in group:
            mapping[ch] = rep
    return "".join(mapping.get(ch, ch) for ch in s)


def _has_word_boundary_error(raw: str, corrected: str) -> bool:
    return raw != corrected and _remove_spaces(raw) == _remove_spaces(corrected)


def _has_punctuation_error(raw: str, corrected: str) -> bool:
    if raw == corrected:
        return False
    return _remove_punctuation(raw).strip() == _remove_punctuation(corrected).strip()


def _has_retroflex_error(raw: str, corrected: str) -> bool:
    if raw == corrected:
        return False
    raw_clean = _remove_spaces(_remove_punctuation(raw))
    cor_clean = _remove_spaces(_remove_punctuation(corrected))
    if len(_tamil_graphemes(raw_clean)) != len(_tamil_graphemes(cor_clean)):
        return False
    if _canonical_retroflex(raw_clean) != _canonical_retroflex(cor_clean):
        return False
    return any(sum(raw_clean.count(ch) for ch in g) == sum(cor_clean.count(ch) for ch in g)
               and any(raw_clean.count(ch) != cor_clean.count(ch) for ch in g)
               for g in TAMIL_RETROFLEX_GROUPS)


def _has_vowel_error(raw: str, corrected: str) -> bool:
    if raw == corrected:
        return False
    raw_clean = _remove_spaces(_remove_punctuation(raw))
    cor_clean = _remove_spaces(_remove_punctuation(corrected))
    return any(
        raw_clean.count(a) != cor_clean.count(a) or raw_clean.count(b) != cor_clean.count(b)
        for a, b in VOWEL_PAIRS
    )


def _has_missing_word_or_letter(raw: str, corrected: str) -> bool:
    raw_len = len(_tamil_graphemes(_clean_for_length(raw)))
    cor_len = len(_tamil_graphemes(_clean_for_length(corrected)))
    if raw_len != cor_len:
        return True
    raw_words = [w for w in re.split(r"\s+", raw.strip()) if w]
    cor_words = [w for w in re.split(r"\s+", corrected.strip()) if w]
    return len(raw_words) != len(cor_words)


def _dataset_type_from_note(note: str) -> Optional[str]:
    m = re.search(r"dataset:([a-z_]+)", str(note or "").lower())
    if not m:
        return None
    err = m.group(1)
    return err if err in ERROR_LABELS else None


def classify_correction(raw: str, corrected: str, note: str) -> dict:
    raw = _norm_text(raw)
    corrected = _norm_text(corrected)
    note = str(note or "")

    if raw == corrected:
        error_type = "correct"
        all_errors: list[str] = []
    else:
        detections: list[str] = []

        dataset_type = _dataset_type_from_note(note)
        if dataset_type and dataset_type != "correct":
            detections.append(dataset_type)

        if _has_retroflex_error(raw, corrected):
            detections.append("retroflex")
        if _has_vowel_error(raw, corrected):
            detections.append("vowel")
        if "Word boundary" in note or _has_word_boundary_error(raw, corrected):
            detections.append("boundary")
        if "Moved leading" in note or _has_punctuation_error(raw, corrected):
            detections.append("punctuation")
        if "boundary" not in detections and "punctuation" not in detections and _has_missing_word_or_letter(raw, corrected):
            detections.append("missing")

        priority = ["retroflex", "vowel", "boundary", "punctuation", "missing", "other"]
        all_errors = []
        for err in detections:
            if err not in all_errors:
                all_errors.append(err)
        error_type = next((err for err in priority if err in all_errors), "other")

    return {
        "error_type":  error_type,
        "error_label": ERROR_LABELS.get(error_type, "Other"),
        "details":     note,
        "all_errors":  all_errors,
        "skill":       SKILL_MAP.get(error_type, "Other — see note box"),
        "feedback_si": FEEDBACK[error_type]["si"],
        "feedback_en": FEEDBACK[error_type]["en"],
    }


# ──────────────────────────────────────────────────────────────────────────────
# PIPELINE INTEGRATION  (called from pipeline.py → analyze_page())
# ──────────────────────────────────────────────────────────────────────────────
_corrector: Optional[TamilHybridCorrector] = None


def _get_corrector() -> TamilHybridCorrector:
    global _corrector
    if _corrector is None:
        _corrector = TamilHybridCorrector()
    return _corrector


def process_htr_lines(lines: list[dict]) -> dict:
    """Same contract as hybrid_corrector.process_htr_lines() -- identical
    output shape (including reusing the 'si'/'en' feedback keys) so
    dashboard.html needs zero changes to render either language."""
    from collections import Counter

    corrector = _get_corrector()
    classified: list[dict] = []

    for line in lines:
        raw = line.get("raw_text", "")
        corrected, note = corrector.correct(raw, htr_confidence=line.get("confidence"))

        classification = classify_correction(raw, corrected, note)

        classified.append({
            **line,
            "corrected_text":  corrected,
            "correction_note": note,
            **classification,
        })

    total   = len(classified)
    correct = sum(1 for l in classified if l["error_type"] == "correct")
    error_counts = Counter(
        l["error_type"] for l in classified if l["error_type"] != "correct"
    )
    accuracy = round(correct / max(total, 1) * 100, 1)

    total_errors = sum(error_counts.values())
    skill_scores: dict[str, int] = {}
    for err_type, label in ERROR_PROFILE_LABELS.items():
        skill_scores[label] = round(error_counts.get(err_type, 0) / max(total_errors, 1) * 100)

    dominant_error = error_counts.most_common(1)[0][0] if error_counts else "correct"
    repeated = [err for err, cnt in error_counts.items() if cnt >= 2]

    try:
        from grammar_module_ta import build_sentences
        sentences = build_sentences(classified)
    except Exception as e:
        print(f"[hybrid_corrector_ta] grammar module skipped: {e}")
        sentences = []

    return {
        "total_lines":      total,
        "correct_lines":    correct,
        "accuracy_score":   accuracy,
        "error_counts":     dict(error_counts),
        "skill_scores":     skill_scores,
        "dominant_error":   dominant_error,
        "repeated_errors":  repeated,
        "primary_feedback": FEEDBACK[dominant_error],
        "lines":            classified,
        "sentences":        sentences,
    }
