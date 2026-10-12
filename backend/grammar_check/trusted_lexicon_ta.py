"""
trusted_lexicon_ta.py
======================
Tamil counterpart of trusted_lexicon.py. Same multi-tier design (dictionary
/ morphology / corpus / frequency -> lookup -> candidate generation ->
candidate scoring), duplicated into its own module rather than
parameterizing the Sinhala one, on purpose: this file's confusion-pair
tables, grapheme-cluster splitter, and file-format loaders are genuinely
different per-script decisions, and keeping them in a separate file means
none of this touches trusted_lexicon.py or its already-evaluated Sinhala
behaviour.

WHAT EACH TIER ACTUALLY IS FOR TAMIL RIGHT NOW (be honest about this in
any write-up, same as the Sinhala module insists on):

  dictionary  -- ta_IN.dic (Hunspell) UNION lemma_dictionary.txt (a flat
                285K-word list -- despite its filename this is NOT a
                lemma->surface-forms morphology resource, it's a second
                plain word list, so it's unioned into `dictionary`, not
                treated as `morphology`).

  morphology  -- NOT AVAILABLE. No corpus-attested lemma->inflected-forms
                resource exists for Tamil yet, so this tier is always
                empty. That means a rare-but-real inflected form that
                isn't literally in either flat word list will register as
                unknown more often than it would for Sinhala -- lean
                conservative on confidence thresholds until this gap is
                addressed.

  corpus      -- vocabulary from a Tamil age-appropriate corpus CSV (a
                "text" column of clean curriculum sentences), same shape
                as Sinhala's sinhala_grade5_age_appropriate_corpus.csv.
                No default filename is assumed to exist -- pass
                gt_csv_path= explicitly when you have one; if it's
                missing, this tier is just empty (loaders here are all
                tolerant of missing files by design).

  frequency   -- top_100000.csv: real word/frequency counts, CSV format
                (header `word,frequency`), NOT the same layout as
                Sinhala's verified_word_list_200K.si (space-separated, no
                header) -- hence a separate loader below.

No ground-truth "student mistake" CSV is wired in here at all (that's a
hybrid_corrector_ta.py concern, not this module's).
"""
from __future__ import annotations

import math
import os
import re
import csv
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

ZWJ = "‍"
ZWNJ = "‌"
TAMIL_VIRAMA = "்"   # pulli
TAMIL_RANGE_RE = r"[஀-௿‍]+"

# Tamil-specific confusion pairs -- letters that look alike in handwriting
# and/or are commonly confused, used both for rule-based candidate
# generation and to make similarity scoring treat these as cheap,
# plausible mistakes rather than arbitrary substitutions. These are NOT
# the Sinhala retroflex/vowel-length pairs -- Tamil's actual confusions
# are different letters entirely, and Tamil has no ZWJ-conjunct-rendering
# issue the way Sinhala does, so there is no CONJUNCT_PATTERNS category
# here (kept as an empty list purely so generate_candidates()'s structure
# stays parallel to the Sinhala version -- it's a genuine no-op, not a
# placeholder to fill in later).
RETROFLEX_PAIRS: list[tuple[str, str]] = [
    ("ண", "ந"), ("ந", "ண"),   # retroflex vs dental nasal
    ("ண", "ன"), ("ன", "ண"),   # retroflex vs alveolar nasal
    ("ந", "ன"), ("ன", "ந"),   # dental vs alveolar nasal
    ("ள", "ழ"), ("ழ", "ள"),   # retroflex lateral vs zha
    ("ள", "ல"), ("ல", "ள"),   # retroflex vs dental lateral
    ("ழ", "ல"), ("ல", "ழ"),   # zha vs dental lateral
    ("ற", "ர"), ("ர", "ற"),   # hard vs soft ra
]
VOWEL_PAIRS: list[tuple[str, str]] = [
    ("ி", "ீ"), ("ீ", "ி"),   # short i <-> long ii
    ("ு", "ூ"), ("ூ", "ு"),   # short u <-> long uu
    ("ெ", "ே"), ("ே", "ெ"),   # short e <-> long ee
    ("ொ", "ோ"), ("ோ", "ொ"),   # short o <-> long oo
]
_CONFUSION_LOOKUP: set[tuple[str, str]] = set(RETROFLEX_PAIRS) | set(VOWEL_PAIRS)

