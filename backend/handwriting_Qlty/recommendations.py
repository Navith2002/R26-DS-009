"""
recommendations.py
==================

Generate personalized handwriting-improvement recommendations from the
validated handwriting issues returned by issue_detection.py.

IMPORTANT ARCHITECTURE
----------------------
This module DOES NOT:

    - classify handwriting quality
    - change the ML prediction
    - calculate Good / Average / Poor
    - validate teacher thresholds again
    - reject issues because of weak correlation
    - invent handwriting weaknesses

The calibrated ML model remains the ONLY source of truth for the final
handwriting-quality class:

    Very Good
    Good
    Average
    Below Average
    Poor

Flow
----
ML model
    -> final quality class

issue_detection.py
    -> teacher-grounded detected weaknesses

recommendations.py
    -> kid-friendly improvement guidance
    -> practice-focus routing

If issue_detection.py returns no issues, this module returns [].
"""


# =====================================================================
# PRIORITY CONFIGURATION
# =====================================================================

SEVERITY_RANK = {
    "high": 3,
    "medium": 2,
    "low": 1,
}


# Reliability is only used to order recommendations.
#
# IMPORTANT:
# weak reliability DOES NOT cause a recommendation to be removed.
RELIABILITY_RANK = {
    "strong": 4,
    "moderate": 3,
    "unknown": 2,
    "weak": 1,
}


# =====================================================================
# PRACTICE FOCUS
# =====================================================================
#
# These values should correspond to activities available in
# PracticePage.jsx.
# =====================================================================

PRACTICE_FOCUS = {

    "spacing":
        "spacing",

    "word_spacing":
        "spacing",

    "character_spacing":
        "character_spacing",

    "baseline_alignment":
        "baseline_alignment",

    "local_baseline_drift":
        "local_baseline_drift",

    "size_variation":
        "size_variation",

    "character_proportion":
        "character_proportion",

    "curve_smoothness":
        "curve_smoothness",

    "loop_roundness":
        "loop_roundness",

    "stroke_continuity":
        "stroke_continuity",

    "stroke_thickness":
        "stroke_thickness",

    "density_distribution":
        "density_distribution",

    "character_shape":
        "character_shape",

    "upper_lower_balance":
        "upper_lower_balance",

    "slant":
        "slant",

    "general":
        "general",
}


# =====================================================================
# RECOMMENDATION LIBRARY
# =====================================================================
#
# Keep these educational and encouraging.
#
# Sinhala/Tamil UI translation should still happen mainly in the
# frontend translation layer.
# =====================================================================

