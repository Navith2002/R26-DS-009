"""
issue_detection.py
==================

Teacher-grounded, language-aware handwriting issue detection.

Architecture rule
-----------------
The calibrated ML model decides the final handwriting-quality class.
This module is explanation-only.

Preferred threshold files
-------------------------
models/Sinhala/sinhala_issue_thresholds.json
models/Tamil/tamil_issue_thresholds.json

No silent hand-written fallback is used. If calibrated thresholds are missing,
issue feedback is reported as unavailable instead of inventing scientific
cutoffs.
"""

import json
import os

import numpy as np


BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models",
)


FEATURE_MESSAGES = {
    "spacing_std":
        "Word spacing is inconsistent.",
    "baseline_std":
        "Writing alignment varies around the baseline.",
    "local_baseline_drift":
        "The baseline drifts noticeably within writing lines.",
    "avg_slant":
        "Writing slant is inconsistent or excessive.",
    "avg_size_variation":
        "Character or word size varies noticeably.",
    "curve_smoothness":
        "Curved strokes are not consistently smooth.",
    "loop_roundness":
        "Rounded or loop-like forms are not consistently formed.",
    "stroke_continuity":
        "Some strokes appear fragmented or discontinuous.",
    "stroke_thickness_consistency":
        "Stroke thickness varies noticeably.",
    "density_distribution":
        "Ink distribution within words is structurally uneven.",
    "character_shape_consistency":
        "Character-region shapes show inconsistent structural formation.",
    "character_proportion_variation":
        "Character-region height and width proportions vary noticeably.",
    "upper_lower_balance":
        "Upper and lower character structure is not well balanced.",
    "character_spacing_variation":
        "Spacing between character regions is inconsistent.",
    "word_spacing_variation":
        "Spacing between words varies noticeably.",
}


FEATURE_TITLES = {
    "spacing_std": "Word spacing",
    "baseline_std": "Baseline alignment",
    "local_baseline_drift": "Local baseline drift",
    "avg_slant": "Writing slant",
    "avg_size_variation": "Size consistency",
    "curve_smoothness": "Curve smoothness",
    "loop_roundness": "Loop/roundness formation",
    "stroke_continuity": "Stroke continuity",
    "stroke_thickness_consistency": "Stroke thickness",
    "density_distribution": "Structural density",
    "character_shape_consistency": "Character shape consistency",
    "character_proportion_variation": "Character proportions",
    "upper_lower_balance": "Upper/lower balance",
    "character_spacing_variation": "Character spacing",
    "word_spacing_variation": "Word spacing variation",
}


DEFAULT_ISSUE_TYPES = {
    "spacing_std": "spacing",
    "baseline_std": "baseline_alignment",
    "local_baseline_drift": "local_baseline_drift",
    "avg_slant": "slant",
    "avg_size_variation": "size_variation",
    "curve_smoothness": "curve_smoothness",
    "loop_roundness": "loop_roundness",
    "stroke_continuity": "stroke_continuity",
    "stroke_thickness_consistency": "stroke_thickness",
    "density_distribution": "density_distribution",
    "character_shape_consistency": "character_shape",
    "character_proportion_variation": "character_proportion",
    "upper_lower_balance": "upper_lower_balance",
    "character_spacing_variation": "character_spacing",
    "word_spacing_variation": "word_spacing",
}


def _language_folder(language):
    language = str(language).strip().lower()

    preferred = (
        "Sinhala"
        if language == "sinhala"
        else "Tamil"
    )

    candidates = [
        os.path.join(MODEL_DIR, preferred),
        os.path.join(MODEL_DIR, preferred.lower()),
    ]

    for path in candidates:
        if os.path.isdir(path):
            return path

    return candidates[0]


def threshold_path(language):
    language = str(language).strip().lower()

    return os.path.join(
        _language_folder(language),
        f"{language}_issue_thresholds.json",
    )


def load_issue_thresholds(language):
    path = threshold_path(language)

    if not os.path.exists(path):
        return None, path, (
            "Teacher-calibrated issue thresholds are not installed."
        )

    try:
        with open(
            path,
            "r",
            encoding="utf-8",
        ) as file:
            config = json.load(file)

        if not isinstance(
            config.get("features"),
            dict,
        ):
            raise ValueError(
                "Threshold JSON does not contain a valid 'features' object."
            )

        return config, path, None

    except Exception as error:
        return None, path, str(error)


def _finite(value):
    try:
        number = float(value)
        return number if np.isfinite(number) else None
    except Exception:
        return None


def _severity(value, rule):
    direction = rule.get("direction")

    mild = _finite(
        rule.get("mild")
    )
    medium = _finite(
        rule.get("medium")
    )
    high = _finite(
        rule.get("high")
    )

    if (
        mild is None
        or medium is None
        or high is None
    ):
        return None

    if direction == "higher_worse":
        if value >= high:
            return "high"
        if value >= medium:
            return "medium"
        if value >= mild:
            return "low"

    elif direction == "lower_worse":
        if value <= high:
            return "high"
        if value <= medium:
            return "medium"
        if value <= mild:
            return "low"

    return None


def detect_issues(language, features):
    """
    Return structured, teacher-calibrated explanation information.

    {
        "available": bool,
        "source": "teacher_calibrated" | "unavailable",
        "threshold_file": str,
        "error": str | None,
        "issues": [...]
    }
    """
    language = str(language).strip().lower()

    if language not in {
        "sinhala",
        "tamil",
    }:
        raise ValueError(
            "Unsupported language for issue detection."
        )

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
        }

    rules = config["features"]
    issues = []

    for feature_name, rule in rules.items():
        if feature_name not in features:
            continue

        value = _finite(
            features.get(feature_name)
        )

        if value is None:
            continue

        severity = _severity(
            value,
            rule,
        )

        if severity is None:
            continue

        issues.append(
            {
                "type":
                    rule.get("issue_type")
                    or DEFAULT_ISSUE_TYPES.get(
                        feature_name,
                        feature_name,
                    ),
                "feature": feature_name,
                "title": FEATURE_TITLES.get(
                    feature_name,
                    feature_name,
                ),
                "severity": severity,
                "value": float(value),
                "message":
                    rule.get("message")
                    or FEATURE_MESSAGES.get(
                        feature_name,
                        "A handwriting-quality weakness was detected.",
                    ),
                "teacher_rating_column":
                    rule.get("teacher_rating_column"),
                "threshold_source": "teacher_calibrated",
            }
        )

    severity_rank = {
        "high": 0,
        "medium": 1,
        "low": 2,
    }

    issues.sort(
        key=lambda issue: (
            severity_rank.get(
                issue["severity"],
                99,
            ),
            issue["title"],
        )
    )

    return {
        "available": True,
        "source": "teacher_calibrated",
        "threshold_file": path,
        "error": None,
        "issues": issues,
    }
