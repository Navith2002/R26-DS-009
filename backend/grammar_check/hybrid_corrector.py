from __future__ import annotations

import re
import os
import glob
import csv
import unicodedata
from collections import defaultdict
from typing import Optional

from trusted_lexicon import TrustedLexicon, _sinhala_graphemes

CANDIDATE_CONFIDENCE_THRESHOLD = float(os.environ.get("SPELL_THRESHOLD", "0.50"))

# Print per-token candidate generation / ranking / confidence to the
# terminal (see TokenCorrector.correct_token()). Set False to quiet it.
VERBOSE_SPELLING = os.environ.get("SPELL_VERBOSE", "1") != "0"

# UNICODE CONSTANTS

ZWJ = "\u200d"          # Zero Width Joiner
ZWNJ = "\u200c"         # Zero Width Non-Joiner (sometimes mistakenly used)

# Sinhala Unicode block
SI_BLOCK = range(0x0D80, 0x0E00)

# Punctuation characters (Sinhala full stop + common)
SI_DANDA = "।"
PUNCT_CHARS = set(".,!?;:\"'()[]{}–—")

RETROFLEX_PAIRS: list[tuple[str, str]] = [
    ("ල", "ළ"),
    ("ළ", "ල"),
    ("න", "ණ"),
    ("ණ", "න"),
    ("ත", "ට"),
    ("ට", "ත"),
    ("ද", "ඩ"),
    ("ඩ", "ද"),
    ("ශ", "ෂ"),
    ("ෂ", "ශ"),
    ("ත", "ථ"),
    ("ථ", "ත"),
    ("ල", "ළු"),
    ("ළු", "ල"),   # ල → ළු (with u-vowel sign)
]

VOWEL_PAIRS: list[tuple[str, str]] = [
    ("\u0DD2", "\u0DD3"),   # ි  ↔  ී
    ("\u0DD4", "\u0DD6"),   # ු  ↔  ූ
    ("\u0DD0", "\u0DD1"),   # ැ (e-short) ↔ ේ
    ("\u0DCF", "\u0DD0"),   # ා ↔ ෑ (rare)
    ("\u0DC0", "\u0DCA"),   # ව ↔ ් (virama)
]

CONJUNCT_PATTERNS: list[tuple[str, str]] = [
    # (wrong/missing ZWJ form, correct form with ZWJ)
    # Use explicit Unicode escapes where ambiguity is common.
    ("ක්රි",  "ක්‍රි"),    # ක්රී → ක්‍රී
    ("ක්ර",   "ක්‍ර"),
    ("ශ්ර",   "ශ්‍ර"),
    ("ශ්රී",  "ශ්‍රී"),
    ("ත්ව",   "ත්‍ව"),
    ("ස්ව",   "ස්‍ව"),
    ("ද්ව",   "ද්‍ව"),
    ("ප්ර",   "ප්‍ර"),
    ("බ්ර",   "බ්‍ර"),
    ("ග්ර",   "ග්‍ර"),
    ("ට්ර",   "ට්‍ර"),
    ("ද්ර",   "ද්‍ර"),
    ("න්ද",   "න්‍ද"),
    ("ම්ල",   "ම්‍ල"),
    ("ව්ය",   "ව්‍ය"),
    ("ක්ව",   "ක්‍ව"),
    ("ත්ය",   "ත්‍ය"),     # ත්යාගය → ත්‍යාගය
    ("ද්ය",   "ද්‍ය"),
    ("න්ය",   "න්‍ය"),
    ("ශ්ය",   "ශ්‍ය"),
    ("ක්ය",   "ක්‍ය"),
    ("ප්රි",   "ප්‍රි"),
    ("ෂ්ය",   "ෂ්‍ය"),
    ("ක්රී",   "ක්‍රී"),
]

WORD_BOUNDARY_FIXES: list[tuple[str, str]] = [
    ("වෙස්මුහුණු",   "වෙස් මුහුණු"),
    ("කිසේවත්",      "කිසේ වත්"),
    ("ඇවිද්දාය",     "ඇවිද්දා ය"),
    ("ඇවිද්දාය\"",   "ඇවිද්දා ය\""),
]

LEADING_PUNCT_RE = re.compile(r"^([.,!?;।])\s*(.+)$")
SENTENCE_END_RE = re.compile(r"([^.,!?;।\s])$")

# _sinhala_graphemes() used to be defined here AND separately (but
# identically) in trusted_lexicon.py -- two copies of the same logic
# that could silently drift apart if only one got edited. Now imported
# from trusted_lexicon.py as the single source of truth (see import at
# top of this file).


