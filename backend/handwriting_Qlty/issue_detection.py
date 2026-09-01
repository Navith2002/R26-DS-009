"""
issue_detection.py
==================

Teacher-grounded, language-aware handwriting issue detection.

IMPORTANT ARCHITECTURE
----------------------
The calibrated ML model is the ONLY source of truth for the final
handwriting-quality class:

    Very Good
    Good
    Average
    Below Average
    Poor

This module is ONLY responsible for:

    - detecting handwriting weaknesses
    - explainability
    - personalized recommendations
    - selecting practice focus

Detected issues MUST NEVER modify the ML quality prediction.

Threshold files
---------------
backend/models/Sinhala/sinhala_issue_thresholds.json
backend/models/Tamil/tamil_issue_thresholds.json

Reliability policy
------------------
Hard threshold problems:
    -> suppress that feature

Weak feature-teacher correlation:
    -> DO NOT suppress
    -> mark reliability as weak
    -> allow recommendation system to prioritize stronger evidence first
"""

import json
import os

import numpy as np


# =====================================================================
# PATHS
# =====================================================================

# Current:
# backend/handwriting_Qlty
HANDWRITING_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

# Parent:
# backend
BASE_DIR = os.path.dirname(
    HANDWRITING_DIR
)

# Shared:
# backend/models
MODEL_DIR = os.path.join(
    BASE_DIR,
    "models",
)


# =====================================================================
# CONFIGURATION
# =====================================================================

MIN_PAIRED_ROWS = 30


# Correlation is used ONLY as an explanation-reliability measure.
#
# It does NOT affect the ML classification.
CORRELATION_STRONG = 0.50
CORRELATION_MODERATE = 0.30


SEVERITY_RANK = {
    "high": 3,
    "medium": 2,
    "low": 1,
}


RELIABILITY_RANK = {
    "strong": 4,
    "moderate": 3,
    "unknown": 2,
    "weak": 1,
}


# =====================================================================
# TECHNICAL ISSUE LABELS
# =====================================================================
#
# These are intended for Teacher / Research Details.
#
# The React frontend should convert issue_type into simpler,
# child-friendly Sinhala / Tamil / English wording.
# =====================================================================

FEATURE_TITLES = {

    "spacing_std":
        "Word spacing consistency",

    "baseline_std":
        "Baseline alignment",

    "local_baseline_drift":
        "Local baseline stability",

    "avg_slant":
        "Writing slant",

    "avg_size_variation":
        "Size consistency",

    "curve_smoothness":
        "Curve smoothness",

    "loop_roundness":
        "Loop and roundness formation",

    "stroke_continuity":
        "Stroke continuity",

    "stroke_thickness_consistency":
        "Stroke thickness consistency",

    "density_distribution":
        "Structural density distribution",

    "character_shape_consistency":
        "Character shape consistency",

    "character_proportion_variation":
        "Character proportions",

    "upper_lower_balance":
        "Upper/lower structural balance",

    "character_spacing_variation":
        "Character spacing consistency",

    "word_spacing_variation":
        "Word spacing consistency",
}


FEATURE_MESSAGES = {

    "spacing_std":
        "Word spacing shows noticeable inconsistency.",

    "baseline_std":
        "Writing alignment varies around the expected baseline.",

    "local_baseline_drift":
        "The writing baseline changes noticeably within individual lines.",

    "avg_slant":
        "Writing slant varies noticeably across the sample.",

    "avg_size_variation":
        "Character or word size varies noticeably.",

    "curve_smoothness":
        "Curved handwriting structures show inconsistent smoothness.",

    "loop_roundness":
        "Rounded or loop-like handwriting structures are not consistently formed.",

    "stroke_continuity":
        "Some handwriting strokes appear fragmented or discontinuous.",

    "stroke_thickness_consistency":
        "Stroke thickness varies noticeably across the handwriting.",

    "density_distribution":
        "Ink distribution within handwriting regions is structurally uneven.",

    "character_shape_consistency":
        "Character-region shapes show inconsistent structural formation.",

    "character_proportion_variation":
        "Character height-to-width proportions vary noticeably.",

    "upper_lower_balance":
        "Upper and lower character structures show inconsistent balance.",

    "character_spacing_variation":
        "Spacing between neighbouring character regions varies noticeably.",

    "word_spacing_variation":
        "Spacing between words varies noticeably.",
}


