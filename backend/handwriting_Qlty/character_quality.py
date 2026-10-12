"""
character_quality.py
====================

Auxiliary character-region structural diagnostics.

This module does NOT assign a semantic character identity and does NOT alter
the trained page-level ML prediction. It exists to support character-level
explainability and future teacher-validated character analysis.
"""

import cv2
import numpy as np

from image_utils import ensure_ink_white


MAX_EXPOSED_REGIONS = 120


def _json_number(value):
    try:
        value = float(value)
        return value if np.isfinite(value) else None
    except Exception:
        return None


def _region_metrics(region, box):
    foreground = ensure_ink_white(region)

    if foreground is None or foreground.size == 0:
        return None

    x, y, w, h = box

    ink_pixels = float(
        np.count_nonzero(
            foreground == 255
        )
    )

    density = (
        ink_pixels / foreground.size
        if foreground.size
        else np.nan
    )

    mid = foreground.shape[0] // 2

    if mid > 0:
        upper = float(
            np.count_nonzero(
                foreground[:mid] == 255
            )
        )
        lower = float(
            np.count_nonzero(
                foreground[mid:] == 255
            )
        )
        total = upper + lower
        balance = (
            1.0 - abs(upper - lower) / total
            if total > 0
            else np.nan
        )
    else:
        balance = np.nan

    try:
        component_count, _, stats, _ = (
            cv2.connectedComponentsWithStats(
                foreground,
                connectivity=8,
            )
        )

        meaningful_components = sum(
            1
            for index in range(1, component_count)
            if stats[
                index,
                cv2.CC_STAT_AREA,
            ] >= 3
        )
    except Exception:
        meaningful_components = None

    return {
        "box": [
            int(x),
            int(y),
            int(w),
            int(h),
        ],
        "aspect_ratio":
            _json_number(
                w / h
                if h > 0
                else np.nan
            ),
        "ink_density_ratio":
            _json_number(density),
        "upper_lower_balance":
            _json_number(balance),
        "component_count":
            meaningful_components,
    }


def analyze_character_records(line_records):
    """
    Summarize character-region geometry from the hierarchical segmentation.

    The result is auxiliary only and explicitly states that it does not affect
    the page-level ML prediction.
    """
    regions = []
    aspect_ratios = []
    densities = []
    balances = []

    total_count = 0

    for line_record in line_records or []:
        line_index = int(
            line_record.get(
                "line_index",
                0,
            )
        )

        for word_index, word_record in enumerate(
            line_record.get(
                "word_records",
                [],
            )
        ):
            character_regions = word_record.get(
                "character_regions",
                [],
            )
            character_boxes = word_record.get(
                "character_boxes",
                [],
            )

            for region_index, (
                region,
                box,
            ) in enumerate(
                zip(
                    character_regions,
                    character_boxes,
                )
            ):
                total_count += 1

                metrics = _region_metrics(
                    region,
                    box,
                )

                if metrics is None:
                    continue

                for key, target in [
                    ("aspect_ratio", aspect_ratios),
                    ("ink_density_ratio", densities),
                    ("upper_lower_balance", balances),
                ]:
                    value = metrics.get(key)
                    if value is not None:
                        target.append(value)

                if len(regions) < MAX_EXPOSED_REGIONS:
                    regions.append(
                        {
                            "line_index":
                                line_index,
                            "word_index":
                                int(word_index),
                            "region_index":
                                int(region_index),
                            **metrics,
                        }
                    )

    def summary(values):
        if not values:
            return {
                "mean": None,
                "std": None,
            }

        data = np.asarray(
            values,
            dtype=float,
        )

        return {
            "mean": float(np.mean(data)),
            "std": float(np.std(data)),
        }

    return {
        "available": bool(total_count > 0),
        "source": "auxiliary_structural_character_regions",
        "affects_final_prediction": False,
        "semantic_character_recognition": False,
        "region_count": int(total_count),
        "regions_returned": int(len(regions)),
        "regions_truncated": bool(
            total_count > len(regions)
        ),
        "summary": {
            "aspect_ratio": summary(
                aspect_ratios
            ),
            "ink_density_ratio": summary(
                densities
            ),
            "upper_lower_balance": summary(
                balances
            ),
        },
        "regions": regions,
    }