def edit_distance(a: str, b: str) -> int:
    """Levenshtein distance on grapheme clusters (not raw codepoints)."""
    ga = _sinhala_graphemes(a)
    gb = _sinhala_graphemes(b)
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
# PURE-PYTHON HUNSPELL .DIC LOADER
# (No C library; reads word list directly from si_LK.dic)
# ──────────────────────────────────────────────────────────────────────────────
class HunspellDictionary:
    """
    Loads a Hunspell .dic word list. This class is a DICTIONARY VOCABULARY
    SOURCE ONLY -- one of TrustedLexicon's `dictionary` tier inputs -- not
    a morphology engine. It used to also parse the .aff file's SFX rules
    to generate additional inflected forms, but that approach is retired:
    without also implementing Hunspell's `condition` field (out of scope),
    naive strip+add expansion generated ~1.49M mostly-invalid forms (see
    git history / trusted_lexicon.py's module docstring for the specifics).
    Morphology now belongs entirely to TrustedLexicon, sourced from real,
    corpus-attested inflected forms (verified_word_list_lemma_analysis.txt)
    instead of guessed ones -- see TrustedLexicon._load_lemma_morphology().

    The .dic format is:
        <word_count>
        word[/flags]
        word[/flags]
        ...
    We ignore flags for lookup.

    `aff_path` is still accepted for call-site compatibility but is no
    longer read for anything.
    """

    def __init__(self, dic_path: Optional[str] = None, aff_path: Optional[str] = None):
        self.words: set[str] = set()
        self._by_length: dict[int, list[str]] = defaultdict(list)
        self._loaded = False

        if dic_path and os.path.exists(dic_path):
            self._load_dic(dic_path)
            self._build_index()
            print(f"[HunspellDictionary] Loaded {len(self.words):,} words from {dic_path}")
            self._loaded = True
        else:
            if dic_path:
                print(f"[HunspellDictionary] ⚠  .dic not found at: {dic_path}")
            print("[HunspellDictionary] Running without Hunspell (ground-truth lexicon only)")

    def _load_dic(self, path: str) -> None:
        """Parse the .dic word list."""
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
        except Exception as e:
            print(f"[HunspellDictionary] Cannot read .dic: {e}")
            return

        for line in lines[1:]:           # skip the count line
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            word = line.split("/")[0].strip()   # strip affix flags
            if word:
                self.words.add(word)

    def _build_index(self) -> None:
        for w in self.words:
            self._by_length[len(w)].append(w)

    def is_known(self, word: str) -> bool:
        return word in self.words

    def suggest(self, word: str, max_dist: int = 2, max_results: int = 5) -> list[str]:
        """
        Return up to max_results candidates within edit distance max_dist.
        Searches length-bucket neighbours to avoid O(N) full scan.
        """
        if not self._loaded:
            return []
        target_len = len(_sinhala_graphemes(word))
        candidates: list[tuple[int, str]] = []

        # Check words within ±max_dist length
        for delta in range(-max_dist, max_dist + 1):
            bucket_key = target_len + delta
            # _by_length is keyed by codepoint length; approximate with grapheme len
            for clen in range(max(1, bucket_key - 2), bucket_key + 3):
                for candidate in self._by_length.get(clen, []):
                    dist = edit_distance(word, candidate)
                    if dist <= max_dist:
                        candidates.append((dist, candidate))

        candidates.sort(key=lambda x: x[0])
        return [c for _, c in candidates[:max_results]]

    def add_words(self, words: list[str]) -> None:
        """Extend dictionary with domain-specific words."""
        for w in words:
            if w not in self.words:
                self.words.add(w)
                self._by_length[len(w)].append(w)

# GROUND-TRUTH LEXICON + LABEL MAP  (built from your CSV)

REMARK_TO_ERROR = {
    "correct": "correct",
    "punctuation": "punctuation",
    "retroflex": "retroflex",
    "vowel/diacritic": "vowel",
    "word boundary": "boundary",
    "zwj missing": "zwj",
    "missing word/letter": "missing",
    "missing word / letter": "missing",
}


def _norm_text(text: str) -> str:
    """Normalize Sinhala strings for reliable dictionary and dataset lookup."""
    return unicodedata.normalize("NFC", str(text or "").strip())


