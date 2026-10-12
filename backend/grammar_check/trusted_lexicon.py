"""
trusted_lexicon.py
===================
Multi-tier trusted-lexicon + confidence-based spelling error detection,
candidate generation, and candidate ranking for the Sinhala HTR spelling
pipeline. Replaces the old "single flat dictionary, blindly correct if
unknown" approach.

Why this exists (see project discussion / dissertation methodology):
Blindly trusting one dictionary is dangerous — a token missing from a
single word list is NOT proof it's misspelled (it could be a rare but
valid inflected form, a proper noun, or a domain word the dictionary
just doesn't have). Treating "not found" as "must correct" is exactly
why a Dictionary-Only baseline scored WORSE than doing nothing (14.91%
CER vs. a 2.48% HTR baseline) — real words were getting silently
replaced by the nearest wrong dictionary word.

PIPELINE THIS MODULE IMPLEMENTS (phases 1, 2/3, 4 of the project's
spelling-pipeline diagram -- phase 5, error classification, lives in
hybrid_corrector.py and runs AFTER correction, not here):

    token
      |
      v
  [1] ERROR DETECTION   -- TrustedLexicon.lookup()
      multi-tier confidence lookup; only 0-hit tokens are investigated
      |
      v (if suspicious_unknown)
  [2/3] CANDIDATE GENERATION -- TrustedLexicon.generate_candidates()
      SymSpell-style deletion index over the combined real vocabulary
      + Sinhala confusion-pair (retroflex/vowel) rule candidates
      |
      v
  [4] CANDIDATE RANKING -- TrustedLexicon.score_candidate()
      lexicon validity + frequency + confusion-aware similarity +
      optional HTR confidence, combined into one 0..1 score
      |
      v
  caller (hybrid_corrector.TokenCorrector) applies the confidence
  threshold gate and either corrects or keeps the original token.

HONESTY ABOUT WHAT EACH TIER ACTUALLY IS (important for methodology
write-up -- do not overstate these):

  dictionary  -- literal membership in si_LK.dic (Hunspell, 26,707
                words after affix stripping) UNION a separate
                83,061-word Sinhala list
                (github.com/laknath/Sinhala-Dictionary). Combined:
                83,199 words (some overlap). A real, independent,
                general-vocabulary source.

  morphology  -- REAL, corpus-attested inflected word forms, from
                nlpcuom/Word-Frequency-List-for-Sinhala's
                verified_word_list_lemma_analysis.txt: 43,313 lemmas,
                each mapped to every surface form actually observed for
                it in a real corpus (254,755 unique forms total). This
                is NOT generated/guessed the way an earlier Hunspell-
                affix-based attempt was (removed entirely -- it naively
                applied SFX suffix rules with no `condition`-field
                filtering and generated ~1.49M mostly-invalid forms; see
                hybrid_corrector.py's HunspellDictionary docstring) --
                these forms were already seen in real text, so there's
                no over-generation risk.

  corpus      -- vocabulary extracted from your own labelled ground-
                truth CSV. Small (~1,600 words), but every entry is
                human-verified correct for this exact task domain
                (handwritten Sinhala school exercises).

  frequency   -- REAL corpus frequency counts, from
                nlpcuom/Word-Frequency-List-for-Sinhala's
                verified_word_list_200K.si: 280,603 words with actual
                occurrence counts (e.g. "මම" -> 485,725). This is now a
                genuinely independent tier (an earlier version of this
                module used GT-CSV word counts as a proxy for
                "frequency", which wasn't actually independent of the
                `corpus` tier since both came from the same small file
                -- that limitation is gone now that a real, separate,
                large corpus is available).

STATUS LEVELS (`TokenLookup.status`), unchanged in spirit, now over 4
independently-sourced tiers instead of 3:
  high_confidence_valid -- hit in 2 or more of {dictionary, morphology,
                           corpus, frequency}. Leave alone.
  valid                 -- hit in exactly 1 tier. Leave alone. (Missing
                           from one list but present in another is
                           common and NOT an error signal by itself.)
  suspicious_unknown    -- hit in 0 tiers. Investigate via candidate
                           generation + scoring. Still may end up
                           "kept as original" if no candidate scores
                           high enough -- unknown is not automatically
                           wrong.
"""
from __future__ import annotations

import ast
import math
import os
import re
import csv
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Optional

ZWJ = "‍"
ZWNJ = "‌"