RECOMMENDATION_LIBRARY = {

    # -----------------------------------------------------------------
    # SPACING
    # -----------------------------------------------------------------

    "spacing": {
        "title":
            "Word spacing",

        "child_title":
            "Let's make the word spaces even ↔️",

        "primary":
            "Try to keep a similar space between each word.",

        "secondary":
            "Use a small finger-space as a guide while practising.",
    },

    "word_spacing": {
        "title":
            "Word spacing",

        "child_title":
            "Let's make the word spaces even ↔️",

        "primary":
            "Try to leave a similar space between neighbouring words.",

        "secondary":
            "Pause for a moment after each word before starting the next one.",
    },

    "character_spacing": {
        "title":
            "Character spacing",

        "child_title":
            "Let's give the letters the right space 🔤",

        "primary":
            "Try to keep the spaces between neighbouring characters more even.",

        "secondary":
            "Avoid putting characters too close together or too far apart.",
    },


    # -----------------------------------------------------------------
    # BASELINE / ALIGNMENT
    # -----------------------------------------------------------------

    "baseline_alignment": {
        "title":
            "Writing on the line",

        "child_title":
            "Let's keep the words on the line 📏",

        "primary":
            "Try to keep your words sitting on the same writing line.",

        "secondary":
            "Practise slowly on ruled paper and use the line as your guide.",
    },

    "local_baseline_drift": {
        "title":
            "Keeping the writing line steady",

        "child_title":
            "Let's keep the writing line steady 🛣️",

        "primary":
            "Try to keep each line of writing moving straight across the page.",

        "secondary":
            "Follow the ruled line so your writing does not slowly move up or down.",
    },


    # -----------------------------------------------------------------
    # SIZE / PROPORTIONS
    # -----------------------------------------------------------------

    "size_variation": {
        "title":
            "Letter size",

        "child_title":
            "Let's make the letters a similar size 🔠",

        "primary":
            "Try to make similar characters about the same size.",

        "secondary":
            "Use ruled lines or writing boxes to practise keeping their height even.",
    },

    "character_proportion": {
        "title":
            "Character proportions",

        "child_title":
            "Let's keep the character shapes balanced 📐",

        "primary":
            "Try to keep the height and width of similar characters balanced.",

        "secondary":
            "Practise the same character inside equal-sized writing boxes.",
    },


    # -----------------------------------------------------------------
    # CURVES / LOOPS
    # -----------------------------------------------------------------

    "curve_smoothness": {
        "title":
            "Smooth curves",

        "child_title":
            "Let's make the curves smoother 〰️",

        "primary":
            "Practise making curved parts slowly and smoothly.",

        "secondary":
            "Trace simple curved shapes before practising full characters.",
    },

    "loop_roundness": {
        "title":
            "Round shapes and loops",

        "child_title":
            "Let's practise smooth round shapes ⭕",

        "primary":
            "Try to make rounded parts smooth and clearly formed.",

        "secondary":
            "Practise circles and loop-shaped strokes before writing full characters.",
    },


    # -----------------------------------------------------------------
    # STROKES
    # -----------------------------------------------------------------

    "stroke_continuity": {
        "title":
            "Continuous strokes",

        "child_title":
            "Let's finish each stroke smoothly ✏️",

        "primary":
            "Try to complete each stroke smoothly without unnecessary breaks.",

        "secondary":
            "Practise slow continuous tracing movements before writing the full character.",
    },

    "stroke_thickness": {
        "title":
            "Consistent strokes",

        "child_title":
            "Let's keep the strokes even 🖊️",

        "primary":
            "Try to keep your writing strokes more even.",

        "secondary":
            "Use gentle and steady pencil pressure while practising.",
    },


    # -----------------------------------------------------------------
    # DENSITY
    # -----------------------------------------------------------------

    "density_distribution": {
        "title":
            "Balanced character structure",

        "child_title":
            "Let's give each part enough room ✨",

        "primary":
            "Try to keep the parts inside each character evenly arranged.",

        "secondary":
            "Write slowly and give every part of the character enough room.",
    },


    # -----------------------------------------------------------------
    # CHARACTER FORMATION
    # -----------------------------------------------------------------

    "character_shape": {
        "title":
            "Character shape",

        "child_title":
            "Let's make the character shape clearer 👀",

        "primary":
            "Try to make the same character look similar each time you write it.",

        "secondary":
            "Practise one character several times and compare its overall shape.",
    },

    "upper_lower_balance": {
        "title":
            "Character balance",

        "child_title":
            "Let's balance the top and bottom ⚖️",

        "primary":
            "Try to keep the upper and lower parts of each character balanced.",

        "secondary":
            "Use guide lines to practise where the top and bottom parts should sit.",
    },


    # -----------------------------------------------------------------
    # SLANT
    # -----------------------------------------------------------------

    "slant": {
        "title":
            "Writing direction",

        "child_title":
            "Let's keep the letters leaning the same way 📐",

        "primary":
            "Try to keep your characters leaning in a similar direction.",

        "secondary":
            "Practise slowly with simple guide lines.",
    },


    # -----------------------------------------------------------------
    # SAFE FALLBACK
    # -----------------------------------------------------------------

    "general": {
        "title":
            "Handwriting practice",

        "child_title":
            "Let's practise this together 🌱",

        "primary":
            "Practise this handwriting area slowly and carefully.",

        "secondary":
            "Focus on one small improvement at a time.",
    },
}