DEFAULT_ISSUE_TYPES = {

    "spacing_std":
        "spacing",

    "baseline_std":
        "baseline_alignment",

    "local_baseline_drift":
        "local_baseline_drift",

    "avg_slant":
        "slant",

    "avg_size_variation":
        "size_variation",

    "curve_smoothness":
        "curve_smoothness",

    "loop_roundness":
        "loop_roundness",

    "stroke_continuity":
        "stroke_continuity",

    "stroke_thickness_consistency":
        "stroke_thickness",

    "density_distribution":
        "density_distribution",

    "character_shape_consistency":
        "character_shape",

    "character_proportion_variation":
        "character_proportion",

    "upper_lower_balance":
        "upper_lower_balance",

    "character_spacing_variation":
        "character_spacing",

    "word_spacing_variation":
        "word_spacing",
}


# =====================================================================
# BASIC HELPERS
# =====================================================================

def _normalize_language(language):

    language = str(
        language or ""
    ).strip().lower()

    if language not in {
        "sinhala",
        "tamil",
    }:
        raise ValueError(
            "Unsupported handwriting language. "
            "Expected 'sinhala' or 'tamil'."
        )

    return language


def _language_folder(language):

    language = _normalize_language(
        language
    )

    folder_name = (
        "Sinhala"
        if language == "sinhala"
        else "Tamil"
    )

    return os.path.join(
        MODEL_DIR,
        folder_name,
    )


def threshold_path(language):

    language = _normalize_language(
        language
    )

    return os.path.join(
        _language_folder(language),
        f"{language}_issue_thresholds.json",
    )


def _finite(value):

    try:

        value = float(value)

        if not np.isfinite(value):
            return None

        return value

    except Exception:
        return None


def _unique_strings(values):

    result = []

    for value in values or []:

        text = str(
            value or ""
        ).strip()

        if (
            text
            and text not in result
        ):
            result.append(text)

    return result


# =====================================================================
# LOAD THRESHOLDS
# =====================================================================

def load_issue_thresholds(language):
    """
    Load teacher-calibrated issue threshold configuration.

    Returns
    -------
    config, path, error
    """

    language = _normalize_language(
        language
    )

    path = threshold_path(
        language
    )

    if not os.path.isfile(path):

        return (
            None,
            path,
            (
                "Teacher-calibrated issue thresholds "
                "are not installed."
            ),
        )

    try:

        with open(
            path,
            "r",
            encoding="utf-8",
        ) as file:

            config = json.load(file)

        if not isinstance(config, dict):

            raise ValueError(
                "Threshold configuration must be a JSON object."
            )

        rules = config.get(
            "features"
        )

        if not isinstance(rules, dict):

            raise ValueError(
                "Threshold configuration does not contain "
                "a valid 'features' object."
            )

        configured_language = str(
            config.get(
                "language",
                language,
            )
        ).strip().lower()

        if configured_language != language:

            raise ValueError(
                "Threshold configuration language "
                "does not match the requested language."
            )

        return (
            config,
            path,
            None,
        )

    except Exception as error:

        return (
            None,
            path,
            str(error),
        )


# =====================================================================
# THRESHOLD HELPERS
# =====================================================================

def _threshold_values(rule):

    return (
        _finite(rule.get("mild")),
        _finite(rule.get("medium")),
        _finite(rule.get("high")),
    )


def _threshold_tolerance(rule):
    """
    Scale-aware tolerance used to detect collapsed thresholds.
    """

    stats = rule.get(
        "feature_statistics",
        {},
    )

    minimum = _finite(
        stats.get("min")
    )

    maximum = _finite(
        stats.get("max")
    )

    if (
        minimum is not None
        and maximum is not None
    ):

        feature_range = abs(
            maximum - minimum
        )

        if feature_range > 0:

            return max(
                feature_range * 0.001,
                1e-10,
            )

    thresholds = [
        value
        for value in _threshold_values(rule)
        if value is not None
    ]

    if thresholds:

        scale = max(
            abs(value)
            for value in thresholds
        )

        return max(
            scale * 1e-6,
            1e-10,
        )

    return 1e-10


# =====================================================================
# HARD VALIDATION
# =====================================================================
#
# ONLY these conditions suppress a feature.
#
# Weak correlation DOES NOT appear here.
# =====================================================================

