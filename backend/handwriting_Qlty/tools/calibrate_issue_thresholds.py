"""
calibrate_issue_thresholds.py
=============================

Generate teacher-grounded issue thresholds from extracted feature values and
corresponding teacher sub-ratings.

Example
-------
python tools/calibrate_issue_thresholds.py --language sinhala --csv features/sinhala_teacher_labelled_features.csv

The output is consumed by issue_detection.py.
"""

import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression


MIN_PAIRED_ROWS = 30

FEATURE_CONFIG = {
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


def find_teacher_column(df, candidates):
    for column in candidates:
        if column in df.columns:
            return column
    return None


def boundary_from_isotonic(
    feature_values,
    teacher_ratings,
    direction,
    target_rating,
):
    x = np.asarray(
        feature_values,
        dtype=float,
    )
    y = np.asarray(
        teacher_ratings,
        dtype=float,
    )

    increasing = (
        True
        if direction == "lower_worse"
        else False
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


def calibrate_feature(df, feature_name, config):
    if feature_name not in df.columns:
        return None, "feature column missing"

    teacher_column = find_teacher_column(
        df,
        config["teacher_candidates"],
    )

    if teacher_column is None:
        return None, "teacher sub-rating column missing"

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
    ]

    if len(paired) < MIN_PAIRED_ROWS:
        return None, (
            f"only {len(paired)} valid pairs; need at least {MIN_PAIRED_ROWS}"
        )

    if paired["feature"].nunique() < 4:
        return None, "feature has too little variation"

    try:
        mild = boundary_from_isotonic(
            paired["feature"],
            paired["teacher"],
            config["direction"],
            3.5,
        )
        medium = boundary_from_isotonic(
            paired["feature"],
            paired["teacher"],
            config["direction"],
            2.5,
        )
        high = boundary_from_isotonic(
            paired["feature"],
            paired["teacher"],
            config["direction"],
            1.5,
        )
    except Exception as error:
        return None, str(error)

    # Enforce the ordering expected by issue_detection._severity().
    values = [mild, medium, high]

    if config["direction"] == "higher_worse":
        values = sorted(values)
    else:
        values = sorted(values, reverse=True)

    mild, medium, high = values

    return {
        "direction": config["direction"],
        "issue_type": config["issue_type"],
        "teacher_rating_column": teacher_column,
        "paired_rows": int(len(paired)),
        "mild": float(mild),
        "medium": float(medium),
        "high": float(high),
        "calibration_method":
            "isotonic_teacher_rating_boundaries_3.5_2.5_1.5",
    }, None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--language",
        required=True,
        choices=["sinhala", "tamil"],
    )
    parser.add_argument(
        "--csv",
        required=True,
        help="Teacher-labelled extracted feature CSV.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional explicit JSON output path.",
    )

    args = parser.parse_args()

    csv_path = Path(args.csv)

    if not csv_path.exists():
        raise FileNotFoundError(
            f"CSV not found: {csv_path}"
        )

    df = pd.read_csv(csv_path)

    feature_rules = {}
    skipped = {}

    for feature_name, config in FEATURE_CONFIG.items():
        rule, error = calibrate_feature(
            df,
            feature_name,
            config,
        )

        if rule is None:
            skipped[feature_name] = error
        else:
            feature_rules[feature_name] = rule

    base_dir = Path(__file__).resolve().parent.parent
    language_folder = (
        "Sinhala"
        if args.language == "sinhala"
        else "Tamil"
    )

    output_path = (
        Path(args.output)
        if args.output
        else base_dir
        / "models"
        / language_folder
        / f"{args.language}_issue_thresholds.json"
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    payload = {
        "language": args.language,
        "source_dataset": str(csv_path),
        "threshold_role":
            "explanation_and_recommendations_only",
        "final_quality_source":
            "calibrated_ml_model",
        "features": feature_rules,
        "skipped_features": skipped,
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
        )

    print(
        f"Saved: {output_path}"
    )
    print(
        f"Calibrated features: {len(feature_rules)}"
    )

    if skipped:
        print("Skipped:")
        for feature, reason in skipped.items():
            print(
                f"  - {feature}: {reason}"
            )


if __name__ == "__main__":
    main()