# =====================================================================
# NORMALIZATION HELPERS
# =====================================================================

def _normalize_issue_type(issue):
    """
    Get a canonical issue type.

    issue_detection.py normally returns issue_type already.
    Aliases are kept only for compatibility with older results.
    """

    if not isinstance(
        issue,
        dict,
    ):
        return "general"

    issue_type = (
        issue.get("issue_type")
        or issue.get("type")
        or issue.get("feature")
        or "general"
    )

    issue_type = str(
        issue_type
    ).strip().lower()

    aliases = {

        "spacing_std":
            "spacing",

        "word_spacing_variation":
            "word_spacing",

        "character_spacing_variation":
            "character_spacing",

        "baseline_std":
            "baseline_alignment",

        "avg_slant":
            "slant",

        "avg_size_variation":
            "size_variation",

        "character_proportion_variation":
            "character_proportion",

        "character_shape_consistency":
            "character_shape",

        "stroke_thickness_consistency":
            "stroke_thickness",
    }

    return aliases.get(
        issue_type,
        issue_type,
    )


def _normalize_severity(value):
    """
    Normalize severity from issue_detection.py.
    """

    severity = str(
        value or "low"
    ).strip().lower()

    if severity not in {
        "high",
        "medium",
        "low",
    }:
        return "low"

    return severity


def _normalize_reliability(value):
    """
    Normalize explanation reliability.

    Weak reliability is NOT rejected.
    """

    reliability = str(
        value or "unknown"
    ).strip().lower()

    if reliability not in {
        "strong",
        "moderate",
        "weak",
        "unknown",
    }:
        return "unknown"

    return reliability


# =====================================================================
# CHILD PRIORITY TEXT
# =====================================================================

def _priority_hint(
    severity,
    reliability,
):
    """
    Child-friendly action text.

    Reliability is deliberately NOT exposed directly to children.
    """

    if severity == "high":

        return (
            "Let's practise this first ⭐"
        )

    if severity == "medium":

        return (
            "Let's work on this ✏️"
        )

    return (
        "A small thing to improve 🌱"
    )


# =====================================================================
# RECOMMENDATION SORTING
# =====================================================================

def _issue_priority(issue):
    """
    Rank detected issues.

    Priority order:
        1. severity
        2. reliability
        3. issue_detection priority score

    No issue is rejected because reliability is weak.
    """

    if not isinstance(
        issue,
        dict,
    ):

        return (
            0,
            0,
            0.0,
        )

    severity = _normalize_severity(
        issue.get(
            "severity"
        )
    )

    reliability = _normalize_reliability(
        issue.get(
            "reliability"
        )
    )

    try:

        technical_priority = float(
            issue.get(
                "priority_score",
                0.0,
            )
        )

    except Exception:

        technical_priority = 0.0

    return (

        SEVERITY_RANK.get(
            severity,
            0,
        ),

        RELIABILITY_RANK.get(
            reliability,
            0,
        ),

        technical_priority,
    )


# =====================================================================
# BUILD ONE RECOMMENDATION
# =====================================================================