CONJUNCT_PATTERNS: list[tuple[str, str]] = []   # see module docstring -- intentionally empty for Tamil


def _norm(text: str) -> str:
    return unicodedata.normalize("NFC", str(text or "").strip())


def _tamil_graphemes(text: str) -> list[str]:
    """
    Grapheme-cluster split (base consonant + dependent vowel sign/pulli/
    ZWJ), mirroring trusted_lexicon.py's _sinhala_graphemes() so edit
    distances stay comparable in spirit. Tamil vowel signs like ெ/ே are
    stored in Unicode AFTER the base consonant even though they render
    BEFORE it visually -- storage order is what this function walks, and
    storage order already keeps each base+sign pair adjacent, so no
    special reordering logic is needed here.
    """
    clusters: list[str] = []
    i = 0
    chars = list(text)
    while i < len(chars):
        cluster = chars[i]
        i += 1
        while i < len(chars) and (
            unicodedata.category(chars[i]) in ("Mn", "Mc", "Me", "Cf")
            or chars[i] in (ZWJ, ZWNJ, TAMIL_VIRAMA)
        ):
            cluster += chars[i]
            i += 1
        clusters.append(cluster)
    return clusters


def confusion_aware_distance(a: str, b: str) -> float:
    """Levenshtein on grapheme clusters, except a substitution between two
    clusters in a known Tamil confusion pair costs 0.5 instead of 1.0."""
    ga = _tamil_graphemes(a)
    gb = _tamil_graphemes(b)
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
    """Tamil multi-tier lexicon -- see module docstring for what each tier
    actually is right now. Same lookup/generate_candidates/score_candidate
    interface as trusted_lexicon.TrustedLexicon so hybrid_corrector_ta.py
    can use it as a drop-in."""

    _DEFAULT_DIC = os.path.join(os.path.dirname(__file__), "doc", "ta_IN.dic")
    _DEFAULT_AFF = os.path.join(os.path.dirname(__file__), "doc", "ta_IN.aff")
    _DEFAULT_BIG_LIST = os.path.join(os.path.dirname(__file__), "doc", "lemma_dictionary.txt")
    # No default assumed to exist -- pass corpus_csv_path explicitly once
    # you have a Tamil age-appropriate corpus CSV. Missing file -> empty
    # corpus tier, not an error.
    _DEFAULT_GT_CSV = os.path.join(os.path.dirname(__file__), "doc", "tamil_grade_age_appropriate_corpus.csv")
    # No lemma/morphology resource exists yet -- points at a filename that
    # (by design) won't exist, so the morphology tier loads empty.
    _DEFAULT_LEMMA_FILE = os.path.join(os.path.dirname(__file__), "doc", "verified_word_list_lemma_analysis_ta.txt")
    _DEFAULT_FREQ_FILE = os.path.join(os.path.dirname(__file__), "doc", "top_100000.csv")

    MAX_EDIT_DISTANCE = 2
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

        # morphology tier: empty until a real Tamil lemma/inflected-forms
        # resource exists (see module docstring)
        if morphology_words is None:
            morphology_words = self._load_lemma_morphology(lemma_file_path)
        self.morphology_words: set[str] = morphology_words - self.dictionary_words

        self.corpus_words, self.gt_frequency_counts = self._load_gt_corpus(gt_csv_path)

        self.frequency_words, self.frequency_counts = self._load_frequency_list(freq_file_path)

        print(
            f"[TrustedLexicon-ta] dictionary={len(self.dictionary_words):,}  "
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
            print(f"[TrustedLexicon-ta] ⚠ hunspell .dic not found: {path}")
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
            print(f"[TrustedLexicon-ta] ⚠ word list not found: {path}")
            return words
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                w = _norm(line)
                if w:
                    words.add(w)
        return words

    @staticmethod
    def _load_lemma_morphology(path: str) -> set[str]:
        """No Tamil lemma/morphology resource exists yet -- this returns
        empty unless/until such a file (matching the Sinhala format:
        `<lemma>: <total_freq> ['form1', 'form2', ...]`) is provided."""
        words: set[str] = set()
        if not os.path.exists(path):
            print(f"[TrustedLexicon-ta] morphology tier: no file at {path} (expected -- see module docstring)")
            return words
        import ast
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
        Parses top_100000.csv: CSV with header `word,frequency` -- a
        DIFFERENT format from Sinhala's verified_word_list_200K.si
        (space-separated, no header), hence this loader is not shared.
        """
        words: set[str] = set()
        counts: dict[str, int] = {}
        if not os.path.exists(path):
            print(f"[TrustedLexicon-ta] ⚠ frequency list not found: {path}")
            return words, counts
        try:
            with open(path, encoding="utf-8-sig", errors="replace", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    w = _norm(row.get("word", ""))
                    if not w:
                        continue
                    try:
                        count = int(float(row.get("frequency", 0) or 0))
                    except ValueError:
                        continue
                    words.add(w)
                    counts[w] = count
        except Exception as e:
            print(f"[TrustedLexicon-ta] could not load frequency CSV: {e}")
        return words, counts

    @staticmethod
    def _load_gt_corpus(csv_path: str) -> tuple[set[str], "Counter"]:
        from collections import Counter
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
                    for token in re.findall(TAMIL_RANGE_RE, gt):
                        if len(token) > 1:
                            vocab.add(token)
                            counts[token] += 1
        except Exception as e:
            print(f"[TrustedLexicon-ta] could not load GT CSV: {e}")
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
        combined = self.dictionary_words | self.morphology_words | self.frequency_words
        index: dict[str, set[str]] = defaultdict(set)
        for word in combined:
            g = tuple(_tamil_graphemes(word))
            for variant in self._deletes(g, self.MAX_EDIT_DISTANCE):
                index["".join(variant)].add(word)
        print(f"[TrustedLexicon-ta] candidate index built: {len(combined):,} words, "
              f"{len(index):,} index keys")
        return dict(index)

    def _generate_confusion_candidates(self, token: str) -> list[str]:
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
        """No-op for Tamil -- CONJUNCT_PATTERNS is intentionally empty
        (see module docstring). Kept only so this class's method surface
        matches trusted_lexicon.TrustedLexicon."""
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
        token = _norm(token)
        g = tuple(_tamil_graphemes(token))

        found: set[str] = set()
        for variant in self._deletes(g, self.MAX_EDIT_DISTANCE):
            found.update(self._candidate_index.get("".join(variant), ()))

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
        lookup = self.lookup(candidate)
        lexicon_score = lookup.hit_count / 4.0

        general_freq = self.frequency_counts.get(_norm(candidate), 0)
        general_freq_score = min(math.log1p(general_freq) / math.log1p(self.FREQ_SATURATION), 1.0)
        gt_freq = self.gt_frequency_counts.get(_norm(candidate), 0)
        gt_freq_score = min(gt_freq / 5.0, 1.0)
        freq_score = 0.8 * general_freq_score + 0.2 * gt_freq_score

        dist = confusion_aware_distance(original, candidate)
        max_len = max(len(_tamil_graphemes(original)), len(_tamil_graphemes(candidate)), 1)
        similarity_score = max(0.0, 1.0 - (dist / max_len))

        if htr_confidence is not None:
            weights = {"lexicon": 0.10, "freq": 0.35, "similarity": 0.30, "htr": 0.25}
            score = (
                weights["lexicon"] * lexicon_score
                + weights["freq"] * freq_score
                + weights["similarity"] * similarity_score
                + weights["htr"] * (1.0 - htr_confidence)
            )
        else:
            weights = {"lexicon": 0.15, "freq": 0.45, "similarity": 0.40}
            score = (
                weights["lexicon"] * lexicon_score
                + weights["freq"] * freq_score
                + weights["similarity"] * similarity_score
            )
        return score