# Sinhala-specific confusion pairs -- used both to generate rule-based
# candidates directly, and to make candidate-vs-original similarity
# scoring aware that ල→ළ is a much more likely/cheap mistake than a
# random substitution, even though both cost 1 in plain edit distance.
RETROFLEX_PAIRS: list[tuple[str, str]] = [
    ("ල", "ළ"), ("ළ", "ල"),
    ("න", "ණ"), ("ණ", "න"),
    ("ත", "ට"), ("ට", "ත"),
    ("ද", "ඩ"), ("ඩ", "ද"),
    ("ශ", "ෂ"), ("ෂ", "ශ"),
    ("ත", "ථ"), ("ථ", "ත"),
    ("බ", "භ"), ("භ", "බ"),
]
VOWEL_PAIRS: list[tuple[str, str]] = [
    ("ි", "ී"), ("ී", "ි"),   # ි ↔ ී
    ("ු", "ූ"), ("ූ", "ු"),   # ු ↔ ූ
    ("ැ", "ෑ"), ("ෑ", "ැ"),   # ැ (short æ) ↔ ෑ (long ǣ) -- comment used to
                               # wrongly say "↔ ේ" (a different vowel, ē);
                               # the pair itself was always correct, matches
                               # the short/long pattern of the two rows above
]
_CONFUSION_LOOKUP: set[tuple[str, str]] = set(RETROFLEX_PAIRS) | set(VOWEL_PAIRS)

# ZWJ conjunct patterns. Moved here from hybrid_corrector.py's RuleEngine:
# these used to be applied as an automatic, blind line-level rule (any
# occurrence of the left form got replaced with the right form). That's
# risky for the same reason as retroflex/vowel typos are -- the same
# letter sequence can legitimately appear both with and without the ZWJ
# depending on the specific word (confirmed empirically: ඉන්දීය and
# සුන්දරත්වයක් were both "corrected" into wrong ZWJ'd forms by the old
# blind rule). Now ZWJ insertion is CANDIDATE GENERATION, not an
# automatic edit -- see generate_candidates() below. A ZWJ'd variant is
# proposed like any other candidate and only accepted if it scores above
# both the confidence threshold AND the original token's own score,
# exactly the same validation every other candidate goes through.
CONJUNCT_PATTERNS: list[tuple[str, str]] = [
    ("ක්රි",  "ක්‍රි"),    # ක්රී → ක්‍රී
    ("ක්ර",   "ක්‍ර"),
    ("ශ්ර",   "ශ්‍ර"),
    ("ශ්රී",  "ශ්‍රී"),
    ("ප්ර",   "ප්‍ර"),
    ("බ්ර",   "බ්‍ර"),
    ("ග්ර",   "ග්‍ර"),
    ("ට්ර",   "ට්‍ර"),
    ("ද්ර",   "ද්‍ර"),
    ("ම්ල",   "ම්‍ල"),
    ("ව්ය",   "ව්‍ය"),
    ("ත්ය",   "ත්‍ය"),     # ත්යාගය → ත්‍යාගය
    ("ද්ය",   "ද්‍ය"),
    ("න්ය",   "න්‍ය"),
    ("ක්ය",   "ක්‍ය"),
    ("ප්රි",   "ප්‍රි"),
    ("ප්රි",   "ප්‍රි"),
    ("ෂ්ය",   "ෂ්‍ය"),
]


def _norm(text: str) -> str:
    return unicodedata.normalize("NFC", str(text or "").strip())


def _sinhala_graphemes(text: str) -> list[str]:
    """Grapheme-cluster split (base + diacritics/virama/ZWJ), matches
    hybrid_corrector.py's definition so distances are comparable."""
    clusters: list[str] = []
    i = 0
    chars = list(text)
    while i < len(chars):
        cluster = chars[i]
        i += 1
        while i < len(chars) and (
            unicodedata.category(chars[i]) in ("Mn", "Mc", "Me", "Cf")
            or chars[i] in (ZWJ, ZWNJ, "්")
        ):
            cluster += chars[i]
            i += 1
        clusters.append(cluster)
    return clusters


