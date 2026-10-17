"""
llm_recommender.py — LLM-based activity recommendation narration.

Takes the student's 4D skill profile + cluster info + the existing
cosine-similarity shortlist (see main.py's get_recommendations) and asks
Gemini for a short child-friendly feedback paragraph plus which shortlist
activities to lead with and why.

Isolation: this module is only imported by fluency_profiling/main.py. It
uses its own FLUENCY_GEMINI_API_KEY env var, separate from grammar_check's
GEMINI_API_KEY, so the two components never share or contend for a key.

Every failure mode (missing/bad key, network timeout, quota, malformed or
out-of-shortlist response) raises the single LLMRecommendationError below.
Callers should catch just that one type and fall back to the plain
cosine-ranked shortlist — the student must never see a raw error.
"""
from __future__ import annotations

import json
import os
import re
from typing import Optional

# Full Flash, not Lite -- Lite was observed to occasionally mis-form a
# Sinhala word at the character level (wrong consonant/vowel-sign pairing,
# or a stray ASCII punctuation mark mid-word). Still real Sinhala-script
# characters, so the script-ratio check in _check_script below can't catch
# it (that validates script, not spelling) -- the fuller model is simply
# more reliable at the complex-script character composition. This only
# affects this module's own calls on its own FLUENCY_GEMINI_API_KEY; it
# does not share quota, rate limits, or model choice with grammar_check's
# separate GEMINI_API_KEY/model selection.
DEFAULT_MODEL = os.environ.get("FLUENCY_GEMINI_MODEL", "gemini-flash-latest")
# Bumped from an earlier 12000 -- the prompt now asks for a rewritten
# sentence for every shortlist activity (up to 5) instead of just a
# narrowed-down subset, so responses run longer.
REQUEST_TIMEOUT_MS = int(os.environ.get("FLUENCY_GEMINI_TIMEOUT_MS", "18000"))
# Lower than the API default (1.0) -- fewer creative/random token choices
# means fewer of the character-composition slips described above, at the
# cost of slightly more repetitive phrasing across requests. Still has
# enough range for the feedback text and rationales to not read as robotic.
GEN_TEMPERATURE = float(os.environ.get("FLUENCY_GEMINI_TEMPERATURE", "0.5"))
GEN_CONFIG = {
    "automatic_function_calling": {"disable": True},
    "http_options": {"timeout": REQUEST_TIMEOUT_MS},
    "response_mime_type": "application/json",
    "temperature": GEN_TEMPERATURE,
}

_API_KEY_ENV = "FLUENCY_GEMINI_API_KEY"
DEFAULT_LANG = "si"

# The app's own UI toggles between Sinhala and Tamil script (see
# FluencyLanguageContext.jsx's lang: 'si' | 'ta'), so the LLM text must
# follow the same toggle instead of defaulting to one language. Each entry
# gives the model an explicit Unicode range to target (free-form "write in
# Sinhala" instructions were observed to drift into Romanized/transliterated
# text -- see LANG_SCRIPT_RANGES / _script_ratio below, which rejects that).
LANG_INFO = {
    "si": {
        "name": "Sinhala",
        "script_note": (
            "Write ONLY in Sinhala script (Unicode range U+0D80-U+0DFF). "
            "Never use English letters or Romanized/transliterated Sinhala "
            "('Singlish') under any circumstance."
        ),
        "example": "ඔබ හොඳින් කියවනවා! මීළඟට වේගය වැඩි කරගැනීමට පුරුදු වෙමු.",
    },
    "ta": {
        "name": "Tamil",
        "script_note": (
            "Write ONLY in Tamil script (Unicode range U+0B80-U+0BFF). "
            "Never use English letters or Romanized/transliterated Tamil "
            "under any circumstance."
        ),
        "example": "நீங்கள் நன்றாக படிக்கிறீர்கள்! அடுத்து வேகத்தை அதிகரிக்க பயிற்சி செய்வோம்.",
    },
}

# Unicode block each language's feedback/rationale text must mostly fall in
# -- used by _script_ratio to catch a model that ignored LANG_INFO's
# script_note and replied in Romanized/Latin script instead.
LANG_SCRIPT_RANGES = {
    "si": (0x0D80, 0x0DFF),
    "ta": (0x0B80, 0x0BFF),
}
MIN_SCRIPT_RATIO = 0.6  # majority of alphabetic characters must be in-script

