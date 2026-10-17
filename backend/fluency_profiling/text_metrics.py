"""
text_metrics.py — shared WER/CER/feature-extraction logic.

Used by both main.py (live /assess inference) and audio_pipeline.py
(offline training pipeline) so the two always score audio with the exact
same formulas. Previously these were two separately-maintained copies;
this module is the single source of truth for them.
"""

import unicodedata

import numpy as np
import librosa


def extract_features(y: np.ndarray, sr: int, ground_truth: str = "") -> dict:
    """
    Extract handcrafted audio features for the 4D skill vector.

    Returns:
        duration_s          total clip length
        speech_duration_s   speech-only duration
        hesitation_count    pauses longer than 150ms
        mean_pause_s        average pause duration
        zcr                 zero crossing rate, SPEECH-ONLY (kept for
                             reference/comparison — no longer feeds the
                             fluency dimension or the RF, see chars_per_sec)
        energy_variance     RMS energy variance, speech-only
        chars_per_sec       PRIMARY fluency signal: ground-truth characters
                             (space-stripped, matching CER's methodology)
                             read per second of actual speech. Standard
                             WCPM-style reading-rate metric. Uses
                             speech_duration_s (not total clip duration) so
                             this doesn't double-count pausing, which is
                             already captured separately by hesitation/
                             mean_pause_s — pace and pausing are kept as
                             two distinct signals rather than conflated.

    zcr/energy_variance were previously computed over the ENTIRE raw clip
    including silence/background noise between words, which could dilute
    or inflate them depending on how much dead air a recording had. They
    are now computed on the concatenated speech-only segments instead,
    consistent with how speech_duration_s already worked.

    zcr alone was also found to be a poor fluency proxy on its own: it's a
    spectral/timbral characteristic of the sound during speech, not a
    measure of pace, so it can't detect a reading that took far longer
    than it should while still sounding acoustically ordinary moment-to-
    moment. A recording that was 4x longer than a clean read of the same
    sentence, with hesitation correctly maxed out, still scored a
    near-perfect ZCR-based fluency score — chars_per_sec fixes this by
    measuring duration directly rather than inferring it indirectly.
    """
    duration  = len(y) / sr
    intervals = librosa.effects.split(y, top_db=30)

    pauses = []
    for i in range(1, len(intervals)):
        pause_dur = (intervals[i][0] - intervals[i-1][1]) / sr
        if pause_dur > 0.15:
            pauses.append(pause_dur)

    hesitation_count = len(pauses)
    mean_pause       = float(np.mean(pauses)) if pauses else 0.0
    speech_samples   = sum(end - start for start, end in intervals)
    speech_duration  = speech_samples / sr

    if len(intervals) > 0:
        speech_signal = np.concatenate([y[start:end] for start, end in intervals])
    else:
        speech_signal = y  # no speech detected at all — fall back to whole clip

    zcr              = float(librosa.feature.zero_crossing_rate(speech_signal)[0].mean())
    rms              = librosa.feature.rms(y=speech_signal)[0]
    energy_variance  = float(np.var(rms))

    char_count    = len(ground_truth.replace(" ", ""))
    chars_per_sec = (char_count / speech_duration) if speech_duration > 0 else 0.0

    return {
        "duration_s":        round(duration, 3),
        "speech_duration_s": round(speech_duration, 3),
        "hesitation_count":  hesitation_count,
        "mean_pause_s":      round(mean_pause, 3),
        "zcr":               round(zcr, 4),
        "energy_variance":   round(energy_variance, 6),
        "chars_per_sec":     round(chars_per_sec, 3),
    }