def _resolve_gt_csv_path(csv_path: Optional[str]) -> Optional[str]:
   
    if csv_path and os.path.exists(csv_path):
        return csv_path

    folder = os.path.dirname(__file__)
    patterns = [
        os.path.join(folder, "Sinhala_updated_ground_truth*.csv"),
        os.path.join(folder, "*ground_truth*.csv"),
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
                    for token in re.findall(r"[඀-෿‍]+", gt):
                        if len(token) > 1:
                            vocab.add(token)

                # Store exact whole-line corrections and exact single-token corrections.
                if student and gt and student != gt:
                    corrections[student] = (gt, error_type, remark_raw)

        print(f"[GT Resources] Loaded {len(vocab):,} vocab words and {len(corrections):,} labelled corrections from {csv_path}")
    except Exception as e:
        print(f"[GT Resources] Could not load CSV: {e}")
    return vocab, corrections


# Backwards-compatible helper for old code/tests.
def build_gt_lexicon(csv_path: Optional[str]) -> set[str]:
    vocab, _ = build_gt_resources(csv_path)
    return vocab

# RULE-BASED CORRECTION ENGINE

class RuleEngine:
    """Applies deterministic rule-based fixes before dictionary lookup."""

    @staticmethod
    def fix_zjw_conjuncts(text: str, lexicon: Optional["TrustedLexicon"] = None) -> tuple[str, list[str]]:
        """
        Insert missing ZWJ in known conjunct patterns.

        Lexicon-gated per WORD (not a blind whole-line replace) when a
        lexicon is available: several CONJUNCT_PATTERNS entries (e.g.
        "න්ද"->"න්‍ද", "ත්ව"->"ත්‍ව") are NOT universally correct -- the
        same letter sequence legitimately appears both with and without
        the ZWJ depending on the specific word. Confirmed empirically via
        evaluate_holdout.py's false-correction report: the old blind
        version "corrected" already-correct words like ඉන්දීය and
        සුන්දරත්වයක් into wrong ZWJ'd forms, because it had no way to
        know those particular occurrences didn't need it.

        Fix: if the ORIGINAL word is already a recognised valid word
        (hit in any TrustedLexicon tier), leave it alone -- that's
        direct evidence it didn't need fixing, overriding what a purely
        pattern-based rule would otherwise do. Only apply the pattern
        swap to words the lexicon doesn't already recognise, where the
        ZWJ'd guess is much more likely to actually be the fix needed.
        """
        notes: list[str] = []

        if lexicon is None:
            # No lexicon available -- old blind whole-line behavior,
            # kept only so this method still works standalone/in tests.
            for wrong, correct in CONJUNCT_PATTERNS:
                if wrong in text and correct not in text:
                    text = text.replace(wrong, correct)
                    notes.append(f"ZWJ inserted: {wrong}→{correct}")
            return text, notes

        token_pattern = re.compile(r"([඀-෿‍‌]+|[^඀-෿‍‌]+)")
        out_parts: list[str] = []
        for part in token_pattern.findall(text):
            if not re.search(r"[඀-෿]", part):
                out_parts.append(part)
                continue
            if lexicon.lookup(part).hit_count > 0:
                # Already a recognised word -- a generic pattern must not
                # override direct lexicon evidence that it's already fine.
                out_parts.append(part)
                continue
            new_word = part
            for wrong, correct in CONJUNCT_PATTERNS:
                if wrong in new_word and correct not in new_word:
                    new_word = new_word.replace(wrong, correct)
                    notes.append(f"ZWJ inserted: {wrong}→{correct}")
            out_parts.append(new_word)
        return "".join(out_parts), notes

    @staticmethod
    def fix_leading_punctuation(text: str) -> tuple[str, list[str]]:
        """Move leading punctuation marks to end of sentence."""
        notes: list[str] = []
        m = LEADING_PUNCT_RE.match(text.strip())
        if m:
            punct, rest = m.group(1), m.group(2).strip()
            text = rest + punct
            notes.append(f"Moved leading '{punct}' to end")
        return text, notes

    @staticmethod
    def fix_word_boundaries(text: str) -> tuple[str, list[str]]:
        """Apply known word-boundary fixes."""
        notes: list[str] = []
        for wrong, correct in WORD_BOUNDARY_FIXES:
            if wrong in text:
                text = text.replace(wrong, correct)
                notes.append(f"Word boundary: '{wrong}'→'{correct}'")
        return text, notes

    @classmethod
    def apply_all(cls, text: str, lexicon: Optional["TrustedLexicon"] = None) -> tuple[str, list[str]]:
        """
        `lexicon` param kept for signature compatibility but no longer
        used here -- fix_zjw_conjuncts() is no longer called automatically.
        ZWJ insertion/removal moved to TrustedLexicon.generate_candidates()
        (per-token candidate generation, scored + threshold-gated like
        every other candidate) instead of being a blind or even lexicon-
        gated line-level rule. See CONJUNCT_PATTERNS' docstring in
        trusted_lexicon.py for why: even the lexicon-gated version here
        could still blindly accept whichever pattern matched an unknown
        word, with no check that the RESULT was actually better evidence
        than what was already there.
        """
        all_notes: list[str] = []
        text, n = cls.fix_leading_punctuation(text)
        all_notes.extend(n)
        text, n = cls.fix_word_boundaries(text)
        all_notes.extend(n)
        return text, all_notes
 
# TOKEN-LEVEL SPELL CORRECTOR

class TokenCorrector:
    """
    Corrects individual Sinhala tokens using:
      1. Hunspell dictionary (if loaded)
      2. Ground-truth lexicon
      3. Retroflex / vowel candidate generation + edit distance ranking
    """

    def __init__(
        self,
        hunspell: HunspellDictionary,
        gt_vocab: set[str],
        gt_corrections: Optional[dict[str, tuple[str, str, str]]] = None,
        trusted_lexicon: Optional[TrustedLexicon] = None,
    ):
        """
        `trusted_lexicon` is REQUIRED for real correction — hunspell is
        kept only for its `.words` (fed into the GT-corrections lookup
        path) and is no longer an independent candidate source. There
        used to be a "no TrustedLexicon passed" fallback path here that
        used hunspell.suggest() + a simpler edit-distance ranking; it was
        removed so there is exactly ONE spelling-decision path, not two
        that could silently disagree. If `trusted_lexicon` is None,
        correct_token() raises rather than falling back.
        """
        self.hunspell = hunspell
        self.gt_vocab = gt_vocab
        self.gt_corrections = gt_corrections or {}
        self.lexicon = trusted_lexicon

    def correct_token(self, token: str, htr_confidence: Optional[float] = None) -> tuple[str, str]:
        """
        Returns (corrected_token, note).
        If no correction found, or no candidate is confident enough,
        returns the original token unchanged -- "unknown" is NOT treated
        as "wrong" (see trusted_lexicon.py's module docstring).

        htr_confidence: optional, the OCR model's own per-line confidence
        (pipeline.py's recognize_line() return value), passed through so
        candidate scoring can weigh corrections more heavily on lines the
        recognizer itself was unsure about.
        """
        token_norm = _norm_text(token)

        # NOTE: there used to be an exact labelled-token lookup here,
        # returning a memorized ground-truth correction directly when
        # token_norm matched a labelled row. Removed for the same reason
        # as the whole-line shortcut in correct() -- ground truth may not
        # be used to PRODUCE any correction, only to evaluate/classify one
        # produced some other way. self.gt_corrections is still stored on
        # this object but is no longer read anywhere in this method.

        # Only try to correct Sinhala tokens
        if not re.search(r"[\u0D80-\u0DFF]", token):
            return token, ""

        if self.lexicon is None:
            raise RuntimeError(
                "TokenCorrector requires a TrustedLexicon -- the old "
                "no-lexicon fallback path (hunspell.suggest() + plain "
                "edit-distance ranking) was removed so there is exactly "
                "ONE spelling-decision path, not two that could silently "
                "disagree. Pass trusted_lexicon= when constructing this."
            )

        # Error detection layer: confidence HIERARCHY over hit_count, not
        # a flat "any hit at all -> always correct" check.
        #   4/4, 3/4 hits -- very strong / strong valid: skip investigation
        #                    entirely, cheap and safe.
        #   2/4, 1/4 hits -- probably valid / uncertain: still investigated,
        #                    but a replacement candidate must beat THIS
        #                    TOKEN'S OWN score (self_score below), not just
        #                    the fixed threshold -- weak-but-real evidence
        #                    for the original should count for something,
        #                    not be discarded the moment any candidate
        #                    clears a flat bar.
        #   0/4 hits      -- suspicious_unknown: no lexicon evidence for the
        #                    original at all, so only the fixed threshold
        #                    applies (self_score is meaningless here).
        lookup = self.lexicon.lookup(token_norm)
        if VERBOSE_SPELLING:
            print(f"[spell] token='{token_norm}'  hit_count={lookup.hit_count}/4  "
                  f"(dict={lookup.in_dictionary} morph={lookup.in_morphology} "
                  f"corpus={lookup.in_corpus} freq={lookup.in_frequency})  "
                  f"status={lookup.status}")
        if lookup.hit_count >= 3:
            return token, ""

        self_score = None
        if lookup.hit_count > 0:
            self_score = self.lexicon.score_candidate(token_norm, token_norm, htr_confidence)
            if VERBOSE_SPELLING:
                print(f"[spell]   self_score (evidence for keeping as-is) = {self_score:.3f}")

        # Candidate generation: SymSpell index over dictionary | morphology
        # | frequency (~320k real words) + confusion-pair and ZWJ rule
        # candidates. hunspell.suggest() / GT-vocab close-matches are NOT
        # used here per project decision -- generation draws only from the
        # full real vocabulary via TrustedLexicon, not the small hunspell/
        # GT sets.
        unique = self.lexicon.generate_candidates(token)

        if VERBOSE_SPELLING:
            print(f"[spell]   candidates: {unique}")

        if not unique:
            if VERBOSE_SPELLING:
                print(f"[spell]   -> kept original (no candidates)")
            return token, "kept original (unknown, no candidates)"

        # Candidate validation: multi-signal score + confidence gate.
        scored = sorted(
            ((self.lexicon.score_candidate(token, c, htr_confidence), c) for c in unique),
            key=lambda x: -x[0],
        )
        if VERBOSE_SPELLING:
            print("[spell]   ranking:")
            for score, cand in scored:
                print(f"[spell]     {cand!r:<20} score={score:.3f}")
        best_score, best = scored[0]

        if best == token:
            return token, ""

        required = CANDIDATE_CONFIDENCE_THRESHOLD if self_score is None else max(CANDIDATE_CONFIDENCE_THRESHOLD, self_score)
        if best_score < required:
            if VERBOSE_SPELLING:
                reason = f"< threshold {CANDIDATE_CONFIDENCE_THRESHOLD}" if self_score is None else \
                    f"< required {required:.3f} (threshold={CANDIDATE_CONFIDENCE_THRESHOLD}, self_score={self_score:.3f})"
                print(f"[spell]   -> kept original (best '{best}' scored {best_score:.3f} {reason})")
            return token, (
                f"kept original (best candidate '{best}' scored {best_score:.2f} "
                f"below required {required:.2f})"
            )
        if VERBOSE_SPELLING:
            print(f"[spell]   -> corrected: '{token}' -> '{best}'  confidence={best_score:.3f}")
        return best, f"{token}→{best} (score={best_score:.2f})"


# MAIN CORRECTOR CLASS

class SinhalaHybridCorrector:
    """
    Top-level corrector. Combines:
      • Rule engine (ZWJ, punctuation, word boundary)
      • Token-level spell correction (Hunspell + GT lexicon + rule candidates)

    Usage:
        corrector = SinhalaHybridCorrector(
            dic_path="doc/si_LK.dic",
            aff_path="doc/si_LK.aff",
            gt_csv_path="doc/Sinhala_updated_ground_truth.csv"
        )
        corrected_text, note = corrector.correct("ලකුනු යොදා වාක්‍ය")
    """

    # Default paths (in the doc/ subfolder next to this script)
    _DEFAULT_DIC = os.path.join(os.path.dirname(__file__), "doc", "si_LK.dic")
    _DEFAULT_AFF = os.path.join(os.path.dirname(__file__), "doc", "si_LK.aff")
    _DEFAULT_CSV = os.path.join(os.path.dirname(__file__), "doc",
                                "Sinhala_updated_ground_truth.csv")
    _DEFAULT_CORPUS_CSV = os.path.join(os.path.dirname(__file__), "doc",
                                       "sinhala_grade5_age_appropriate_corpus.csv")

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
        # Dataset B (gt_csv): "what students written" / "remarks" /
        # "ground_truth" columns -- this is what build_gt_resources() needs.
        # Dataset A (corpus_csv) only has a "text" column; calling
        # build_gt_resources(corpus_csv) would silently return empty
        # vocab/corrections since none of the expected columns exist there.
        self.gt_vocab, self.gt_corrections = build_gt_resources(gt_csv)
        self.lexicon = TrustedLexicon(dic_path=dic, aff_path=aff, gt_csv_path=corpus_csv)

        self.rules = RuleEngine()
        self.token_corrector = TokenCorrector(
            self.hunspell, self.gt_vocab, self.gt_corrections, trusted_lexicon=self.lexicon
        )

    def correct(self, text: str, htr_confidence: Optional[float] = None) -> tuple[str, str]:
        """
        Correct a single line/sentence of Sinhala text.
        Returns (corrected_text, human_readable_note).

        htr_confidence: optional, passed through to token-level candidate
        scoring (see TokenCorrector.correct_token).
        """
        if not text or not text.strip():
            return text, "empty"

        raw_original = _norm_text(text)

        # NOTE: there used to be an exact whole-line lookup here, returning
        # a memorized ground-truth correction directly when raw_original
        # matched a labelled row. Removed -- ground truth may not be used
        # to PRODUCE any correction, only to evaluate/classify one that was
        # produced some other way. self.gt_corrections is still computed
        # (build_gt_resources) but is no longer read anywhere in this
        # method or in TokenCorrector.correct_token().

        all_notes: list[str] = []
        text = raw_original

        # ── Phase 1: Rule-based fixes ──────────────────────────────────────
        text, rule_notes = self.rules.apply_all(text, self.lexicon)
        all_notes.extend(rule_notes)

        # ── Phase 2: Token-level spell correction ─────────────────────────
        # Split preserving non-Sinhala chars (spaces, punct) as separate tokens
        token_pattern = re.compile(
            r"([\u0D80-\u0DFF\u200d\u200c]+|[^\u0D80-\u0DFF\u200d\u200c]+)"
        )
        parts = token_pattern.findall(text)
        corrected_parts: list[str] = []

        for part in parts:
            if re.search(r"[\u0D80-\u0DFF]", part):
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
# ERROR CLASSIFICATION  (EECF taxonomy + dataset labels)
# ──────────────────────────────────────────────────────────────────────────────
ZWJ_CHAR = "‍"

ERROR_LABELS = {
    "correct":     "Correct",
    "retroflex":   "Retroflex confusion",
    "vowel":       "Vowel / diacritic error",
    "zwj":         "ZWJ conjunct missing",
    "boundary":    "Word boundary error",
    "punctuation": "Punctuation error",
    "missing":     "Missing word / letter",
    "other":       "Other error",
}

FEEDBACK = {
    "correct":     {"si": "මෙම පේළියේ අක්ෂර වින්‍යාස දෝෂ නැමැත! හරිම හොඳයි !",
                    "en": "You wrote this correctly! Great work!"},
    "retroflex":   {"si": "ළ සහ ල, ණ සහ න, ට සහ ත, ඩ සහ ද — අකුරු හැඩය හොඳින් බලන්න.",
                    "en": "Check similar Sinhala letters such as ල/ළ, න/ණ, ත/ට, ද/ඩ."},
    "vowel":       {"si": "කෙටි/දිගු ස්වර ලකුණු සහ මඟහැරුණු පිල්ලම් නැවත බලන්න.",
                    "en": "Check short/long vowel marks and any missing diacritic signs."},
    "zwj":         {"si": "ක්‍ර, ශ්‍ර, ත්‍ය වැනි සංයෝග අකුරු ගැන අවධානය යොමු කරන්න.",
                    "en": "Conjunct letters need the Zero Width Joiner, e.g. ක්රීඩා → ක්‍රීඩා."},
    "boundary":    {"si": "වචන එකට බැඳී හෝ වැරදි තැනකින් වෙන් වී ඇත. හිස්තැන් බලන්න.",
                    "en": "Check word spacing: two words may be merged or one word may be split."},
    "punctuation": {"si": "විරාම ලකුණු (., ?, !, ,) නිවැරදි ස්ථානයේ දමන්න.",
                    "en": "Check punctuation position, especially period/comma placement."},
    "missing":     {"si": "අකුරක් හෝ වචනයක් අඩු/වැඩි වී ඇත. වචනය සම්පූර්ණද බලන්න.",
                    "en": "A letter or word is missing or extra. Check whether the word is complete."},
    "other":       {"si": "මෙය ඉහත වර්ගවලට පැහැදිලිව නොගැලපේ. සටහන් කොටස බලන්න.",
                    "en": "This does not clearly fit the main categories. See the note box."},
}

SKILL_MAP = {
    "retroflex":   "Retroflex — ල used instead of ළ / ණ-ට-ඩ confusion",
    "vowel":       "Vowel/diacritic — ි/ී, ු/ූ, missing sign",
    "zwj":         "ZWJ missing — conjunct without joiner",
    "boundary":    "Word boundary — merged/split words",
    "punctuation": "Punctuation — period/comma position",
    "missing":     "Missing word/letter",
    "other":       "Other — see note box",
    "correct":     "Correct",
}

ERROR_PROFILE_LABELS = {
    "retroflex":   "Retroflex — ල used instead of ළ / ණ-ට-ඩ confusion",
    "vowel":       "Vowel/diacritic — ි/ී, ු/ූ, missing sign",
    "zwj":         "ZWJ missing — conjunct without joiner",
    "boundary":    "Word boundary — merged/split words",
    "punctuation": "Punctuation — period/comma position",
    "missing":     "Missing word/letter",
    "other":       "Other — see note box",
}

SINHALA_DIACRITICS = set(chr(cp) for cp in range(0x0DCA, 0x0DDF + 1))
RETROFLEX_GROUPS = [
    set("ලළ"),
    set("නණ"),
    set("තටථ"),
    set("දඩ"),
    set("ශෂ"),
]


def _remove_spaces(s: str) -> str:
    return re.sub(r"\s+", "", s)


def _remove_joiners(s: str) -> str:
    return s.replace(ZWJ, "").replace(ZWNJ, "")


def _remove_punctuation(s: str) -> str:
    punct = PUNCT_CHARS | {SI_DANDA}
    return "".join(ch for ch in s if ch not in punct)


def _remove_diacritics(s: str) -> str:
    return "".join(ch for ch in s if ch not in SINHALA_DIACRITICS)


def _clean_for_length(s: str) -> str:
    s = _remove_joiners(s)
    s = _remove_punctuation(s)
    s = _remove_spaces(s)
    return s


def _canonical_retroflex(s: str) -> str:
    mapping = {}
    for group in RETROFLEX_GROUPS:
        rep = sorted(group)[0]
        for ch in group:
            mapping[ch] = rep
    return "".join(mapping.get(ch, ch) for ch in s)


def _has_zwj_error(raw: str, corrected: str) -> bool:
    return raw.count(ZWJ) < corrected.count(ZWJ) and _remove_joiners(raw) == _remove_joiners(corrected)


def _has_word_boundary_error(raw: str, corrected: str) -> bool:
    return raw != corrected and _remove_spaces(raw) == _remove_spaces(corrected)


def _has_punctuation_error(raw: str, corrected: str) -> bool:
    if raw == corrected:
        return False
    return _remove_punctuation(raw).strip() == _remove_punctuation(corrected).strip()


def _has_retroflex_error(raw: str, corrected: str) -> bool:
    if raw == corrected:
        return False
    raw_clean = _remove_spaces(_remove_punctuation(_remove_joiners(raw)))
    cor_clean = _remove_spaces(_remove_punctuation(_remove_joiners(corrected)))
    if len(_sinhala_graphemes(raw_clean)) != len(_sinhala_graphemes(cor_clean)):
        return False
    if _canonical_retroflex(raw_clean) != _canonical_retroflex(cor_clean):
        return False
    return any(sum(raw_clean.count(ch) for ch in g) == sum(cor_clean.count(ch) for ch in g)
               and any(raw_clean.count(ch) != cor_clean.count(ch) for ch in g)
               for g in RETROFLEX_GROUPS)


def _has_vowel_error(raw: str, corrected: str) -> bool:
    if raw == corrected:
        return False
    raw_clean = _remove_spaces(_remove_punctuation(_remove_joiners(raw)))
    cor_clean = _remove_spaces(_remove_punctuation(_remove_joiners(corrected)))

    # Same base letters but changed/missing vowel signs.
    if _remove_diacritics(raw_clean) == _remove_diacritics(cor_clean):
        return raw_clean != cor_clean

    # Or an explicit short/long vowel pair changed.
    return any(
        raw_clean.count(a) != cor_clean.count(a) or raw_clean.count(b) != cor_clean.count(b)
        for a, b in VOWEL_PAIRS
    )


def _has_missing_word_or_letter(raw: str, corrected: str) -> bool:
    raw_len = len(_sinhala_graphemes(_clean_for_length(raw)))
    cor_len = len(_sinhala_graphemes(_clean_for_length(corrected)))
    if raw_len != cor_len:
        return True

    # A whole word can be missing even if character length happens to be similar.
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
    """
    Determine the EECF error type from raw→corrected.

    Important: this no longer depends only on the text "spell:" in the note.
    It compares Unicode properties directly, so examples such as
    ත්යාගය→ත්‍යාගය become ZWJ, and රාමාණය→රාමායණය becomes missing.
    """
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

        if "ZWJ inserted" in note or "zwj" in note.lower() or _has_zwj_error(raw, corrected):
            detections.append("zwj")
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

        # Preserve order and choose the first high-priority match.
        priority = ["zwj", "retroflex", "vowel", "boundary", "punctuation", "missing", "other"]
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

# Module-level singleton so the corrector is only initialised once per process
_corrector: Optional[SinhalaHybridCorrector] = None


def _get_corrector() -> SinhalaHybridCorrector:
    global _corrector
    if _corrector is None:
        _corrector = SinhalaHybridCorrector()
    return _corrector


def process_htr_lines(lines: list[dict]) -> dict:
    """
    Drop-in replacement for the LLM correction phase in pipeline.py.

    Input : lines = [{"line_idx": int, "raw_text": str, "line_img": str}, ...]
    Output: dashboard dict (same structure as build_dashboard() in pipeline.py)
    """
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

    # ── Build dashboard ───────────────────────────────────────────────────
    total   = len(classified)
    correct = sum(1 for l in classified if l["error_type"] == "correct")
    error_counts = Counter(
        l["error_type"] for l in classified if l["error_type"] != "correct"
    )
    accuracy = round(correct / max(total, 1) * 100, 1)


    # Skill/Profile bars now show the percentage share of each error type
    # among the errors found below. This avoids the old Fluency=100% problem.
    total_errors = sum(error_counts.values())
    skill_scores: dict[str, int] = {}
    for err_type, label in ERROR_PROFILE_LABELS.items():
        skill_scores[label] = round(error_counts.get(err_type, 0) / max(total_errors, 1) * 100)

    dominant_error = error_counts.most_common(1)[0][0] if error_counts else "correct"
    repeated = [err for err, cnt in error_counts.items() if cnt >= 2]

    # ── Sentence assembly + grammar correction ──────────────────────────
    # Lines are single OCR text-rows, not sentences: a real sentence often
    # spans two handwriting lines, and a single line can hold two short
    # sentences. grammar_module re-assembles `classified` (already
    # spell-corrected, in top-to-bottom line order) into sentences and
    # grammar-checks each one that has 2+ words via the configured LLM.
    try:
        from grammar_module import build_sentences
        sentences = build_sentences(classified)
    except Exception as e:
        print(f"[hybrid_corrector] grammar module skipped: {e}")
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

# QUICK EVALUATION  (run this file directly to test against your CSV)
if __name__ == "__main__":
    import sys

    csv_path = sys.argv[1] if len(sys.argv) > 1 else "doc/Sinhala_updated_ground_truth.csv"
    dic_path = sys.argv[2] if len(sys.argv) > 2 else "doc/si_LK.dic"
    aff_path = sys.argv[3] if len(sys.argv) > 3 else "doc/si_LK.aff"

    print("=" * 60)
    print("  Sinhala Hybrid Corrector — Evaluation")
    print("=" * 60)

    corrector = SinhalaHybridCorrector(dic_path, aff_path, csv_path)

    try:
        import pandas as pd
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"Cannot load CSV: {e}")
        sys.exit(1)

    def _word_edit_distance(words_a: list[str], words_b: list[str]) -> int:
        """Plain Levenshtein distance over WORD sequences (for WER)."""
        m, n = len(words_a), len(words_b)
        if m == 0:
            return n
        if n == 0:
            return m
        prev = list(range(n + 1))
        for i in range(1, m + 1):
            curr = [i] + [0] * n
            for j in range(1, n + 1):
                cost = 0 if words_a[i - 1] == words_b[j - 1] else 1
                curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
            prev = curr
        return prev[n]

    results = []
    for _, row in df.iterrows():
        student = str(row.get("what students written", "")).strip()
        gt      = str(row.get("ground_truth", "")).strip()
        remark  = str(row.get("remarks", "")).strip()

        corrected, note = corrector.correct(student)
        # CER: character-level edit distance / reference length — sensitive
        # to single-letter mistakes (e.g. a vowel sign or retroflex swap).
        if gt:
            cer = edit_distance(corrected, gt) / max(len(_sinhala_graphemes(gt)), 1)
        else:
            cer = 0.0
        # WER: word-level edit distance / reference word count — a whole
        # word counts as wrong even for a one-character mistake. Reported
        # alongside CER since it's the more commonly cited metric in
        # OCR/ASR literature and easier for a non-technical reader to
        # interpret ("X% of words were wrong").
        gt_words = gt.split()
        cor_words = corrected.split()
        if gt_words:
            wer = _word_edit_distance(cor_words, gt_words) / len(gt_words)
        else:
            wer = 0.0
        results.append({
            "remark": remark,
            "cer":    cer,
            "wer":    wer,
            "exact":  corrected.strip() == gt.strip(),
        })

    total = len(results)
    exact_match = sum(1 for r in results if r["exact"])
    avg_cer = sum(r["cer"] for r in results) / max(total, 1)
    avg_wer = sum(r["wer"] for r in results) / max(total, 1)

    print(f"\nTotal lines  : {total}")
    print(f"Exact match  : {exact_match} ({exact_match/total*100:.1f}%)")
    print(f"Average CER  : {avg_cer:.4f}")
    print(f"Average WER  : {avg_wer:.4f}")

    print("\nBreakdown by error type:")
    from collections import defaultdict
    by_type: dict[str, list] = defaultdict(list)
    for r in results:
        by_type[r["remark"]].append(r)
    for remark, rows in sorted(by_type.items()):
        avg_c = sum(r["cer"] for r in rows) / len(rows)
        avg_w = sum(r["wer"] for r in rows) / len(rows)
        print(f"  {remark:<25} n={len(rows):<5} avg CER={avg_c:.4f}  avg WER={avg_w:.4f}")