_PROMPT = """You are a warm, encouraging reading coach for a child learning to \
read {lang_name}. Based on this child's reading assessment, write a short \
feedback paragraph and pick activities for them to practice next.

{script_note}
Example of the expected style and script: "{example}"
{already_said_block}

Skill profile (0.0 to 1.0, higher is better for overall_accuracy and \
fluency; higher is WORSE for hesitation and sentence_length_gap):
{skill_4d}

Reader cluster: {profile_name}
Cluster probabilities (how confident the model is; a close split between \
two clusters means the child is borderline between those reading styles): \
{cluster_probs}

Weakest skills this session: {weakest}

Raw accuracy for this recording: word error rate {wer}, character error \
rate {cer} (0.0 = perfect, 1.0 = completely wrong).
{mismatch_block}

Candidate activities (you may ONLY pick from this exact list, by act_id).
Each has a "description" written for a general audience:
{shortlist}

For each activity you pick, read its "description" and REWRITE it (don't \
just add a reason next to it) as ONE short, simple, encouraging sentence \
that combines what the activity is AND why it specifically helps this \
student's weakest skills — a child should be able to read just your one \
sentence and understand both.

Reply with STRICT JSON only, no markdown fences, in exactly this shape:
{{
  "feedback_text": "<2-3 short, warm, child-friendly sentences, in {lang_name} script only>",
  "picks": [
    {{"act_id": "<one of the candidate act_id values above>", "rationale": "<the rewritten single sentence for this activity, in {lang_name} script only>"}}
  ]
}}
Pick at most {top_n} activities, ordered best-first (most helpful for \
this student's weakest skills first). Only use act_id values that appear \
in the candidate list above — never invent one."""


class LLMRecommendationError(Exception):
    """Raised for every failure mode: missing key, network/timeout, quota,
    malformed JSON, or a response that fails validation (including wrong
    script/language). Callers catch this one type and fall back to the
    plain cosine-ranked shortlist."""


def _resolve_lang(context: dict) -> str:
    lang = str(context.get("lang") or DEFAULT_LANG).strip().lower()
    return lang if lang in LANG_INFO else DEFAULT_LANG