# Groups of Sinhala letters that are acoustically indistinguishable
# (or near-indistinguishable) in modern spoken Sinhala, even though
# they are written differently. Each group maps to a single canonical
# character before comparison, so swaps within a group are NOT counted
# as errors. 'ස' intentionally excluded from the sibilant group.
CONFUSABLE_LETTER_GROUPS = [
    "ලළ",   # la / retroflex ḷa
    "ණන",   # retroflex ṇa / dental na
    "ශෂ",  # śa / ṣa / sa (all → /s/)
    "කඛ",   # ka / kha
    "ගඝ",   # ga / gha
    "චඡ",   # ca / cha
    "ජඣ",   # ja / jha
    "ටඨ",   # ṭa / ṭha
    "ඩඪ",   # ḍa / ḍha
    "තථ",   # ta / tha
    "දධ",   # da / dha
    "පඵ",   # pa / pha
    "බභ",   # ba / bha
]

# Build a str.translate table mapping every letter in a group to the
# group's first letter (the canonical form).
_CONFUSABLE_TRANSLATION_TABLE = str.maketrans({
    ch: group[0]
    for group in CONFUSABLE_LETTER_GROUPS
    for ch in group[1:]
})


def normalize_confusables(text: str) -> str:
    """Map acoustically-confusable Sinhala letters to a canonical form
    so that WER/CER don't penalize swaps between them."""
    return text.translate(_CONFUSABLE_TRANSLATION_TABLE)


def strip_punctuation(text: str) -> str:
    """
    Remove all punctuation characters so that Whisper's punctuation
    choices (question marks, periods, commas, quotes, dashes, etc. —
    stylistic artifacts of transcription, not part of what a child
    actually read aloud) are never scored as reading errors.

    Uses Unicode category rather than a hand-picked character list:
    every punctuation character in Unicode falls under a category
    starting with 'P' (Pc/Pd/Pe/Pf/Pi/Po/Ps — connectors, dashes,
    brackets, quotes, everything else), so this catches all of it
    without needing to be extended for characters not thought of in
    advance. Sinhala combining marks (vowel signs, virama/hal kirima,
    anusvara) are category 'M', not 'P', so they are correctly left
    untouched — they're part of the letters themselves.
    """
    return "".join(ch for ch in text if not unicodedata.category(ch).startswith("P"))


def clean_char_length(text: str) -> int:
    """
    Character count of `text` after the same normalization calculate_cer
    applies before comparing (confusable-letter canonicalization,
    punctuation stripped, spaces stripped). Shared so anything that needs
    "how many real letters are in this string" — CER itself, the
    mismatch gate below, or a chars_per_sec calculation — all count
    characters the exact same way.
    """
    return len(normalize_confusables(strip_punctuation(text)).replace(" ", ""))


def calculate_wer(reference: str, hypothesis: str) -> float:
    """
    Word Error Rate using dynamic programming.
    WER = (substitutions + deletions + insertions) / total reference words
    Returns value between 0.0 and 1.0

    Punctuation is stripped and acoustically-confusable Sinhala letters
    are normalized to a canonical form first (see strip_punctuation and
    CONFUSABLE_LETTER_GROUPS), so neither contributes to the error count.

    Kept for reference/reporting only — CER is what feeds the Random
    Forest and the accuracy dimension of the skill vector.
    """
    reference  = normalize_confusables(strip_punctuation(reference))
    hypothesis = normalize_confusables(strip_punctuation(hypothesis))

    ref = reference.strip().split()
    hyp = hypothesis.strip().split()
    r, h = len(ref), len(hyp)

    if r == 0:
        return 0.0

    d = np.zeros((r + 1, h + 1), dtype=int)
    for i in range(r + 1): d[i][0] = i
    for j in range(h + 1): d[0][j] = j

    for i in range(1, r + 1):
        for j in range(1, h + 1):
            if ref[i-1] == hyp[j-1]:
                d[i][j] = d[i-1][j-1]
            else:
                d[i][j] = 1 + min(d[i-1][j], d[i][j-1], d[i-1][j-1])

    return round(min(d[r][h] / r, 1.0), 4)