def _hard_rule_errors(rule):

    errors = []

    if not isinstance(rule, dict):

        return [
            "Threshold rule is not a valid object."
        ]

    direction = rule.get(
        "direction"
    )

    if direction not in {
        "higher_worse",
        "lower_worse",
    }:

        errors.append(
            "Invalid or missing threshold direction."
        )

    mild, medium, high = _threshold_values(
        rule
    )

    if (
        mild is None
        or medium is None
        or high is None
    ):

        errors.append(
            "One or more threshold values are missing or invalid."
        )

        return errors

    tolerance = _threshold_tolerance(
        rule
    )

    # ---------------------------------------------------------------
    # Threshold ordering
    # ---------------------------------------------------------------

    if direction == "higher_worse":

        if not (
            mild <= medium <= high
        ):

            errors.append(
                "Higher-worse threshold ordering is invalid."
            )

    elif direction == "lower_worse":

        if not (
            mild >= medium >= high
        ):

            errors.append(
                "Lower-worse threshold ordering is invalid."
            )

    # ---------------------------------------------------------------
    # Collapsed thresholds
    # ---------------------------------------------------------------

    if abs(
        mild - medium
    ) <= tolerance:

        errors.append(
            "Mild and medium thresholds are effectively identical."
        )

    if abs(
        medium - high
    ) <= tolerance:

        errors.append(
            "Medium and high thresholds are effectively identical."
        )

    # ---------------------------------------------------------------
    # Teacher sample count
    # ---------------------------------------------------------------

    paired_rows = rule.get(
        "paired_rows"
    )

    if paired_rows is not None:

        try:

            paired_rows = int(
                paired_rows
            )

            if paired_rows < MIN_PAIRED_ROWS:

                errors.append(
                    "Too few teacher-feature paired samples."
                )

        except Exception:

            errors.append(
                "Teacher-feature paired-row count is invalid."
            )

    # ---------------------------------------------------------------
    # Hard warnings stored by calibration script
    # ---------------------------------------------------------------

    calibration_warnings = rule.get(
        "warnings",
        []
    )

    if isinstance(
        calibration_warnings,
        list,
    ):

        for warning in calibration_warnings:

            text = str(
                warning or ""
            ).lower()

            # Only known structural problems are hard failures.

            if (
                "effectively identical" in text
                or "feature range is zero" in text
                or "threshold ordering" in text
            ):

                errors.append(
                    str(warning)
                )

    return _unique_strings(
        errors
    )


# =====================================================================
# SOFT RELIABILITY
# =====================================================================

def _correlation_reliability(rule):
    """
    Determine explanation reliability from Spearman correlation.

    IMPORTANT:
    Weak correlation does NOT suppress the issue.
    """

    correlation = _finite(
        rule.get(
            "spearman_teacher_correlation"
        )
    )

    if correlation is None:

        return {
            "level": "unknown",
            "correlation": None,
        }

    strength = abs(
        correlation
    )

    if strength >= CORRELATION_STRONG:

        level = "strong"

    elif strength >= CORRELATION_MODERATE:

        level = "moderate"

    else:

        level = "weak"

    return {
        "level": level,
        "correlation": correlation,
    }


def _soft_rule_warnings(rule):

    warnings = []

    reliability = _correlation_reliability(
        rule
    )

    if reliability["level"] == "weak":

        warnings.append(
            "Weak feature-to-teacher correlation. "
            "Use this issue with lower recommendation priority."
        )

    calibration_warnings = rule.get(
        "warnings",
        []
    )

    hard_errors = [
        item.lower()
        for item in _hard_rule_errors(rule)
    ]

    if isinstance(
        calibration_warnings,
        list,
    ):

        for warning in calibration_warnings:

            warning_text = str(
                warning or ""
            ).strip()

            if not warning_text:
                continue

            lower_warning = warning_text.lower()

            # Do not repeat warnings already treated as hard failures.
            if any(
                lower_warning == error
                for error in hard_errors
            ):
                continue

            # Weak correlation is already represented cleanly above.
            if (
                "weak feature-to-teacher" in lower_warning
                or "weak feature-to-teacher spearman" in lower_warning
            ):
                continue

            warnings.append(
                warning_text
            )

    return _unique_strings(
        warnings
    )


