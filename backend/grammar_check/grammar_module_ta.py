"""
grammar_module_ta.py
Tamil counterpart of grammar_module.py. The sentence-assembly logic
(_page_is_dictation / _assemble_dictation / assemble_sentences, including
the dictation-vs-prose gate and the possible_missing_punctuation hint) is
entirely script-agnostic, so it's copied verbatim -- the only real
difference in this file is the LLM prompt text (asks for Tamil instead of
Sinhala) and the generic Tamil fallback message. Kept as a separate file
rather than a language flag on grammar_module.py so nothing here can
affect the Sinhala flow.
"""
from __future__ import annotations

import os
import re
import json
from typing import Optional

SENTENCE_END_CHARS = ".!?।"
_SPLIT_RE = re.compile(r"([.!?।])")

# Same GEMINI_API_KEY env var as grammar_module.py and pipeline.py -- set
# it once, every module picks it up. See grammar_module.py's GEMINI_KEY
# comment for why this can't just be pipeline.py's constant alone.
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")

# ─────────────────────────────────────────────────────────────────────────
# STEP 1 — SENTENCE ASSEMBLY (deterministic, no LLM) — identical to
# grammar_module.py, script-agnostic.
# ─────────────────────────────────────────────────────────────────────────
def _split_line_into_segments(text: str) -> list[tuple[str, bool]]:
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


_LONG_UNTERMINATED_WORD_THRESHOLD = 20


def _page_is_dictation(lines: list[dict]) -> bool:
    counts = [len(_line_text(l).split()) for l in lines if _line_text(l)]
    if not counts:
        return False
    return all(c <= 1 for c in counts)


def _assemble_dictation(lines: list[dict]) -> list[dict]:
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
    """See grammar_module.assemble_sentences() -- identical logic, page-
    level dictation/prose gate first, then punctuation-driven sentence
    assembly for prose pages."""
    if _page_is_dictation(lines):
        return _assemble_dictation(lines)

    buffer = ""
    buffer_lines: list[int] = []
    sentences: list[dict] = []

    def flush(is_final: bool = False) -> None:
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

    flush(is_final=True)

    return sentences


# ─────────────────────────────────────────────────────────────────────────
# STEP 2 — LLM GRAMMAR CORRECTION (only for real sentences, word_count >= 2)
# ─────────────────────────────────────────────────────────────────────────
_GRAMMAR_PROMPT = """You are a Tamil language teacher checking grade 3-5 student writing.

You will be given Tamil SENTENCES (already spell-corrected). For each one,
check ONLY grammar: word order, subject-verb agreement, correct connectors
(ஆனால், ஏனெனில், etc.), correct sentence-final verb form. Do NOT rewrite
style, do NOT change meaning, do NOT touch words that are already
grammatically fine. If a sentence is already correct, leave it unchanged
and set both changes_en and changes_si to exactly "no changes".

For each sentence that DID change, give the explanation TWICE, in two steps:

  changes_en: your normal precise technical explanation, in English, using
    proper grammar terms (pronoun, subject-verb agreement, etc.) — exactly
    like you would explain it to another teacher. Be precise and specific.

  changes_si: now translate changes_en for an 8-10 year old Tamil child.
    Say the SAME reason, but:
      - Tamil script only. Zero English words or grammar terms.
      - Talk directly to the child ("நீ"), warm and simple, 1-2 sentences.
      - Point at the exact word(s) in quotes, explain why simply — do not
        name the grammar category, just describe it in everyday words.

Return ONLY valid JSON, no markdown:
{{
  "sentences": [
    {{"idx": 0, "corrected": "grammar-corrected Tamil sentence",
      "changes_en": "precise English explanation or 'no changes'",
      "changes_si": "same reason in simple Tamil for a child, or 'no changes'"}}
  ]
}}

Sentences:
{items}"""

# Safety-net retry prompt: used only when changes_si still contains English
# after the main call.
_RETRANSLATE_PROMPT = """Translate each English sentence below into simple, warm Tamil
for an 8-10 year old child. Rules:
- Tamil script only. Do not use ANY English word, including grammar terms
  like "pronoun", "subject", "verb", "redundant", "incorrect".
- If the English uses a grammar term, replace it with a plain everyday
  description instead of translating the term itself.
- Keep any quoted Tamil words ('...') exactly as they are.
- 1-2 short sentences, talk directly to the child ("நீ").

Return ONLY valid JSON, no markdown:
{{"items": [{{"idx": 0, "si": "simple Tamil translation"}}]}}

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
    """Same contract as grammar_module.correct_grammar() -- adds
    'grammar_note' (kept as this key, not 'grammar_note_ta', so
    dashboard.html needs zero changes to render either language's note)."""
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

        needs_retranslate: list[tuple[int, dict, str]] = []

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

            s["grammar_note_technical"] = changes_en

            if changes_en.lower() == "no changes":
                s["grammar_note"] = ""
            elif changes_si and not _has_english_leak(changes_si):
                s["grammar_note"] = changes_si
            else:
                needs_retranslate.append((i, s, changes_en))

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
                    # Final fallback — generic, but guaranteed pure Tamil.
                    s["grammar_note"] = (
                        "நீ எழுதிய இந்த வாக்கியத்தில் ஒரு வார்த்தை மாற்றப்பட்டது. "
                        "காரணத்தை ஆசிரியரிடம் கேள்."
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
    sentences = assemble_sentences(lines)
    return correct_grammar(sentences, api_key=api_key)


if __name__ == "__main__":
    demo_lines = [
        {"line_idx": 0, "corrected_text": "இன்று நான் பள்ளிக்கு சென்று"},
        {"line_idx": 1, "corrected_text": "நண்பர்களுடன் விளையாடினேன்."},
        {"line_idx": 2, "corrected_text": "அது மிகவும் மகிழ்ச்சியான நாளாக இருந்தது. நாளை பள்ளி இல்லை"},
    ]
    for s in assemble_sentences(demo_lines):
        print(s)