# A reading only trips the mismatch gate below when BOTH hold: essentially
# no reference word was transcribed correctly, AND the hypothesis is a very
# different length from the reference. WER alone isn't enough on its own --
# a short sentence with one genuine misread word can also hit WER 1.0 -- but
# that case keeps a length_ratio close to 1.0 (same sentence, same rough
# length), so it does NOT trigger the gate and CER's partial credit for it
# is kept.
MISMATCH_WER_THRESHOLD    = 0.95
MISMATCH_LENGTH_RATIO_MAX = 0.75


def effective_cer_for_scoring(reference: str, hypothesis: str,
                               cer: float, wer: float) -> float:
    """
    CER on its own is an unreliable "was this even the right sentence"
    signal for Sinhala. calculate_cer operates on raw Unicode codepoints,
    and Sinhala spells each letter as a base consonant plus a *separate*
    vowel-sign codepoint, drawn from a small, heavily-reused alphabet. Two
    completely unrelated short sentences will often share several of these
    codepoints by pure chance, so Levenshtein alignment gives CER partial
    credit it shouldn't -- e.g. a 16-codepoint reference and a 9-codepoint
    hypothesis for a totally different sentence can still score ~19%
    "accurate" even though not a single word was read.

    WER doesn't have this problem (it already reports 100% for an
    unrelated reading, since it compares whole words) but is too coarse to
    use as the primary, everyday accuracy metric -- a single mistyped
    vowel sign fails an entire word, throwing away CER's finer-grained
    partial credit for near-misses that real students produce constantly.

    So: keep trusting CER's partial credit for ordinary misreadings, but
    once WER says essentially no reference word was read correctly AND the
    hypothesis length is wildly different from the reference's (the
    hallmark of a different sentence entirely, not noisy transcription of
    the same one), report full error instead -- there's no reasonable
    sense in which that reading was "mostly accurate".

    Used only for the scores shown/derived for the user (skill_4d accuracy,
    cluster/profile assignment) -- the raw `cer` returned in the API
    response for the CER% display stays untouched, so the UI keeps
    reporting the true character-level distance alongside the corrected
    accuracy score.
    """
    if wer < MISMATCH_WER_THRESHOLD:
        return cer

    ref_len, hyp_len = clean_char_length(reference), clean_char_length(hypothesis)
    longer, shorter = max(ref_len, hyp_len), min(ref_len, hyp_len)
    if longer == 0:
        return cer

    length_ratio = shorter / longer
    if length_ratio <= MISMATCH_LENGTH_RATIO_MAX:
        return 1.0

    return cer


def calculate_cer(reference: str, hypothesis: str) -> float:
    """
    Character Error Rate — PRIMARY accuracy metric. Same edit-distance
    approach as calculate_wer, but at the character level with spaces
    stripped from both strings first. Stripping spaces means word-
    boundary/segmentation differences (e.g. Whisper splitting one
    ground-truth word into two, or merging two into one) are NOT counted
    as errors, while genuine letter-level substitutions/insertions/
    deletions still are.

    Same punctuation-stripping and confusable-letter normalization as
    calculate_wer is applied first, for consistency.

    Returns value between 0.0 and 1.0
    """
    reference  = normalize_confusables(strip_punctuation(reference)).replace(" ", "")
    hypothesis = normalize_confusables(strip_punctuation(hypothesis)).replace(" ", "")

    r, h = len(reference), len(hypothesis)

    if r == 0:
        return 0.0

    d = np.zeros((r + 1, h + 1), dtype=int)
    for i in range(r + 1): d[i][0] = i
    for j in range(h + 1): d[0][j] = j

    for i in range(1, r + 1):
        for j in range(1, h + 1):
            if reference[i-1] == hypothesis[j-1]:
                d[i][j] = d[i-1][j-1]
            else:
                d[i][j] = 1 + min(d[i-1][j], d[i][j-1], d[i-1][j-1])

    return round(min(d[r][h] / r, 1.0), 4)