def _script_ratio(text: str, lo: int, hi: int) -> float:
    """Fraction of TEXT's alphabetic characters that fall inside the
    [lo, hi] Unicode code point range. Non-alphabetic characters (spaces,
    punctuation, digits) are ignored; an all-non-alphabetic string counts
    as 0.0 (fails validation) rather than vacuously passing."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    in_range = sum(1 for c in letters if lo <= ord(c) <= hi)
    return in_range / len(letters)


def _build_already_said_block(already_said: str) -> str:
    """Tells the model what the student already read in the static,
    cluster-keyed frontend description (see CLUSTER_ALREADY_SAID in
    main.py), so feedback_text adds something new instead of repeating the
    same general sentiment the student is about to see elsewhere on the
    results page. Empty when main.py has no gloss for this cluster."""
    already_said = (already_said or "").strip()
    if not already_said:
        return ""
    return (
        f'The student will also see this general note about their reading '
        f'style elsewhere on the page: "{already_said}". Do NOT repeat that '
        f"same statement or phrasing. Instead, write something NEW — "
        f"concrete encouragement tied to today's specific numbers below, "
        f"or a forward-looking next-step tip."
    )


def _build_mismatch_block(mismatch_detected: bool) -> str:
    """Tells the model plainly when the recording didn't match the
    expected sentence at all (main.py's mismatch_detected flag), so
    feedback_text can name that as the actual problem in simple words
    instead of giving generic encouragement that ignores it -- the
    accuracy numbers above already reflect the mismatch, but the model
    has no way to know *why* accuracy is low without this."""
    if not mismatch_detected:
        return ""
    return (
        "IMPORTANT: this recording did not match the expected sentence at "
        "all (the child read something different, or the recording was "
        "unclear). Gently and simply tell the child that what they read "
        "was different from the given sentence, encourage them without "
        "making them feel bad, and tell them to look at the sentence "
        "carefully and read exactly that one again. Still mention any "
        "genuinely good sub-scores (e.g. fluency or hesitation) from the "
        "skill profile above if they are strong, but do NOT praise "
        "accuracy or imply the reading itself was correct."
    )


def _build_prompt(context: dict, top_n: int, lang: str) -> str:
    info = LANG_INFO[lang]
    return _PROMPT.format(
        lang_name=info["name"],
        script_note=info["script_note"],
        example=info["example"],
        already_said_block=_build_already_said_block(context.get("already_said", "")),
        skill_4d=json.dumps(context["skill_4d"], ensure_ascii=False),
        profile_name=context["profile_name"],
        cluster_probs=json.dumps(context.get("cluster_probs", {}), ensure_ascii=False),
        weakest=json.dumps(context["weakest"], ensure_ascii=False),
        wer=context.get("wer", -1),
        cer=context.get("cer", -1),
        mismatch_block=_build_mismatch_block(bool(context.get("mismatch_detected", False))),
        shortlist=json.dumps(
            [
                {
                    "act_id": a["act_id"],
                    "name": a["name"],
                    "target_skill": a["target_skill"],
                    "difficulty": a["difficulty"],
                    "description": a["description"],
                }
                for a in context["shortlist"]
            ],
            ensure_ascii=False,
        ),
        top_n=top_n,
    )


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"^```\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMRecommendationError(f"malformed JSON from Gemini: {exc}") from exc


def _check_script(text: str, lang: str, field: str) -> None:
    lo, hi = LANG_SCRIPT_RANGES[lang]
    ratio = _script_ratio(text, lo, hi)
    if ratio < MIN_SCRIPT_RATIO:
        raise LLMRecommendationError(
            f"{field} failed {lang} script check (ratio={ratio:.2f} < {MIN_SCRIPT_RATIO}): {text!r}"
        )


def _validate(data: dict, valid_act_ids: set, top_n: int, lang: str) -> dict:
    if not isinstance(data, dict):
        raise LLMRecommendationError("response is not a JSON object")

    feedback_text = data.get("feedback_text")
    if not isinstance(feedback_text, str) or not feedback_text.strip():
        raise LLMRecommendationError("missing/empty feedback_text")
    feedback_text = feedback_text.strip()
    _check_script(feedback_text, lang, "feedback_text")

    picks = data.get("picks")
    if not isinstance(picks, list):
        raise LLMRecommendationError("missing/invalid picks list")

    clean_picks = []
    for pick in picks:
        if not isinstance(pick, dict):
            continue
        act_id = pick.get("act_id")
        rationale = pick.get("rationale", "")
        if act_id not in valid_act_ids or not isinstance(rationale, str):
            continue
        rationale = rationale.strip()
        if rationale:
            # A rationale written in the wrong script is dropped rather than
            # failing the whole response -- the activity still shows up
            # (via get_feedback_and_recs' backfill), just without a rationale.
            try:
                _check_script(rationale, lang, "rationale")
            except LLMRecommendationError:
                rationale = ""
        clean_picks.append({"act_id": act_id, "rationale": rationale})

    if not clean_picks:
        raise LLMRecommendationError("no valid picks (all act_ids outside shortlist)")

    return {
        "feedback_text": feedback_text,
        "picks": clean_picks[:top_n],
    }


def get_llm_recommendations(context: dict, top_n: int = 5) -> dict:
    """
    context must contain: skill_4d (dict), profile_name (str), weakest
    (list[str]), shortlist (list[dict] — the existing cosine-ranked
    activities, each with at least act_id/name/target_skill/difficulty/
    description), and optionally cluster_probs (dict of name -> probability),
    wer/cer (float, -1 if unavailable), mismatch_detected (bool — set when
    the recording didn't match the expected sentence at all, so the model
    can name that as the real problem instead of giving feedback that
    quietly assumes the reading was close), and lang ("si" or "ta",
    matching the app's language toggle — defaults to "si" if absent or
    unrecognized).

    Returns {"feedback_text": str, "picks": [{"act_id", "rationale"}, ...]}
    with every act_id guaranteed to be one of context["shortlist"]'s, and
    feedback_text guaranteed to be written in the requested language's
    script (a reply that drifts into Romanized/transliterated text fails
    validation and raises, rather than being passed through).

    Raises LLMRecommendationError on any failure — callers must catch it
    and fall back to the plain shortlist.
    """
    api_key = os.environ.get(_API_KEY_ENV, "").strip()
    if not api_key:
        raise LLMRecommendationError(f"{_API_KEY_ENV} not configured")

    shortlist = context.get("shortlist") or []
    valid_act_ids = {a["act_id"] for a in shortlist}
    if not valid_act_ids:
        raise LLMRecommendationError("empty shortlist — nothing to recommend from")

    lang = _resolve_lang(context)

    try:
        from google import genai
    except ImportError as exc:
        raise LLMRecommendationError(f"google-genai not installed: {exc}") from exc

    try:
        client = genai.Client(api_key=api_key)
        prompt = _build_prompt(context, top_n, lang)
        response = client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=[prompt],
            config=GEN_CONFIG,
        )
        raw_text = response.text
        if not raw_text:
            raise LLMRecommendationError("empty response from Gemini")
        data = _parse_json(raw_text)
        return _validate(data, valid_act_ids, top_n, lang)
    except LLMRecommendationError:
        raise
    except Exception as exc:
        raise LLMRecommendationError(f"Gemini call failed: {exc}") from exc