def confusion_aware_distance(a: str, b: str) -> float:
    """
    Levenshtein on grapheme clusters, EXCEPT a substitution between two
    clusters that form a known Sinhala confusion pair (retroflex or
    vowel-length) costs 0.5 instead of 1.0. This is what lets candidate
    ranking prefer "ල→ළ" (a documented, common handwriting/HTR confusion)
    over an equal-edit-distance but linguistically arbitrary substitution.
    """
    ga = _sinhala_graphemes(a)
    gb = _sinhala_graphemes(b)
    m, n = len(ga), len(gb)
    if m == 0:
        return float(n)
    if n == 0:
        return float(m)
    prev = [float(j) for j in range(n + 1)]
    for i in range(1, m + 1):
        curr = [float(i)] + [0.0] * n
        for j in range(1, n + 1):
            if ga[i - 1] == gb[j - 1]:
                cost = 0.0
            elif (ga[i - 1], gb[j - 1]) in _CONFUSION_LOOKUP:
                cost = 0.5
            else:
                cost = 1.0
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        prev = curr
    return prev[n]


@dataclass
class TokenLookup:
    token: str
    in_dictionary: bool
    in_morphology: bool
    in_corpus: bool
    in_frequency: bool

    @property
    def hit_count(self) -> int:
        return sum([self.in_dictionary, self.in_morphology, self.in_corpus, self.in_frequency])

    @property
    def status(self) -> str:
        if self.hit_count >= 2:
            return "high_confidence_valid"
        if self.hit_count == 1:
            return "valid"
        return "suspicious_unknown"

    @property
    def needs_investigation(self) -> bool:
        return self.hit_count == 0