def _rule_is_usable(rule):
    """
    Feature is usable unless it contains a HARD threshold problem.
    """

    hard_errors = _hard_rule_errors(
        rule
    )

    return (
        len(hard_errors) == 0,
        hard_errors,
        _soft_rule_warnings(rule),
    )


# =====================================================================
# ISSUE SEVERITY
# =====================================================================

def _severity(value, rule):
    """
    Convert feature measurement into:

        None
        low
        medium
        high

    using teacher-calibrated boundaries.
    """

    value = _finite(
        value
    )

    if value is None:
        return None

    direction = rule.get(
        "direction"
    )

    mild, medium, high = _threshold_values(
        rule
    )

    if (
        mild is None
        or medium is None
        or high is None
    ):

        return None

    # ---------------------------------------------------------------
    # Larger value means worse
    # ---------------------------------------------------------------

    if direction == "higher_worse":

        if value >= high:
            return "high"

        if value >= medium:
            return "medium"

        if value >= mild:
            return "low"

        return None

    # ---------------------------------------------------------------
    # Smaller value means worse
    # ---------------------------------------------------------------

    if direction == "lower_worse":

        if value <= high:
            return "high"

        if value <= medium:
            return "medium"

        if value <= mild:
            return "low"

        return None

    return None


# =====================================================================
# ISSUE PRIORITY
# =====================================================================

def _feature_range(rule):

    stats = rule.get(
        "feature_statistics",
        {},
    )

    minimum = _finite(
        stats.get("min")
    )

    maximum = _finite(
        stats.get("max")
    )

    if (
        minimum is None
        or maximum is None
    ):

        return None

    value_range = abs(
        maximum - minimum
    )

    if value_range <= 0:
        return None

    return value_range


def _severity_trigger(rule, severity):

    if severity == "high":
        return _finite(
            rule.get("high")
        )

    if severity == "medium":
        return _finite(
            rule.get("medium")
        )

    if severity == "low":
        return _finite(
            rule.get("mild")
        )

    return None


def _priority_score(
    value,
    severity,
    rule,
):
    """
    Technical ranking only.

    Does NOT modify overall handwriting quality.
    """

    base = {
        "high": 3.0,
        "medium": 2.0,
        "low": 1.0,
    }.get(
        severity,
        0.0,
    )

    trigger = _severity_trigger(
        rule,
        severity,
    )

    value_range = _feature_range(
        rule
    )

    if (
        trigger is None
        or value_range is None
    ):

        return base

    direction = rule.get(
        "direction"
    )

    if direction == "higher_worse":

        exceedance = max(
            0.0,
            float(value) - trigger,
        )

    else:

        exceedance = max(
            0.0,
            trigger - float(value),
        )

    normalized = min(
        exceedance / value_range,
        0.999,
    )

    return float(
        base + normalized
    )


# =====================================================================
# BUILD STRUCTURED ISSUE
# =====================================================================

def _build_issue(
    feature_name,
    value,
    severity,
    rule,
):

    issue_type = (
        rule.get(
            "issue_type"
        )
        or DEFAULT_ISSUE_TYPES.get(
            feature_name,
            feature_name,
        )
    )

    reliability = _correlation_reliability(
        rule
    )

    soft_warnings = _soft_rule_warnings(
        rule
    )

    return {

        # -------------------------------------------------------------
        # Main issue information
        # -------------------------------------------------------------

        "type":
            issue_type,

        "issue_type":
            issue_type,

        "feature":
            feature_name,

        "title":
            FEATURE_TITLES.get(
                feature_name,
                feature_name,
            ),

        "message":
            FEATURE_MESSAGES.get(
                feature_name,
                "A handwriting-quality weakness was detected.",
            ),

        "severity":
            severity,

        "value":
            float(value),

        # -------------------------------------------------------------
        # Reliability
        # -------------------------------------------------------------

        "reliability":
            reliability["level"],

        "spearman_teacher_correlation":
            reliability["correlation"],

        "reliability_warnings":
            soft_warnings,

        # This means thresholds themselves are structurally usable.
        "threshold_quality":
            "ok",

        # Keep original calibration status separately.
        "calibration_threshold_quality":
            rule.get(
                "threshold_quality",
                "unknown",
            ),

        # -------------------------------------------------------------
        # Teacher-grounded evidence
        # -------------------------------------------------------------

        "teacher_rating_column":
            rule.get(
                "teacher_rating_column"
            ),

        "paired_rows":
            rule.get(
                "paired_rows"
            ),

        "calibration_method":
            rule.get(
                "calibration_method"
            ),

        "threshold_source":
            "teacher_calibrated",

        # -------------------------------------------------------------
        # Threshold details
        # -------------------------------------------------------------

        "direction":
            rule.get(
                "direction"
            ),

        "thresholds": {

            "mild":
                _finite(
                    rule.get("mild")
                ),

            "medium":
                _finite(
                    rule.get("medium")
                ),

            "high":
                _finite(
                    rule.get("high")
                ),
        },

        # Technical sorting score only.
        "priority_score":
            _priority_score(
                value,
                severity,
                rule,
            ),
    }


