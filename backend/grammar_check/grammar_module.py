"""
grammar_module.py
"""
from __future__ import annotations

import os
import re
import json
from typing import Optional
SENTENCE_END_CHARS = ".!?।"
_SPLIT_RE = re.compile(r"([.!?।])")

GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")

# STEP 1 — SENTENCE ASSEMBLY (deterministic, no LLM)

def _split_line_into_segments(text: str) -> list[tuple[str, bool]]:
    """
    Split ONE line into (segment_text, terminated) pieces.

    A line can contain zero, one, or several complete sentences:
      "අද පාසල ගියෙමි. මම නවතම යාළුවෙක් හම්බුනා"
        -> [("අද පාසල ගියෙමි.", True), ("මම නවතම යාළුවෙක් හම්බුනා", False)]

    `terminated=True` means this piece ends a sentence right here.
    `terminated=False` means this piece is a fragment that should be
    carried over and joined with the next line.
    """
    parts = _SPLIT_RE.split(text)
    segments: list[tuple[str, bool]] = []
    i = 0
    while i < len(parts):
        chunk = parts[i].strip()
        if i + 1 < len(parts) and parts[i + 1] in SENTENCE_END_CHARS:
            if chunk:
                segments.append((chunk + parts[i + 1], True))
            i += 2
        else:
            if chunk:
                segments.append((chunk, False))
            i += 1
    return segments


def _line_text(line: dict) -> str:
    return (line.get("corrected_text") or line.get("raw_text") or "").strip()


# A merged "sentence" built from this many words or more, with no terminal
# punctuation ever found along the way, is flagged (not rewritten) as a
# likely missing-punctuation boundary — see the note in assemble_sentences.
_LONG_UNTERMINATED_WORD_THRESHOLD = 20


def _page_is_dictation(lines: list[dict]) -> bool:
    """
    Page-level decision: is this page running prose (lines are fragments of
    connected sentences that should be stitched together) or a dictation /
    word-list page (every line is one independent word, e.g. a spelling
    dictation exercise)?

    Heuristic, applied to the WHOLE page at once:
      - every non-empty line has exactly one word  -> dictation
      - ANY line has two or more words              -> prose

    Deliberately page-wide rather than per-line: a page is either a
    dictation exercise or a writing exercise, never a mix of the two, so
    one stray single-word line on an otherwise prose page (e.g. a title)
    should NOT flip that page into "never combine" mode, and one stray
    multi-word line on an otherwise dictation page IS the signal that this
    is actually prose after all.
    """
    counts = [len(_line_text(l).split()) for l in lines if _line_text(l)]
    if not counts:
        return False
    return all(c <= 1 for c in counts)


def _assemble_dictation(lines: list[dict]) -> list[dict]:
    """
    Dictation-page assembly: one line stays exactly one entry, always.
    Never merged into neighbouring lines (each line is an independent
    word/answer — punctuation, or the lack of it, is irrelevant here) and
    never split (nothing to split when a line is a single token).
    """
    sentences = []
    for line in lines:
        text = _line_text(line)
        if not text:
            continue
        sentences.append({
            "text":         text,
            "source_lines": [line.get("line_idx")],
            "is_combined":  False,
            "word_count":   len(text.split()),
        })
    return sentences