def build_recommendation(
    issue,
    language="en",
):
    """
    Convert one issue already validated by issue_detection.py into a
    recommendation.

    IMPORTANT:
    This function performs NO teacher-threshold validation.
    """

    if not isinstance(
        issue,
        dict,
    ):
        return None

    issue_type = _normalize_issue_type(
        issue
    )

    severity = _normalize_severity(
        issue.get(
            "severity"
        )
    )

    reliability = _normalize_reliability(
        issue.get(
            "reliability"
        )
    )

    content = RECOMMENDATION_LIBRARY.get(
        issue_type,
        RECOMMENDATION_LIBRARY["general"],
    )

    practice_focus = PRACTICE_FOCUS.get(
        issue_type,
        "general",
    )

    return {

        # -------------------------------------------------------------
        # Identity
        # -------------------------------------------------------------

        "issue_type":
            issue_type,

        "source_feature":
            issue.get(
                "feature"
            ),

        # -------------------------------------------------------------
        # Priority
        # -------------------------------------------------------------

        "severity":
            severity,

        "reliability":
            reliability,

        "priority_hint":
            _priority_hint(
                severity,
                reliability,
            ),

        # -------------------------------------------------------------
        # Practice routing
        # -------------------------------------------------------------

        "practice_focus":
            practice_focus,

        # -------------------------------------------------------------
        # Recommendation content
        # -------------------------------------------------------------

        "title":
            content["title"],

        "child_title":
            content["child_title"],

        "primary":
            content["primary"],

        "secondary":
            content["secondary"],

        "recommendations": [
            content["primary"],
            content["secondary"],
        ],

        # -------------------------------------------------------------
        # Traceability
        # -------------------------------------------------------------

        "threshold_source":
            issue.get(
                "threshold_source",
                "teacher_calibrated",
            ),

        "teacher_grounded":
            (
                issue.get(
                    "threshold_source"
                )
                == "teacher_calibrated"
            ),

        # Technical values are useful for teacher/research details.
        "teacher_correlation":
            issue.get(
                "spearman_teacher_correlation"
            ),
    }


# =====================================================================
# GENERATE RECOMMENDATIONS
# =====================================================================

def generate_recommendations(
    issues,
    language="en",
    max_priorities=3,
):
    """
    Generate personalized recommendations from detected issues.

    IMPORTANT
    ---------
    issue_detection.py already performed threshold validation.

    This function therefore DOES NOT:

        - check threshold_quality again
        - suppress weak-correlation issues
        - suppress moderate reliability
        - calculate new thresholds
        - change ML quality
        - invent generic weaknesses

    It only:

        - accepts valid issue dictionaries
        - ranks them
        - avoids duplicates
        - returns the top recommendations
    """

    # -----------------------------------------------------------------
    # No issues
    # -----------------------------------------------------------------

    if not isinstance(
        issues,
        list,
    ):
        return []

    if not issues:
        return []

    # -----------------------------------------------------------------
    # Basic structural filtering only
    # -----------------------------------------------------------------

    valid_issues = [
        issue
        for issue in issues
        if isinstance(
            issue,
            dict,
        )
    ]

    if not valid_issues:
        return []

    # -----------------------------------------------------------------
    # Rank issues
    # -----------------------------------------------------------------

    valid_issues.sort(
        key=_issue_priority,
        reverse=True,
    )

    # -----------------------------------------------------------------
    # Avoid duplicate recommendations
    # -----------------------------------------------------------------

    recommendations = []

    seen_issue_types = set()

    for issue in valid_issues:

        issue_type = _normalize_issue_type(
            issue
        )

        if issue_type in seen_issue_types:
            continue

        recommendation = build_recommendation(
            issue,
            language=language,
        )

        if recommendation is None:
            continue

        recommendations.append(
            recommendation
        )

        seen_issue_types.add(
            issue_type
        )

        if (
            len(recommendations)
            >= int(max_priorities)
        ):
            break

    return recommendations


# =====================================================================
# OPTIONAL SUMMARY
# =====================================================================

def recommendation_summary(
    issues,
    language="en",
    max_priorities=3,
):
    """
    Return recommendation information in a structured object.

    Useful for analysis_service.py if required.
    """

    recommendations = generate_recommendations(
        issues=issues,
        language=language,
        max_priorities=max_priorities,
    )

    return {

        "available":
            bool(
                recommendations
            ),

        "count":
            len(
                recommendations
            ),

        "max_priorities":
            int(
                max_priorities
            ),

        "recommendations":
            recommendations,
    }