"""
calibrate_issue_thresholds.py
=============================

Generate teacher-grounded issue thresholds from extracted handwriting
feature values and corresponding teacher sub-ratings.

The generated thresholds are used ONLY for:
    - issue detection
    - explainability
    - personalized recommendations

They MUST NOT be used to determine the final handwriting-quality class.
The calibrated ML model remains the single source of truth for the final
quality prediction.

Examples
--------
Sinhala:
python handwriting_Qlty/tools/calibrate_issue_thresholds.py \
    --language sinhala \
    --csv handwriting_Qlty/features/sinhala_teacher_labelled_features.csv

Tamil:
python handwriting_Qlty/tools/calibrate_issue_thresholds.py \
    --language tamil \
    --csv handwriting_Qlty/features/tamil_teacher_labelled_features.csv
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression


# ---------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------

MIN_PAIRED_ROWS = 30

# Teacher ratings are assumed to follow:
#
# 5 = Very Good
# 4 = Good
# 3 = Average
# 2 = Below Average
# 1 = Poor
#
# Threshold boundaries:
#
# 3.5 -> mild issue
# 2.5 -> medium issue
# 1.5 -> high issue

TARGET_RATINGS = {
    "mild": 3.5,
    "medium": 2.5,
    "high": 1.5,
}


# ---------------------------------------------------------------------
# FEATURE CONFIGURATION
# ---------------------------------------------------------------------

FEATURE_CONFIG = {

    # ================================================================
    # COMMON HANDWRITING FEATURES
    # ================================================================

    "spacing_std": {
        "direction": "higher_worse",
        "issue_type": "spacing",
        "teacher_candidates": [
            "teacher_spacing_rating",
            "teacher_word_spacing_rating",
            "teacher_spacing_score",
        ],
    },

    "baseline_std": {
        "direction": "higher_worse",
        "issue_type": "baseline_alignment",
        "teacher_candidates": [
            "teacher_alignment_rating",
            "teacher_baseline_rating",
            "teacher_line_alignment_rating",
        ],
    },

    "local_baseline_drift": {
        "direction": "higher_worse",
        "issue_type": "local_baseline_drift",
        "teacher_candidates": [
            "teacher_alignment_rating",
            "teacher_baseline_rating",
        ],
    },

    "avg_slant": {
        "direction": "higher_worse",
        "issue_type": "slant",
        "teacher_candidates": [
            "teacher_slant_rating",
            "teacher_slant_score",
        ],
    },

    "avg_size_variation": {
        "direction": "higher_worse",
        "issue_type": "size_variation",
        "teacher_candidates": [
            "teacher_size_rating",
            "teacher_size_consistency_rating",
        ],
    },

    # ================================================================
    # SCRIPT-AWARE STRUCTURAL FEATURES
    # ================================================================

    "curve_smoothness": {
        "direction": "higher_worse",
        "issue_type": "curve_smoothness",
        "teacher_candidates": [
            "teacher_curve_rating",
            "teacher_curve_smoothness_rating",
        ],
    },

    "loop_roundness": {
        "direction": "lower_worse",
        "issue_type": "loop_roundness",
        "teacher_candidates": [
            "teacher_loop_rating",
            "teacher_roundness_rating",
        ],
    },

    "stroke_continuity": {
        "direction": "lower_worse",
        "issue_type": "stroke_continuity",
        "teacher_candidates": [
            "teacher_stroke_continuity_rating",
            "teacher_continuity_rating",
        ],
    },

    "stroke_thickness_consistency": {
        "direction": "higher_worse",
        "issue_type": "stroke_thickness",
        "teacher_candidates": [
            "teacher_stroke_thickness_rating",
            "teacher_thickness_rating",
        ],
    },

    "density_distribution": {
        "direction": "higher_worse",
        "issue_type": "density_distribution",
        "teacher_candidates": [
            "teacher_density_rating",
            "teacher_distribution_rating",
        ],
    },

    # ================================================================
    # SINHALA-SPECIFIC EXTENDED FEATURES
    # ================================================================

    "character_shape_consistency": {
        "direction": "lower_worse",
        "issue_type": "character_shape",
        "teacher_candidates": [
            "teacher_shape_rating",
            "teacher_character_shape_rating",
        ],
    },

    "character_proportion_variation": {
        "direction": "higher_worse",
        "issue_type": "character_proportion",
        "teacher_candidates": [
            "teacher_proportion_rating",
            "teacher_character_proportion_rating",
        ],
    },

    "upper_lower_balance": {
        "direction": "lower_worse",
        "issue_type": "upper_lower_balance",
        "teacher_candidates": [
            "teacher_structural_balance_rating",
            "teacher_balance_rating",
        ],
    },

    "character_spacing_variation": {
        "direction": "higher_worse",
        "issue_type": "character_spacing",
        "teacher_candidates": [
            "teacher_character_spacing_rating",
            "teacher_letter_spacing_rating",
        ],
    },

    "word_spacing_variation": {
        "direction": "higher_worse",
        "issue_type": "word_spacing",
        "teacher_candidates": [
            "teacher_spacing_rating",
            "teacher_word_spacing_rating",
        ],
    },
}


# ---------------------------------------------------------------------
# LANGUAGE-SPECIFIC FEATURE SETS
# ---------------------------------------------------------------------
#
# IMPORTANT:
# Tamil uses ONLY the 10-feature Tamil representation.
#
# Sinhala uses all 15 features.
#
# This prevents Tamil calibration from incorrectly reporting Sinhala-only
# features as missing.
# ---------------------------------------------------------------------

LANGUAGE_FEATURES = {

    "tamil": [
        "spacing_std",
        "baseline_std",
        "local_baseline_drift",
        "avg_slant",
        "avg_size_variation",
        "curve_smoothness",
        "loop_roundness",
        "stroke_continuity",
        "stroke_thickness_consistency",
        "density_distribution",
    ],

    "sinhala": [
        "spacing_std",
        "baseline_std",
        "local_baseline_drift",
        "avg_slant",
        "avg_size_variation",
        "curve_smoothness",
        "loop_roundness",
        "stroke_continuity",
        "stroke_thickness_consistency",
        "density_distribution",
        "character_shape_consistency",
        "character_proportion_variation",
        "upper_lower_balance",
        "character_spacing_variation",
        "word_spacing_variation",
    ],
}


# ---------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------

def find_teacher_column(df, candidates):
    """
    Return the first available teacher sub-rating column.
    """

    for column in candidates:
        if column in df.columns:
            return column

    return None


def clean_feature_teacher_pairs(
    df,
    feature_name,
    teacher_column,
):
    """
    Convert feature and teacher-rating values to numeric values and
    remove missing / non-finite values.
    """

    paired = pd.DataFrame(
        {
            "feature": pd.to_numeric(
                df[feature_name],
                errors="coerce",
            ),
            "teacher": pd.to_numeric(
                df[teacher_column],
                errors="coerce",
            ),
        }
    ).dropna()

    paired = paired[
        np.isfinite(paired["feature"])
        & np.isfinite(paired["teacher"])
    ].copy()

    return paired


def calculate_spearman_correlation(paired):
    """
    Calculate feature-to-teacher Spearman correlation.

    pandas is used so scipy is not required separately.
    """

    if len(paired) < 2:
        return None

    correlation = paired[
        ["feature", "teacher"]
    ].corr(
        method="spearman"
    ).iloc[0, 1]

    if pd.isna(correlation):
        return None

    return float(correlation)


def teacher_rating_distribution(paired):
    """
    Return teacher rating counts for transparency and calibration
    diagnostics.
    """

    counts = (
        paired["teacher"]
        .value_counts()
        .sort_index()
    )

    return {
        str(float(rating)): int(count)
        for rating, count in counts.items()
    }


# ---------------------------------------------------------------------
# ISOTONIC CALIBRATION
# ---------------------------------------------------------------------

def boundary_from_isotonic(
    feature_values,
    teacher_ratings,
    direction,
    target_rating,
):
    """
    Fit isotonic regression between feature measurements and teacher
    ratings and estimate the feature value corresponding to the supplied
    teacher-rating boundary.

    higher_worse:
        larger feature values -> lower teacher ratings

    lower_worse:
        smaller feature values -> lower teacher ratings
    """

    x = np.asarray(
        feature_values,
        dtype=float,
    )

    y = np.asarray(
        teacher_ratings,
        dtype=float,
    )

    if direction == "lower_worse":
        increasing = True

    elif direction == "higher_worse":
        increasing = False

    else:
        raise ValueError(
            f"Unsupported direction: {direction}"
        )

    model = IsotonicRegression(
        increasing=increasing,
        out_of_bounds="clip",
    )

    model.fit(x, y)

    grid = np.linspace(
        float(np.min(x)),
        float(np.max(x)),
        2000,
    )

    predicted = model.predict(grid)

    index = int(
        np.argmin(
            np.abs(
                predicted
                - float(target_rating)
            )
        )
    )

    return float(grid[index])


# ---------------------------------------------------------------------
# THRESHOLD QUALITY CHECK
# ---------------------------------------------------------------------

def analyse_threshold_quality(
    mild,
    medium,
    high,
    feature_min,
    feature_max,
):
    """
    Check whether isotonic calibration produced useful distinct
    severity boundaries.

    This does NOT automatically remove the feature. Instead, warnings
    are stored in the JSON so the thresholds can be audited.
    """

    warnings = []

    feature_range = abs(
        float(feature_max)
        - float(feature_min)
    )

    if feature_range == 0:
        return [
            "Feature range is zero."
        ]

    tolerance = max(
        feature_range * 0.001,
        1e-10,
    )

    if abs(mild - medium) <= tolerance:
        warnings.append(
            "Mild and medium thresholds are effectively identical."
        )

    if abs(medium - high) <= tolerance:
        warnings.append(
            "Medium and high thresholds are effectively identical."
        )

    if abs(mild - high) <= tolerance:
        warnings.append(
            "All severity thresholds are effectively identical."
        )

    return warnings


# ---------------------------------------------------------------------
# FEATURE CALIBRATION
# ---------------------------------------------------------------------

def calibrate_feature(
    df,
    feature_name,
    config,
):
    """
    Calibrate mild, medium and high issue thresholds for one feature.
    """

    # ---------------------------------------------------------------
    # Feature must exist
    # ---------------------------------------------------------------

    if feature_name not in df.columns:
        return None, "feature column missing"

    # ---------------------------------------------------------------
    # Find matching teacher sub-rating
    # ---------------------------------------------------------------

    teacher_column = find_teacher_column(
        df,
        config["teacher_candidates"],
    )

    if teacher_column is None:
        return (
            None,
            "teacher sub-rating column missing",
        )

    # ---------------------------------------------------------------
    # Prepare valid pairs
    # ---------------------------------------------------------------

    paired = clean_feature_teacher_pairs(
        df,
        feature_name,
        teacher_column,
    )

    if len(paired) < MIN_PAIRED_ROWS:
        return None, (
            f"only {len(paired)} valid pairs; "
            f"need at least {MIN_PAIRED_ROWS}"
        )

    # ---------------------------------------------------------------
    # Make sure feature varies enough
    # ---------------------------------------------------------------

    if paired["feature"].nunique() < 4:
        return (
            None,
            "feature has too little variation",
        )

    if paired["teacher"].nunique() < 2:
        return (
            None,
            "teacher ratings have too little variation",
        )

    # ---------------------------------------------------------------
    # Feature statistics
    # ---------------------------------------------------------------

    feature_min = float(
        paired["feature"].min()
    )

    feature_max = float(
        paired["feature"].max()
    )

    feature_mean = float(
        paired["feature"].mean()
    )

    feature_std = float(
        paired["feature"].std()
    )

    spearman = calculate_spearman_correlation(
        paired
    )

    rating_counts = teacher_rating_distribution(
        paired
    )

    # ---------------------------------------------------------------
    # Calibrate thresholds
    # ---------------------------------------------------------------

    try:

        mild = boundary_from_isotonic(
            paired["feature"],
            paired["teacher"],
            config["direction"],
            TARGET_RATINGS["mild"],
        )

        medium = boundary_from_isotonic(
            paired["feature"],
            paired["teacher"],
            config["direction"],
            TARGET_RATINGS["medium"],
        )

        high = boundary_from_isotonic(
            paired["feature"],
            paired["teacher"],
            config["direction"],
            TARGET_RATINGS["high"],
        )

    except Exception as error:

        return (
            None,
            f"isotonic calibration failed: {error}",
        )

    # ---------------------------------------------------------------
    # Enforce ordering expected by issue_detection.py
    # ---------------------------------------------------------------

    values = [
        float(mild),
        float(medium),
        float(high),
    ]

    if config["direction"] == "higher_worse":

        # Example:
        #
        # mild   = 0.20
        # medium = 0.40
        # high   = 0.60

        values = sorted(values)

    else:

        # Example:
        #
        # mild   = 0.80
        # medium = 0.60
        # high   = 0.40

        values = sorted(
            values,
            reverse=True,
        )

    mild, medium, high = values

    # ---------------------------------------------------------------
    # Diagnostic checks
    # ---------------------------------------------------------------

    warnings = analyse_threshold_quality(
        mild,
        medium,
        high,
        feature_min,
        feature_max,
    )

    # Weak feature-teacher correlation is important for research
    # interpretation, but we do NOT automatically discard the feature
    # here.
    if (
        spearman is not None
        and abs(spearman) < 0.25
    ):
        warnings.append(
            "Weak feature-to-teacher Spearman correlation "
            f"(rho={spearman:.3f}). Review before relying heavily "
            "on this feature for child-facing feedback."
        )

    # ---------------------------------------------------------------
    # Return calibrated rule
    # ---------------------------------------------------------------

    rule = {

        "direction":
            config["direction"],

        "issue_type":
            config["issue_type"],

        "teacher_rating_column":
            teacher_column,

        "paired_rows":
            int(len(paired)),

        "feature_statistics": {
            "min": feature_min,
            "max": feature_max,
            "mean": feature_mean,
            "std": feature_std,
        },

        "teacher_rating_distribution":
            rating_counts,

        "spearman_teacher_correlation":
            spearman,

        "target_teacher_boundaries": {
            "mild": TARGET_RATINGS["mild"],
            "medium": TARGET_RATINGS["medium"],
            "high": TARGET_RATINGS["high"],
        },

        "mild":
            float(mild),

        "medium":
            float(medium),

        "high":
            float(high),

        "calibration_method":
            "isotonic_teacher_rating_boundaries_3.5_2.5_1.5",

        "threshold_quality":
            (
                "warning"
                if warnings
                else "ok"
            ),

        "warnings":
            warnings,
    }

    return rule, None


# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Generate teacher-grounded handwriting issue thresholds."
        )
    )

    parser.add_argument(
        "--language",
        required=True,
        choices=[
            "sinhala",
            "tamil",
        ],
    )

    parser.add_argument(
        "--csv",
        required=True,
        help=(
            "Path to teacher-labelled extracted feature CSV."
        ),
    )

    parser.add_argument(
        "--output",
        default=None,
        help=(
            "Optional explicit JSON output path."
        ),
    )

    args = parser.parse_args()

    # ---------------------------------------------------------------
    # Validate input CSV
    # ---------------------------------------------------------------

    csv_path = Path(
        args.csv
    ).resolve()

    if not csv_path.exists():
        raise FileNotFoundError(
            f"CSV not found: {csv_path}"
        )

    print()
    print("=" * 70)
    print(
        f"Calibrating issue thresholds for: "
        f"{args.language.upper()}"
    )
    print("=" * 70)

    print(
        f"Dataset: {csv_path}"
    )

    df = pd.read_csv(
        csv_path
    )

    print(
        f"Rows: {len(df)}"
    )

    # ---------------------------------------------------------------
    # Select ONLY features belonging to requested language
    # ---------------------------------------------------------------

    selected_features = LANGUAGE_FEATURES[
        args.language
    ]

    print(
        f"Expected features: "
        f"{len(selected_features)}"
    )

    feature_rules = {}
    skipped = {}

    # ---------------------------------------------------------------
    # Calibrate
    # ---------------------------------------------------------------

    for feature_name in selected_features:

        config = FEATURE_CONFIG[
            feature_name
        ]

        rule, error = calibrate_feature(
            df,
            feature_name,
            config,
        )

        if rule is None:

            skipped[
                feature_name
            ] = error

            print(
                f"[SKIPPED] {feature_name}: "
                f"{error}"
            )

        else:

            feature_rules[
                feature_name
            ] = rule

            status = (
                "WARNING"
                if rule["warnings"]
                else "OK"
            )

            correlation = (
                rule[
                    "spearman_teacher_correlation"
                ]
            )

            correlation_text = (
                f"{correlation:.3f}"
                if correlation is not None
                else "N/A"
            )

            print(
                f"[{status}] "
                f"{feature_name}"
            )

            print(
                "    "
                f"mild={rule['mild']:.6f}, "
                f"medium={rule['medium']:.6f}, "
                f"high={rule['high']:.6f}, "
                f"rho={correlation_text}"
            )

            for warning in rule[
                "warnings"
            ]:
                print(
                    f"    WARNING: {warning}"
                )

    # ---------------------------------------------------------------
    # Output path
    # ---------------------------------------------------------------

    base_dir = (
        Path(__file__)
        .resolve()
        .parent
        .parent
        .parent      # backend
    )


    language_folder = (
            "Sinhala"
            if args.language == "sinhala"
            else "Tamil"
        )

    if args.output:

        output_path = Path(
            args.output
        ).resolve()

    else:

        output_path = (
            base_dir
            / "models"
            / language_folder
            / (
                f"{args.language}"
                "_issue_thresholds.json"
            )
        )

    # ---------------------------------------------------------------
    # Summary
    # ---------------------------------------------------------------

    expected_count = len(
        selected_features
    )

    calibrated_count = len(
        feature_rules
    )

    skipped_count = len(
        skipped
    )

    coverage = (
        calibrated_count
        / expected_count
        if expected_count
        else 0.0
    )

    warning_features = [
        feature_name
        for feature_name, rule
        in feature_rules.items()
        if rule.get("warnings")
    ]

    # ---------------------------------------------------------------
    # Final JSON
    # ---------------------------------------------------------------

    payload = {

        "language":
            args.language,

        "source_dataset":
            str(csv_path),

        "dataset_rows":
            int(len(df)),

        "threshold_role":
            "explanation_and_recommendations_only",

        "final_quality_source":
            "calibrated_ml_model",

        "teacher_rating_scale": {
            "1": "Poor",
            "2": "Below Average",
            "3": "Average",
            "4": "Good",
            "5": "Very Good",
        },

        "expected_features":
            selected_features,

        "expected_feature_count":
            expected_count,

        "calibrated_feature_count":
            calibrated_count,

        "skipped_feature_count":
            skipped_count,

        "calibration_coverage":
            float(coverage),

        "warning_feature_count":
            len(warning_features),

        "warning_features":
            warning_features,

        "features":
            feature_rules,

        "skipped_features":
            skipped,
    }

    with open(
        output_path,
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            payload,
            file,
            indent=2,
            ensure_ascii=False,
        )

    # ---------------------------------------------------------------
    # Console report
    # ---------------------------------------------------------------

    print()
    print("=" * 70)
    print("CALIBRATION SUMMARY")
    print("=" * 70)

    print(
        f"Language: "
        f"{args.language}"
    )

    print(
        f"Expected features: "
        f"{expected_count}"
    )

    print(
        f"Calibrated features: "
        f"{calibrated_count}"
    )

    print(
        f"Skipped features: "
        f"{skipped_count}"
    )

    print(
        f"Coverage: "
        f"{coverage * 100:.1f}%"
    )

    print(
        f"Features with warnings: "
        f"{len(warning_features)}"
    )

    if skipped:

        print()
        print("Skipped:")

        for feature, reason in skipped.items():

            print(
                f"  - {feature}: "
                f"{reason}"
            )

    if warning_features:

        print()
        print(
            "Features requiring threshold review:"
        )

        for feature in warning_features:

            print(
                f"  - {feature}"
            )

    print()
    print(
        f"Saved: {output_path}"
    )

    print("=" * 70)
    print()


# ---------------------------------------------------------------------
# ENTRY POINT
# ---------------------------------------------------------------------

if __name__ == "__main__":
    main()