def assemble_sentences(lines: list[dict]) -> list[dict]:
    """
    Turn a list of OCR/corrected lines (in top-to-bottom reading order)
    into a list of complete sentences.

    Input line dicts need: 'line_idx' and 'corrected_text' (falls back to
    'raw_text' if 'corrected_text' is missing).

    First makes ONE page-level decision via _page_is_dictation():
      - dictation page (every line is a single word) -> _assemble_dictation:
        lines are never combined, no matter what punctuation is present.
      - prose page (at least one line has 2+ words) -> the punctuation-
        driven logic below runs across the WHOLE page, handling all three
        cases the project needs:
          - one line == one sentence              -> passed through unchanged
          - one sentence spans two (or more) lines -> merged, is_combined=True
          - one line contains two+ sentences       -> split into separate entries
    """
    if _page_is_dictation(lines):
        return _assemble_dictation(lines)

    buffer = ""
    buffer_lines: list[int] = []
    sentences: list[dict] = []

    def flush(is_final: bool = False) -> None:
        # NOTE: an earlier version of this function deterministically
        # appended a missing "." to the final fragment. Tested against
        # the held-out eval in evaluate_holdout.py and REVERTED: it
        # dropped exact-match from 62.62% to 16.82%. This dataset mixes
        # full sentences with short word/phrase-level exercises that
        # legitimately have no terminal punctuation, so "no punctuation
        # at the end" is not a reliable signal of "missing punctuation
        # error" here — confirms the same "unknown != wrong" caution this
        # whole module is built around, just for punctuation instead of
        # spelling. Left `is_final` as a parameter in case a more
        # targeted version of this (e.g. gated on word_count, or a real
        # sentence-boundary classifier) is worth revisiting later.
        nonlocal buffer, buffer_lines
        text = buffer.strip()
        if text:
            word_count = len(text.split())
            multi_line = len(set(buffer_lines)) > 1
            sentences.append({
                "text":         text,
                "source_lines": list(buffer_lines),
                "is_combined":  multi_line,
                "word_count":   word_count,
                # Hint only — never mutates `text` and never blocks/forces a
                # merge. A sentence built by combining several lines with no
                # sentence-final punctuation ever found along the way, and
                # that has grown unusually long, is suspicious: it may
                # actually be two+ sentences that got run together because
                # the student dropped the full stop between them. Below the
                # threshold this is indistinguishable from a normal long
                # sentence, so it's surfaced as a flag for a
                # teacher/reviewer (or a future LLM boundary check) to look
                # at — not auto-corrected, for the same false-positive
                # reason the deterministic "." insertion above was reverted.
                "possible_missing_punctuation": (
                    multi_line and not is_final
                    and word_count >= _LONG_UNTERMINATED_WORD_THRESHOLD
                ),
            })
        buffer = ""
        buffer_lines = []

    for line in lines:
        idx = line.get("line_idx")
        text = _line_text(line)
        if not text:
            continue

        for seg_text, terminated in _split_line_into_segments(text):
            buffer = f"{buffer} {seg_text}".strip() if buffer else seg_text
            buffer_lines.append(idx)
            if terminated:
                flush()

    # Trailing fragment with no terminating punctuation (common with
    # handwriting — students often skip the final full stop). Keep it as
    # its own sentence rather than dropping the text, and mark it as the
    # FINAL flush so a missing period gets added deterministically.
    flush(is_final=True)

    return sentences


# ─────────────────────────────────────────────────────────────────────────
# STEP 2 — LLM GRAMMAR CORRECTION (only for real sentences, word_count >= 2)
# ─────────────────────────────────────────────────────────────────────────
_GRAMMAR_PROMPT = """You are a Sinhala language teacher checking grade 3-5 student writing.

You will be given Sinhala SENTENCES (already spell-corrected). For each one,
check ONLY grammar: word order, subject-verb agreement, correct connectors
(නමුත්, නිසා, etc.), correct sentence-final verb form. Do NOT rewrite style,
do NOT change meaning, do NOT touch words that are already grammatically fine.
If a sentence is already correct, leave it unchanged and set both
changes_en and changes_si to exactly "no changes".

For each sentence that DID change, give the explanation TWICE, in two steps:

  changes_en: your normal precise technical explanation, in English, using
    proper grammar terms (pronoun, subject-verb agreement, etc.) — exactly
    like you would explain it to another teacher. Be precise and specific.

  changes_si: now translate changes_en for an 8-10 year old Sinhala child.
    Say the SAME reason, but:
      - Sinhala script only. Zero English words or grammar terms.
      - Talk directly to the child ("ඔයා"), warm and simple, 1-2 sentences.
      - Point at the exact word(s) in quotes, explain why simply — do not
        name the grammar category, just describe it in everyday words.

Return ONLY valid JSON, no markdown:
{{
  "sentences": [
    {{"idx": 0, "corrected": "grammar-corrected Sinhala sentence",
      "changes_en": "precise English explanation or 'no changes'",
      "changes_si": "same reason in simple Sinhala for a child, or 'no changes'"}}
  ]
}}

Sentences:
{items}"""

# Safety-net retry prompt: used only when changes_si still contains English
# after the main call. Narrower task (pure translation of already-correct
# reasoning, not "diagnose + explain + translate" all at once) is more
# reliable than re-asking the original combined prompt again.
_RETRANSLATE_PROMPT = """Translate each English sentence below into simple, warm Sinhala
for an 8-10 year old child. Rules:
- Sinhala script only. Do not use ANY English word, including grammar terms
  like "pronoun", "subject", "verb", "redundant", "incorrect".
- If the English uses a grammar term, replace it with a plain everyday
  description instead of translating the term itself.
- Keep any quoted Sinhala words ('...') exactly as they are.
- 1-2 short sentences, talk directly to the child ("ඔයා").

Return ONLY valid JSON, no markdown:
{{"items": [{{"idx": 0, "si": "simple Sinhala translation"}}]}}

English sentences:
{items}"""


def _has_english_leak(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]", text or ""))