class TrustedLexicon:
    """
    Loads and holds the (documented-honestly) multi-tier lexicon, and
    provides token status lookup + candidate generation + multi-signal
    candidate scoring.
    """

    _DEFAULT_DIC = os.path.join(os.path.dirname(__file__), "doc", "si_LK.dic")
    _DEFAULT_AFF = os.path.join(os.path.dirname(__file__), "doc", "si_LK.aff")
    _DEFAULT_BIG_LIST = os.path.join(os.path.dirname(__file__), "doc", "lexicon_sinhala_83k.txt")
    _DEFAULT_GT_CSV = os.path.join(os.path.dirname(__file__), "doc", "sinhala_grade5_age_appropriate_corpus.csv")
    _DEFAULT_LEMMA_FILE = os.path.join(os.path.dirname(__file__), "doc", "verified_word_list_lemma_analysis.txt")
    _DEFAULT_FREQ_FILE = os.path.join(os.path.dirname(__file__), "doc","verified_word_list_200K.si")

    # SymSpell-style deletion index: max number of grapheme deletions
    # used to index/query candidates. 2 was benchmarked at ~17s to build
    # over the full ~320k-word combined vocabulary -- a one-time startup
    # cost, not a per-token cost (see conversation for the benchmark).
    MAX_EDIT_DISTANCE = 2

    # Frequency scores are log-scaled, not linear -- real corpus counts
    # range from 1 to 1,000,000+ (e.g. "මම" = 485,725), so a linear scale
    # would put nearly every real word at 1.0 with no useful spread. This
    # saturates at FREQ_SATURATION occurrences, not at the corpus max.
    FREQ_SATURATION = 1000

    def __init__(
        self,
        dic_path: Optional[str] = None,
        aff_path: Optional[str] = None,
        big_list_path: Optional[str] = None,
        gt_csv_path: Optional[str] = None,
        lemma_file_path: Optional[str] = None,
        freq_file_path: Optional[str] = None,
        morphology_words: Optional[set[str]] = None,
        build_candidate_index: bool = True,
    ):
        """
        `morphology_words`: override to inject a precomputed morphology
        set directly (e.g. for tests). If not given, loaded from
        `lemma_file_path` (the real, attested-forms source -- see module
        docstring). The old Hunspell-affix-based expansion approach was
        removed entirely, not just disabled -- see module docstring.

        `build_candidate_index`: set False to skip building the
        SymSpell deletion index (e.g. for quick tests that only need
        `.lookup()`, not `.generate_candidates()`) -- saves the ~17s
        build cost when candidate generation isn't needed.
        """
        dic_path = dic_path or self._DEFAULT_DIC
        aff_path = aff_path or self._DEFAULT_AFF
        big_list_path = big_list_path or self._DEFAULT_BIG_LIST
        gt_csv_path = gt_csv_path or self._DEFAULT_GT_CSV
        lemma_file_path = lemma_file_path or self._DEFAULT_LEMMA_FILE
        freq_file_path = freq_file_path or self._DEFAULT_FREQ_FILE

        hunspell_words = self._load_dic(dic_path)
        big_list_words = self._load_flat_wordlist(big_list_path)

        # dictionary tier: union of both literal word lists
        self.dictionary_words: set[str] = hunspell_words | big_list_words

        # morphology tier: real, corpus-attested inflected forms
        if morphology_words is None:
            morphology_words = self._load_lemma_morphology(lemma_file_path)
        self.morphology_words: set[str] = morphology_words - self.dictionary_words

        # corpus tier (small, domain-verified) from the GT CSV. GT word
        # counts are kept too (gt_frequency_counts) as a minor
        # domain-specific boost, separate from the large general
        # frequency corpus below -- they're different kinds of evidence
        # and shouldn't be conflated into one number.
        self.corpus_words, self.gt_frequency_counts = self._load_gt_corpus(gt_csv_path)

        # frequency tier: REAL, independent, large-corpus frequency data
        self.frequency_words, self.frequency_counts = self._load_frequency_list(freq_file_path)
        # verified_word_list_200K.si (280K+ words) isn't shipped in this
        # copy of the project -- _load_frequency_list() already warns and
        # returns empty above. Recorded here so score_candidate() can stop
        # silently spending 35-45% of every candidate's score weight on a
        # signal that always evaluates to 0, which was capping every
        # correction's score well below CANDIDATE_CONFIDENCE_THRESHOLD
        # regardless of how obviously correct the candidate was (e.g. a
        # clean ZWJ-insertion fix for a common word) -- see score_candidate.
        self.has_frequency_data = bool(self.frequency_words)

        print(
            f"[TrustedLexicon] dictionary={len(self.dictionary_words):,}  "
            f"morphology(+)={len(self.morphology_words):,}  "
            f"corpus={len(self.corpus_words):,}  "
            f"frequency={len(self.frequency_words):,}"
        )

        self._candidate_index: dict[str, set[str]] = {}
        if build_candidate_index:
            self._candidate_index = self._build_deletion_index()

    # ── loaders ──────────────────────────────────────────────────────
    @staticmethod
    def _load_dic(path: str) -> set[str]:
        words: set[str] = set()
        if not os.path.exists(path):
            print(f"[TrustedLexicon] ⚠ hunspell .dic not found: {path}")
            return words
        with open(path, encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        for line in lines[1:]:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            word = line.split("/")[0].strip()
            if word:
                words.add(_norm(word))
        return words

    @staticmethod
    def _load_flat_wordlist(path: str) -> set[str]:
        words: set[str] = set()
        if not os.path.exists(path):
            print(f"[TrustedLexicon] ⚠ word list not found: {path}")
            return words
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                w = _norm(line)
                if w:
                    words.add(w)
        return words

    @staticmethod
    def _load_lemma_morphology(path: str) -> set[str]:
        """
        Parse verified_word_list_lemma_analysis.txt:
            <lemma>: <total_freq> ['form1', 'form2', ...]
        Returns the union of every attested surface form across every
        lemma -- real, corpus-observed inflected words, not generated
        ones. ast.literal_eval() is used (not eval()) to safely parse
        the Python-list-literal syntax after the '[' on each line.
        """
        words: set[str] = set()
        if not os.path.exists(path):
            print(f"[TrustedLexicon] ⚠ lemma/morphology file not found: {path}")
            return words
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                idx = line.find("[")
                if idx == -1:
                    continue
                try:
                    forms = ast.literal_eval(line[idx:].strip())
                except (ValueError, SyntaxError):
                    continue
                for form in forms:
                    w = _norm(form)
                    if w:
                        words.add(w)
        return words

    @staticmethod
    def _load_frequency_list(path: str) -> tuple[set[str], dict[str, int]]:
        """
        Parse verified_word_list_200K.si: `<word> <count>` per line.
        """
        words: set[str] = set()
        counts: dict[str, int] = {}
        if not os.path.exists(path):
            print(f"[TrustedLexicon] ⚠ frequency list not found: {path}")
            return words, counts
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                parts = line.rsplit(None, 1)
                if len(parts) != 2:
                    continue
                w, c = parts
                w = _norm(w)
                try:
                    count = int(c)
                except ValueError:
                    continue
                if w:
                    words.add(w)
                    counts[w] = count
        return words, counts

    @staticmethod
    def _load_gt_corpus(csv_path: str) -> tuple[set[str], Counter]:
        vocab: set[str] = set()
        counts: Counter = Counter()
        if not csv_path or not os.path.exists(csv_path):
            return vocab, counts
        try:
            with open(csv_path, encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    gt = _norm(row.get("text", ""))
                    if not gt:
                        continue
                    for token in re.findall(r"[඀-෿‍]+", gt):
                        if len(token) > 1:
                            vocab.add(token)
                            counts[token] += 1
        except Exception as e:
            print(f"[TrustedLexicon] could not load GT CSV: {e}")
        return vocab, counts

    # ── lookup ───────────────────────────────────────────────────────
    def lookup(self, token: str) -> TokenLookup:
        t = _norm(token)
        return TokenLookup(
            token=t,
            in_dictionary=t in self.dictionary_words,
            in_morphology=t in self.morphology_words,
            in_corpus=t in self.corpus_words,
            in_frequency=t in self.frequency_words,
        )

    # ── candidate generation ─────────────────────────────────────────
    @staticmethod
    def _deletes(graphemes: tuple[str, ...], max_edits: int) -> set[tuple[str, ...]]:
        """All grapheme-tuples reachable by deleting up to `max_edits`
        graphemes (including the original, 0 deletions)."""
        results = {graphemes}
        frontier = {graphemes}
        for _ in range(max_edits):
            next_frontier: set[tuple[str, ...]] = set()
            for seq in frontier:
                if len(seq) <= 1:
                    continue
                for i in range(len(seq)):
                    variant = seq[:i] + seq[i + 1:]
                    if variant not in results:
                        results.add(variant)
                        next_frontier.add(variant)
            frontier = next_frontier
        return results

    def _build_deletion_index(self) -> dict[str, set[str]]:
        """
        SymSpell-style deletion index over the combined REAL vocabulary
        (dictionary | morphology | frequency -- NOT the small hunspell/
        GT sets, per project decision to stop prioritising those for
        candidate generation). Benchmarked at ~17s over ~320k words for
        MAX_EDIT_DISTANCE=2 -- a one-time cost at startup, not per token.
        """
        combined = self.dictionary_words | self.morphology_words | self.frequency_words
        index: dict[str, set[str]] = defaultdict(set)
        for word in combined:
            g = tuple(_sinhala_graphemes(word))
            for variant in self._deletes(g, self.MAX_EDIT_DISTANCE):
                index["".join(variant)].add(word)
        print(f"[TrustedLexicon] candidate index built: {len(combined):,} words, "
              f"{len(index):,} index keys")
        return dict(index)

    def _generate_confusion_candidates(self, token: str) -> list[str]:
        """
        Rule-based candidates from known Sinhala confusion pairs
        (retroflex / vowel-length swaps), NOT a lexicon lookup.

        Generates one candidate per OCCURRENCE of a confusable character,
        not just the first. A token containing the same confusable
        character twice (e.g. two ල's, only one of which is the actual
        mistake) previously only ever got a candidate for swapping the
        first one -- the second position's mistake was unreachable no
        matter how the ranking scored things, because no candidate for
        it was ever generated. Now every position gets its own candidate
        (leaving the others untouched), and ranking decides which one
        (if any) is actually right.
        """
        candidates: list[str] = []
        for a, b in RETROFLEX_PAIRS + VOWEL_PAIRS:
            start = 0
            while True:
                idx = token.find(a, start)
                if idx == -1:
                    break
                candidates.append(token[:idx] + b + token[idx + len(a):])
                start = idx + len(a)
        return candidates

    def _generate_zwj_candidates(self, token: str) -> list[str]:
        """
        ZWJ conjunct candidates -- insertion AND removal, one candidate
        per occurrence position (same per-occurrence reasoning as
        _generate_confusion_candidates). These are PROPOSALS only: the
        caller scores and threshold-gates them exactly like every other
        candidate (see module docstring's note on CONJUNCT_PATTERNS) --
        this method does not decide whether ZWJ should actually be
        applied, it just offers the possibility.
        """
        candidates: list[str] = []
        for no_zwj, with_zwj in CONJUNCT_PATTERNS:
            for pattern, replacement in ((no_zwj, with_zwj), (with_zwj, no_zwj)):
                start = 0
                while True:
                    idx = token.find(pattern, start)
                    if idx == -1:
                        break
                    candidates.append(token[:idx] + replacement + token[idx + len(pattern):])
                    start = idx + len(pattern)
        return candidates

    def generate_candidates(self, token: str, max_results: int = 8) -> list[str]:
        """
        Phase 2/3: Candidate Generation.

        Sources (per project decision): the SymSpell deletion index over
        dictionary | morphology | frequency (~320k real words) -- NOT
        hunspell.suggest() or GT-vocab close-matches, which are no
        longer used for generation (too small / lower priority). Plus
        rule-based confusion-pair and ZWJ candidates, which aren't a
        lexicon lookup at all so they're unaffected by that decision --
        all of them get scored and threshold-gated identically by the
        caller, none of them are auto-applied here.
        """
        token = _norm(token)
        g = tuple(_sinhala_graphemes(token))

        found: set[str] = set()
        for variant in self._deletes(g, self.MAX_EDIT_DISTANCE):
            found.update(self._candidate_index.get("".join(variant), ()))

        # Verify REAL edit distance -- the deletion index can return
        # words up to 2*MAX_EDIT_DISTANCE apart (a delete on the token
        # side and a delete on the word side can coincidentally collide
        # on the same variant), so results must be checked, not trusted
        # blindly.
        verified: list[tuple[float, str]] = []
        for word in found:
            if word == token:
                continue
            dist = confusion_aware_distance(token, word)
            if dist <= self.MAX_EDIT_DISTANCE:
                verified.append((dist, word))
        verified.sort(key=lambda x: x[0])

        candidates = [w for _, w in verified[:max_results]]
        for c in self._generate_confusion_candidates(token) + self._generate_zwj_candidates(token):
            if c not in candidates and c != token:
                candidates.append(c)
        return candidates

    # ── candidate scoring ────────────────────────────────────────────
    def score_candidate(
        self,
        original: str,
        candidate: str,
        htr_confidence: Optional[float] = None,
    ) -> float:
        """
        Combined 0..1 confidence score for replacing `original` with
        `candidate`. Signals (see module docstring for what each tier
        honestly represents):
          - lexicon validity  (0.35-0.45 weight): how many of the 4
            trusted tiers the CANDIDATE hits.
          - frequency          (0.10-0.15 weight): log-scaled real
            corpus frequency (verified_word_list_200K.si) plus a small
            domain-specific boost from GT occurrence count.
          - similarity / error compatibility (0.30-0.40 weight):
            confusion-aware distance to the original -- small,
            linguistically-plausible edits (retroflex/vowel swaps)
            score higher than large arbitrary ones.
          - HTR confidence      (0.15-0.25 weight, optional): the OCR
            model's own per-line confidence, if passed in -- a LOW HTR
            confidence line is a context where trusting a spelling
            correction more, not less, is reasonable.
        """
        lookup = self.lookup(candidate)
        lexicon_score = lookup.hit_count / 4.0

        general_freq = self.frequency_counts.get(_norm(candidate), 0)
        general_freq_score = min(math.log1p(general_freq) / math.log1p(self.FREQ_SATURATION), 1.0)
        gt_freq = self.gt_frequency_counts.get(_norm(candidate), 0)
        gt_freq_score = min(gt_freq / 5.0, 1.0)
        # General corpus frequency carries most of the weight (much
        # larger, more representative sample); GT frequency contributes
        # a smaller domain-specific boost on top.
        freq_score = 0.8 * general_freq_score + 0.2 * gt_freq_score

        dist = confusion_aware_distance(original, candidate)
        max_len = max(len(_sinhala_graphemes(original)), len(_sinhala_graphemes(candidate)), 1)
        similarity_score = max(0.0, 1.0 - (dist / max_len))

        if htr_confidence is not None:
            weights = {"lexicon": 0.10, "freq": 0.35, "similarity": 0.30, "htr": 0.25}
            score = (
                weights["lexicon"] * lexicon_score
                + weights["freq"] * freq_score
                + weights["similarity"] * similarity_score
                + weights["htr"] * (1.0 - htr_confidence)  # low HTR conf -> trust correction more
            )
        else:
            weights = {"lexicon": 0.15, "freq": 0.45, "similarity": 0.40}
            score = (
                weights["lexicon"] * lexicon_score
                + weights["freq"] * freq_score
                + weights["similarity"] * similarity_score
            )
        return score