# =====================================================================
# MAIN FUNCTION
# =====================================================================

def detect_issues(
    language,
    features,
):
    """
    Detect teacher-calibrated handwriting weaknesses.

    IMPORTANT
    ---------
    This function does NOT calculate or modify the final handwriting
    quality class.

    Final class must come only from the trained calibrated ML model.
    """

    language = _normalize_language(
        language
    )

    # ----------------------------------------------------------------
    # Extracted feature dictionary missing
    # ----------------------------------------------------------------

    if not isinstance(
        features,
        dict,
    ):

        return {

            "available": False,

            "source": "unavailable",

            "threshold_file":
                threshold_path(language),

            "error":
                "Extracted handwriting features are unavailable.",

            "issues": [],

            "suppressed_features": [],

            "soft_warning_features": [],

            "missing_features": [],

            "expected_feature_count": None,

            "calibrated_feature_count": 0,

            "usable_feature_count": 0,

            "evaluated_feature_count": 0,

            "calibration_coverage": None,

            "partial_feedback": True,
        }

    # ----------------------------------------------------------------
    # Load teacher-calibrated thresholds
    # ----------------------------------------------------------------

    config, path, error = load_issue_thresholds(
        language
    )

    if config is None:

        return {

            "available": False,

            "source": "unavailable",

            "threshold_file": path,

            "error": error,

            "issues": [],

            "suppressed_features": [],

            "soft_warning_features": [],

            "missing_features": [],

            "expected_feature_count": None,

            "calibrated_feature_count": 0,

            "usable_feature_count": 0,

            "evaluated_feature_count": 0,

            "calibration_coverage": None,

            "partial_feedback": True,
        }

    rules = config.get(
        "features",
        {},
    )

    issues = []

    suppressed_features = []

    soft_warning_features = []

    missing_features = []

    usable_feature_count = 0

    evaluated_feature_count = 0

    # ----------------------------------------------------------------
    # Evaluate every calibrated feature
    # ----------------------------------------------------------------

    for feature_name, rule in rules.items():

        usable, hard_errors, soft_warnings = (
            _rule_is_usable(
                rule
            )
        )

        # =============================================================
        # HARD FAILURE
        # =============================================================

        if not usable:

            suppressed_features.append(
                {

                    "feature":
                        feature_name,

                    "issue_type":
                        rule.get(
                            "issue_type"
                        )
                        or DEFAULT_ISSUE_TYPES.get(
                            feature_name,
                            feature_name,
                        ),

                    "reason":
                        "invalid_calibrated_threshold",

                    "errors":
                        hard_errors,

                    "teacher_rating_column":
                        rule.get(
                            "teacher_rating_column"
                        ),

                    "spearman_teacher_correlation":
                        _finite(
                            rule.get(
                                "spearman_teacher_correlation"
                            )
                        ),
                }
            )

            continue

        usable_feature_count += 1

        # =============================================================
        # SOFT WARNING
        # =============================================================

        if soft_warnings:

            reliability = _correlation_reliability(
                rule
            )

            soft_warning_features.append(
                {

                    "feature":
                        feature_name,

                    "issue_type":
                        rule.get(
                            "issue_type"
                        )
                        or DEFAULT_ISSUE_TYPES.get(
                            feature_name,
                            feature_name,
                        ),

                    "reliability":
                        reliability["level"],

                    "spearman_teacher_correlation":
                        reliability["correlation"],

                    "warnings":
                        soft_warnings,
                }
            )

        # =============================================================
        # CHECK FEATURE VALUE
        # =============================================================

        if feature_name not in features:

            missing_features.append(
                {

                    "feature":
                        feature_name,

                    "reason":
                        "feature_not_produced_by_current_extraction",
                }
            )

            continue

        value = _finite(
            features.get(
                feature_name
            )
        )

        if value is None:

            missing_features.append(
                {

                    "feature":
                        feature_name,

                    "reason":
                        "feature_value_missing_or_non_finite",
                }
            )

            continue

        evaluated_feature_count += 1

        # =============================================================
        # DETECT ISSUE
        # =============================================================

        severity = _severity(
            value,
            rule,
        )

        # Feature was checked successfully but was not problematic.
        if severity is None:
            continue

        issue = _build_issue(
            feature_name,
            value,
            severity,
            rule,
        )

        issues.append(
            issue
        )

    # =================================================================
    # SORT ISSUES
    # =================================================================
    #
    # Priority:
    #
    # 1. severity
    # 2. reliability
    # 3. distance beyond threshold
    #
    # Example:
    #
    # high + strong
    #   before
    # high + weak
    #
    # But both remain HIGH issues technically.
    # =================================================================

    issues.sort(
        key=lambda issue: (

            -SEVERITY_RANK.get(
                issue.get(
                    "severity"
                ),
                0,
            ),

            -RELIABILITY_RANK.get(
                issue.get(
                    "reliability"
                ),
                0,
            ),

            -float(
                issue.get(
                    "priority_score",
                    0.0,
                )
            ),

            str(
                issue.get(
                    "title",
                    "",
                )
            ),
        )
    )

    # =================================================================
    # FEEDBACK AVAILABILITY
    # =================================================================

    feedback_available = (
        evaluated_feature_count > 0
    )

    # =================================================================
    # CALIBRATION COVERAGE
    # =================================================================

    expected_feature_count = config.get(
        "expected_feature_count"
    )

    if expected_feature_count is None:

        expected_features = config.get(
            "expected_features"
        )

        if isinstance(
            expected_features,
            list,
        ):

            expected_feature_count = len(
                expected_features
            )

    calibrated_feature_count = len(
        rules
    )

    calibration_coverage = _finite(
        config.get(
            "calibration_coverage"
        )
    )

    if (
        calibration_coverage is None
        and expected_feature_count
    ):

        calibration_coverage = (
            calibrated_feature_count
            / float(
                expected_feature_count
            )
        )

    # =================================================================
    # PARTIAL FEEDBACK
    # =================================================================

    partial_feedback = bool(

        suppressed_features

        or missing_features

        or (
            expected_feature_count
            and calibrated_feature_count
            < expected_feature_count
        )
    )

    # Soft warnings alone DO NOT make feedback unavailable.

    # =================================================================
    # ERROR MESSAGE
    # =================================================================

    result_error = None

    if not feedback_available:

        result_error = (
            "Teacher-calibrated issue thresholds were found, "
            "but no usable handwriting feature could be evaluated."
        )

    # =================================================================
    # FINAL RESULT
    # =================================================================

    return {

        # -------------------------------------------------------------
        # Child-feedback availability
        # -------------------------------------------------------------

        "available":
            bool(
                feedback_available
            ),

        "source":
            (
                "teacher_calibrated"
                if feedback_available
                else "unavailable"
            ),

        "error":
            result_error,

        # -------------------------------------------------------------
        # Actual detected weaknesses
        # -------------------------------------------------------------

        "issues":
            issues,

        # -------------------------------------------------------------
        # Research / diagnostic details
        # -------------------------------------------------------------

        "suppressed_features":
            suppressed_features,

        "soft_warning_features":
            soft_warning_features,

        "missing_features":
            missing_features,

        # -------------------------------------------------------------
        # Calibration coverage
        # -------------------------------------------------------------

        "expected_feature_count":
            expected_feature_count,

        "calibrated_feature_count":
            calibrated_feature_count,

        "usable_feature_count":
            usable_feature_count,

        "evaluated_feature_count":
            evaluated_feature_count,

        "calibration_coverage":
            calibration_coverage,

        "partial_feedback":
            partial_feedback,

        # -------------------------------------------------------------
        # Metadata
        # -------------------------------------------------------------

        "threshold_file":
            path,

        "threshold_role":
            config.get(
                "threshold_role",
                "explanation_and_recommendations_only",
            ),

        "final_quality_source":
            config.get(
                "final_quality_source",
                "calibrated_ml_model",
            ),
    }