def _call_gemini_json(client, model: str, prompt: str) -> dict:
    response = client.models.generate_content(model=model, contents=[prompt])
    raw = response.text.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def correct_grammar(sentences: list[dict], api_key: Optional[str] = None) -> list[dict]:
    """
    Adds 'grammar_note' (child-friendly Sinhala, guaranteed no English) and
    updates 'text' (if the LLM corrected it) for every sentence with
    word_count >= 2. Single-word entries are left untouched — grammar
    correction does not apply to a lone word.

    The LLM is asked for the reason TWICE per sentence — first its normal
    precise English explanation, then a translation of that exact reasoning
    into plain Sinhala for a child (see _GRAMMAR_PROMPT). If the Sinhala
    version still leaks English words, one narrower retranslation-only call
    is made (_RETRANSLATE_PROMPT); if that still fails, a generic Sinhala
    fallback is used so the child never sees English/jargon.

    Mutates and returns the same list.
    """
    key = api_key or GEMINI_KEY
    targets = [(i, s) for i, s in enumerate(sentences) if s["word_count"] >= 2]

    if not targets:
        for s in sentences:
            s.setdefault("grammar_note", "")
        return sentences

    if not key:
        for s in sentences:
            s["grammar_note"] = "" if s["word_count"] < 2 else "grammar check skipped (no LLM API key)"
        return sentences

    try:
        from google import genai
    except ImportError:
        try:
            os.system("pip install google-genai -q")
            from google import genai
        except Exception as e:
            for s in sentences:
                s["grammar_note"] = f"grammar check unavailable: {e}"
            return sentences

    model = "gemini-3.6-flash"
    items_text = "\n".join(f"{i}: {s['text']}" for i, s in targets)

    try:
        client = genai.Client(api_key=key)
        data = _call_gemini_json(client, model, _GRAMMAR_PROMPT.format(items=items_text))
        by_idx = {item["idx"]: item for item in data.get("sentences", [])}

        # Track sentences whose Sinhala explanation still needs fixing.
        needs_retranslate: list[tuple[int, dict, str]] = []  # (i, s, changes_en)

        for i, s in targets:
            item = by_idx.get(i)
            if not item:
                s["grammar_note"] = ""
                s["grammar_note_technical"] = "no response from LLM"
                continue

            corrected = (item.get("corrected") or s["text"]).strip()
            changes_en = (item.get("changes_en") or "no changes").strip()
            changes_si = (item.get("changes_si") or "").strip()

            if corrected and corrected != s["text"]:
                s["raw_before_grammar"] = s["text"]
                s["text"] = corrected

            s["grammar_note_technical"] = changes_en  # kept for your thesis write-up, never shown to the child

            if changes_en.lower() == "no changes":
                s["grammar_note"] = ""
            elif changes_si and not _has_english_leak(changes_si):
                s["grammar_note"] = changes_si
            else:
                needs_retranslate.append((i, s, changes_en))

        # Safety-net pass: retranslate only the sentences that leaked English.
        if needs_retranslate:
            retry_items = "\n".join(f"{i}: {en}" for i, _, en in needs_retranslate)
            try:
                retry_data = _call_gemini_json(client, model, _RETRANSLATE_PROMPT.format(items=retry_items))
                retry_by_idx = {item["idx"]: item.get("si", "") for item in retry_data.get("items", [])}
            except Exception:
                retry_by_idx = {}

            for i, s, changes_en in needs_retranslate:
                si = (retry_by_idx.get(i) or "").strip()
                if si and not _has_english_leak(si):
                    s["grammar_note"] = si
                else:
                    # Final fallback — generic, but guaranteed pure Sinhala.
                    s["grammar_note"] = (
                        "ඔයා ලියපු මේ වාක්‍යයේ එක වචනයක් වෙනස් කරන්න වුණා. "
                        "හේතුව ගුරුතුමා හෝ ගුරුතුමිය ගෙන් අහන්න."
                    )

    except Exception as e:
        for i, s in targets:
            s["grammar_note"] = f"grammar check failed: {str(e)[:80]}"

    for s in sentences:
        s.setdefault("grammar_note", "")

    return sentences


# ─────────────────────────────────────────────────────────────────────────
# PUBLIC ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────
def build_sentences(lines: list[dict], api_key: Optional[str] = None) -> list[dict]:
    """
    Full grammar-module pipeline: assemble sentences from OCR lines, then
    grammar-correct every sentence with 2+ words.
    """
    sentences = assemble_sentences(lines)
    return correct_grammar(sentences, api_key=api_key)


if __name__ == "__main__":
    # Quick manual test — no API key needed to see sentence assembly.
    demo_lines = [
        {"line_idx": 0, "corrected_text": "අද මම පාසලට ගොස්"},
        {"line_idx": 1, "corrected_text": "මිතුරන් සමඟ ක්‍රීඩා කලෙමි."},
        {"line_idx": 2, "corrected_text": "එය ඉතා සතුටුදායක දිනයක් විය. මට හෙට පාසල් නැත"},
    ]
    for s in assemble_sentences(demo_lines):
        print(s)
