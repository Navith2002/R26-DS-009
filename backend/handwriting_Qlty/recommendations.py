"""
recommendations.py
==================

Language-aware Stage 2 handwriting-improvement recommendations.

The ML model decides the final quality class. This file converts already
validated feature-level issues into a small set of child-friendly practice
priorities. By default only the top 3 priorities are returned.
"""

COMMON_RECOMMENDATIONS = {
    "spacing": [
        "Try keeping a similar gap between each word.",
        "Use a small spacing guide while practising.",
    ],
    "baseline_alignment": [
        "Try keeping your words on the same writing line.",
        "Use ruled paper or a baseline guide while practising.",
    ],
    "local_baseline_drift": [
        "Keep each word from slowly moving upward or downward.",
        "Practise one short line at a time using a visible baseline.",
    ],
    "slant": [
        "Try keeping the writing angle similar from one word to the next.",
        "Write a little more slowly and check that characters do not lean too differently.",
    ],
    "size_variation": [
        "Try keeping characters about the same height and width.",
        "Use simple writing boxes to practise consistent size.",
    ],
    "curve_smoothness": [
        "Draw rounded parts slowly and smoothly.",
        "Trace a few curved forms first, then write them without tracing.",
    ],
    "loop_roundness": [
        "Practise rounded and loop-like parts with an even shape.",
        "Repeat a few rounded forms while focusing on smooth curves.",
    ],
    "stroke_continuity": [
        "Try to finish each stroke with fewer unnecessary breaks.",
        "Practise smooth continuous pen movement on curved forms.",
    ],
    "stroke_thickness": [
        "Use more even writing pressure.",
        "Avoid pressing very hard in one part and very lightly in another.",
    ],
    "density_distribution": [
        "Keep the inside parts of characters clear instead of crowding strokes together.",
        "Practise balanced spacing between curves, strokes and modifiers.",
    ],
    "character_shape": [
        "Practise repeating the same character forms with a similar overall shape.",
        "Compare each practice character with a clear model example.",
    ],
    "character_proportion": [
        "Try keeping character height-to-width proportions more consistent.",
        "Use writing boxes to practise balanced character proportions.",
    ],
    "upper_lower_balance": [
        "Pay attention to how much of each character sits above and below its middle area.",
        "Practise balanced character forms using a centre guideline.",
    ],
    "character_spacing": [
        "Try keeping neighbouring character regions evenly spaced.",
        "Avoid squeezing some parts together while leaving very large gaps elsewhere.",
    ],
    "word_spacing": [
        "Keep the gaps between words similar across the whole line.",
        "Use a small spacing guide between words during practice.",
    ],
}

SINHALA_OVERRIDES = {
    "curve_smoothness": [
        "Practise Sinhala rounded strokes slowly and smoothly.",
        "Repeat circular Sinhala forms while keeping the movement continuous.",
    ],
    "character_shape": [
        "Practise Sinhala character forms using clear model examples.",
        "Compare the roundness and main structural parts after each repetition.",
    ],
}

TAMIL_OVERRIDES = {
    "curve_smoothness": [
        "Practise Tamil curved strokes slowly and smoothly.",
        "Repeat curved Tamil forms while keeping the pen movement continuous.",
    ],
    "loop_roundness": [
        "Practise rounded Tamil character forms with an even curve.",
        "Trace and repeat loop-like structures before writing them freely.",
    ],
}


def _deduplicate(items):
    return list(dict.fromkeys(items))


def generate_recommendations(
    issues,
    language="sinhala",
    max_priorities=3,
):
    """
    Return at most max_priorities structured practice priorities.

    issue_detection.py already sorts issues by severity, so the first three
    represent the most important child-facing practice targets.
    """
    language = str(language).strip().lower()

    overrides = (
        SINHALA_OVERRIDES
        if language == "sinhala"
        else TAMIL_OVERRIDES
    )

    result = []

    for issue in issues or []:
        if len(result) >= int(max_priorities):
            break

        issue_type = issue.get(
            "type",
            "",
        )

        suggestions = (
            overrides.get(issue_type)
            or COMMON_RECOMMENDATIONS.get(
                issue_type
            )
        )

        if not suggestions:
            continue

        suggestions = _deduplicate(
            suggestions
        )

        result.append(
            {
                "issue_type": issue_type,
                "severity": issue.get("severity"),
                "title": issue.get("title"),
                "primary": (
                    suggestions[0]
                    if suggestions
                    else None
                ),
                "secondary": (
                    suggestions[1]
                    if len(suggestions) > 1
                    else None
                ),
                "recommendations": suggestions[:2],
            }
        )

    return result


def flatten_recommendations(
    structured_recommendations,
):
    """
    Compatibility helper for UIs expecting a short string list.

    Only one primary instruction per top priority is returned.
    """
    output = []

    for item in structured_recommendations or []:
        primary = item.get("primary")

        if primary:
            output.append(primary)

    return _deduplicate(output)
