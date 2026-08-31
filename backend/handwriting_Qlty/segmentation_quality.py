"""
segmentation_quality.py
=======================

Stage 1B segmentation-reliability sanity gate  —  RELAXED LIMITS.

Purpose
-------
A photograph may pass Stage 1A image-quality validation but still be
segmented incorrectly. This gate catches catastrophic segmentation
failures only.

CHANGES vs previous version
----------------------------
All limits have been significantly relaxed so that only truly broken
segmentation (e.g. 500 words on a 3-line page) blocks the ML result.
Borderline cases are downgraded from hard failures to soft warnings.
"""

from __future__ import annotations

import cv2
import numpy as np

from image_utils import ensure_ink_white


# ============================================================
# RELAXED DEVELOPMENT SANITY LIMITS
# ============================================================
#
# CHANGES vs previous version:
#   max_lines:                        40   ->  60
#   max_words:                       250   -> 400
#   max_character_regions:          1200   -> 2000
#   max_average_words_per_line:       22   ->  35
#   max_median_words_per_line:        20   ->  30
#   max_average_regions_per_word:     12   ->  20
#   max_median_regions_per_word:      10   ->  16
#   max_tiny_word_ratio:            0.60   ->  0.80
#   max_tiny_region_ratio:          0.70   ->  0.85
#   max_largest_line_height_ratio:  0.62   ->  0.80
#   max_line_height_to_median_ratio: 3.5  ->  5.0
#   max_largest_line_ink_share:     0.78   ->  0.90
#   max_text_components_per_word:     18   ->  30
#   min_words_when_many_components:    6   ->  3
#   min_word_ink_coverage:          0.45   ->  0.20
#   many_component_count:             60   ->  80
# ============================================================

SEGMENTATION_LIMITS = {

    # Catastrophic over-segmentation
    "max_lines":
        60,

    "max_words":
        400,

    "max_character_regions":
        2000,

    "max_average_words_per_line":
        35.0,

    "max_median_words_per_line":
        30.0,

    "max_average_regions_per_word":
        20.0,

    "max_median_regions_per_word":
        16.0,

    "max_tiny_word_ratio":
        0.80,

    "max_tiny_region_ratio":
        0.85,


    # Under-segmentation / merged lines
    "max_largest_line_height_ratio":
        0.80,

    "max_line_height_to_median_ratio":
        5.0,

    "max_largest_line_ink_share":
        0.90,


    # Component-vs-word sanity
    "many_component_count":
        80,

    "max_text_components_per_word":
        30.0,

    "min_words_when_many_components":
        3,


    # Segmented ink coverage
    "min_word_ink_coverage":
        0.20,
}


# ============================================================
# BASIC HELPERS
# ============================================================

def _safe_ratio(
    numerator,
    denominator,
):
    try:
        denominator = float(denominator)
        if denominator == 0:
            return 0.0
        return float(float(numerator) / denominator)
    except Exception:
        return 0.0


def _median(values):
    if not values:
        return 0.0
    try:
        return float(np.median(np.asarray(values, dtype=float)))
    except Exception:
        return 0.0


def _mean(values):
    if not values:
        return 0.0
    try:
        return float(np.mean(np.asarray(values, dtype=float)))
    except Exception:
        return 0.0


def _clip_box(box, image_width, image_height):
    try:
        x, y, w, h = [int(value) for value in box]
    except Exception:
        return None

    x = max(0, x)
    y = max(0, y)
    right = min(image_width, x + max(0, w))
    bottom = min(image_height, y + max(0, h))

    if right <= x or bottom <= y:
        return None

    return (int(x), int(y), int(right - x), int(bottom - y))


# ============================================================
# WORD / CHARACTER GEOMETRY
# ============================================================

def _word_geometry_metrics(line_records):
    total_words = 0
    tiny_words = 0
    total_regions = 0
    tiny_regions = 0
    words_per_line = []
    regions_per_word = []

    for record in (line_records or []):
        line = record.get("line")
        line_height = (
            int(line.shape[0])
            if getattr(line, "shape", None) is not None
            else 0
        )

        local_boxes = record.get("local_word_boxes", []) or []
        words_per_line.append(int(len(local_boxes)))

        for word_record in (record.get("word_records", []) or []):
            total_words += 1

            word_box = word_record.get("local_box")
            if word_box is not None and line_height > 0:
                try:
                    _, _, word_width, word_height = word_box
                    if (
                        word_width < 0.35 * line_height
                        or word_height < 0.25 * line_height
                    ):
                        tiny_words += 1
                except Exception:
                    pass

            character_boxes = word_record.get("character_boxes", []) or []
            region_count = int(len(character_boxes))
            regions_per_word.append(region_count)
            total_regions += region_count

            word = word_record.get("word")
            word_height = (
                int(word.shape[0])
                if getattr(word, "shape", None) is not None
                else 0
            )

            if word_height <= 0:
                continue

            for region_box in character_boxes:
                try:
                    _, _, region_width, region_height = region_box
                    if (
                        region_width < 0.10 * word_height
                        or region_height < 0.18 * word_height
                    ):
                        tiny_regions += 1
                except Exception:
                    continue

    return {
        "words_per_line": words_per_line,
        "regions_per_word": regions_per_word,
        "tiny_word_ratio": _safe_ratio(tiny_words, total_words),
        "tiny_region_ratio": _safe_ratio(tiny_regions, total_regions),
        "total_word_records": int(total_words),
        "total_character_records": int(total_regions),
    }


# ============================================================
# PAGE CONTENT
# ============================================================

def _page_content_box(binary):
    canonical = ensure_ink_white(binary)
    if canonical is None:
        return None

    coordinates = cv2.findNonZero(canonical)
    if coordinates is None:
        return None

    try:
        return tuple(int(value) for value in cv2.boundingRect(coordinates))
    except Exception:
        return None


# ============================================================
# TEXT-LIKE COMPONENT COUNT
# ============================================================

def _text_component_count(binary):
    canonical = ensure_ink_white(binary)
    if canonical is None:
        return 0
    if canonical.ndim != 2:
        return 0

    try:
        count, _, stats, _ = cv2.connectedComponentsWithStats(
            canonical, connectivity=8,
        )

        page_height, page_width = canonical.shape[:2]
        result = 0

        for label_id in range(1, count):
            component_width = int(stats[label_id, cv2.CC_STAT_WIDTH])
            component_height = int(stats[label_id, cv2.CC_STAT_HEIGHT])
            area = int(stats[label_id, cv2.CC_STAT_AREA])

            if area < 3 or component_width <= 0 or component_height <= 0:
                continue

            if (
                component_width >= 0.45 * page_width
                and component_height <= max(4, int(round(0.025 * page_height)))
            ):
                continue

            if (
                component_height >= 0.55 * page_height
                and component_width <= max(4, int(round(0.025 * page_width)))
            ):
                continue

            result += 1

        return int(result)

    except Exception:
        return 0


# ============================================================
# WORD INK COVERAGE
# ============================================================

def _word_ink_coverage(segmentation):
    page_binary = segmentation.get("page_binary")
    canonical = ensure_ink_white(page_binary)
    if canonical is None:
        return 0.0

    page_height, page_width = canonical.shape[:2]
    total_ink = int(np.count_nonzero(canonical == 255))
    if total_ink <= 0:
        return 0.0

    word_mask = np.zeros_like(canonical)
    global_boxes = segmentation.get("all_word_boxes", []) or []

    for box in global_boxes:
        clipped = _clip_box(box, page_width, page_height)
        if clipped is None:
            continue
        x, y, w, h = clipped
        word_mask[y:y + h, x:x + w] = 255

    covered_ink = int(np.count_nonzero(
        (canonical == 255) & (word_mask == 255)
    ))

    return float(_safe_ratio(covered_ink, total_ink))


# ============================================================
# LINE GEOMETRY
# ============================================================

def _line_geometry_metrics(segmentation):
    page_binary = segmentation.get("page_binary")
    canonical = ensure_ink_white(page_binary)

    line_boxes = segmentation.get("line_boxes", []) or []
    lines = segmentation.get("lines", []) or []

    heights = []
    maximum_count = max(len(line_boxes), len(lines))

    for index in range(maximum_count):
        height = 0
        if index < len(line_boxes):
            try:
                height = int(line_boxes[index][3])
            except Exception:
                height = 0
        elif index < len(lines):
            line = lines[index]
            if getattr(line, "shape", None) is not None:
                height = int(line.shape[0])

        if height > 0:
            heights.append(int(height))

    metrics = {
        "line_heights": heights,
        "largest_line_height_ratio": 0.0,
        "line_height_to_median_ratio": 0.0,
        "largest_line_ink_share": 0.0,
        "text_component_count": 0,
        "page_text_height": 0,
    }

    if canonical is None:
        return metrics

    page_height, page_width = canonical.shape[:2]

    content_box = _page_content_box(canonical)
    if content_box is not None:
        _, _, _, text_height = content_box
        metrics["page_text_height"] = int(text_height)

        if heights and text_height > 0:
            largest_height = max(heights)
            metrics["largest_line_height_ratio"] = _safe_ratio(
                largest_height, text_height,
            )
            median_height = float(np.median(heights))
            metrics["line_height_to_median_ratio"] = _safe_ratio(
                largest_height, median_height,
            )

    total_ink = int(np.count_nonzero(canonical == 255))
    if total_ink > 0 and line_boxes:
        largest_line_ink = 0
        for box in line_boxes:
            clipped = _clip_box(box, page_width, page_height)
            if clipped is None:
                continue
            x, y, w, h = clipped
            line_ink = int(np.count_nonzero(canonical[y:y + h, x:x + w] == 255))
            largest_line_ink = max(largest_line_ink, line_ink)

        metrics["largest_line_ink_share"] = _safe_ratio(
            largest_line_ink, total_ink,
        )

    metrics["text_component_count"] = _text_component_count(canonical)

    return metrics


# ============================================================
# PUBLIC STAGE 1B GATE
# ============================================================

def evaluate_segmentation_reliability(segmentation):
    """
    Evaluate whether segmentation is reliable enough for Stage 2.

    RELAXED: only catastrophic failures block the ML model.
    Borderline issues are downgraded to warnings.
    """

    line_count = int(len(segmentation.get("lines", []) or []))
    word_count = int(len(segmentation.get("all_words", []) or []))
    character_count = int(segmentation.get("character_region_count", 0) or 0)

    word_geometry = _word_geometry_metrics(
        segmentation.get("line_records", [])
    )

    line_geometry = _line_geometry_metrics(segmentation)

    words_per_line = word_geometry["words_per_line"]
    regions_per_word = word_geometry["regions_per_word"]

    average_words_per_line = _safe_ratio(word_count, line_count)
    average_regions_per_word = _safe_ratio(character_count, word_count)

    text_component_count = int(line_geometry["text_component_count"])
    components_per_word = _safe_ratio(text_component_count, word_count)
    word_ink_coverage = _word_ink_coverage(segmentation)

    many_text_components = bool(
        text_component_count >= SEGMENTATION_LIMITS["many_component_count"]
    )

    metrics = {
        "line_count": int(line_count),
        "word_count": int(word_count),
        "character_region_count": int(character_count),
        "average_words_per_line": round(average_words_per_line, 3),
        "median_words_per_line": round(_median(words_per_line), 3),
        "average_regions_per_word": round(average_regions_per_word, 3),
        "median_regions_per_word": round(_median(regions_per_word), 3),
        "tiny_word_ratio": round(word_geometry["tiny_word_ratio"], 4),
        "tiny_region_ratio": round(word_geometry["tiny_region_ratio"], 4),
        "largest_line_height_ratio": round(
            float(line_geometry["largest_line_height_ratio"]), 4,
        ),
        "line_height_to_median_ratio": round(
            float(line_geometry["line_height_to_median_ratio"]), 4,
        ),
        "largest_line_ink_share": round(
            float(line_geometry["largest_line_ink_share"]), 4,
        ),
        "text_component_count": int(text_component_count),
        "text_components_per_word": round(components_per_word, 3),
        "page_text_height": int(line_geometry["page_text_height"]),
        "word_ink_coverage": round(word_ink_coverage, 4),
        "many_text_components": bool(many_text_components),
    }

    reasons = []
    warnings = []
    limits = SEGMENTATION_LIMITS

    # ========================================================
    # 1. EMPTY SEGMENTATION  — only block when truly empty
    # ========================================================
    if line_count <= 0 and word_count <= 0:
        reasons.append(
            "No reliable handwriting lines or words were segmented."
        )

    # ========================================================
    # 2. OVER-SEGMENTATION  — only extreme cases
    # ========================================================
    if line_count > limits["max_lines"]:
        reasons.append(
            "The page was split into an implausibly large number of lines."
        )

    if word_count > limits["max_words"]:
        reasons.append(
            "The page was split into an implausibly large number of words."
        )

    if character_count > limits["max_character_regions"]:
        reasons.append(
            "Character-region segmentation produced an implausibly large number of regions."
        )

    # Words-per-line and regions-per-word: downgraded to warnings
    if average_words_per_line > limits["max_average_words_per_line"]:
        warnings.append(
            "Many word regions were detected per writing line; review word segmentation."
        )

    if _median(words_per_line) > limits["max_median_words_per_line"]:
        warnings.append(
            "Typical writing lines contain many detected word regions."
        )

    if average_regions_per_word > limits["max_average_regions_per_word"]:
        warnings.append(
            "Many character regions were detected per word."
        )

    if _median(regions_per_word) > limits["max_median_regions_per_word"]:
        warnings.append(
            "Typical words contain many detected character regions."
        )

    if word_geometry["tiny_word_ratio"] > limits["max_tiny_word_ratio"]:
        warnings.append(
            "Most detected word regions are unusually small."
        )

    if word_geometry["tiny_region_ratio"] > limits["max_tiny_region_ratio"]:
        warnings.append(
            "Many character regions are very small."
        )

    # ========================================================
    # 3. UNDER-SEGMENTATION  — downgraded to warnings
    # ========================================================
    substantial_page_evidence = bool(
        line_count >= 3 or many_text_components
    )

    if (
        substantial_page_evidence
        and metrics["largest_line_height_ratio"] > limits["max_largest_line_height_ratio"]
    ):
        warnings.append(
            "One detected line occupies most of the handwriting height; possible merged lines."
        )

    if (
        substantial_page_evidence
        and metrics["line_height_to_median_ratio"] > limits["max_line_height_to_median_ratio"]
    ):
        warnings.append(
            "A detected line is much taller than the typical line; possible merged rows."
        )

    if (
        substantial_page_evidence
        and metrics["largest_line_ink_share"] > limits["max_largest_line_ink_share"]
    ):
        warnings.append(
            "One detected line contains most of the handwriting ink."
        )

    # ========================================================
    # 4. COMPONENT-VS-WORD  — advisory only
    # ========================================================
    if (
        word_count > 0
        and many_text_components
        and components_per_word > limits["max_text_components_per_word"]
    ):
        warnings.append(
            "Many text-like components were detected per word."
        )

    if (
        many_text_components
        and word_count < limits["min_words_when_many_components"]
    ):
        if word_count <= 0:
            reasons.append(
                "The page contains many handwriting components but no usable word regions."
            )
        else:
            warnings.append(
                "The page contains many components but few word regions."
            )

    # ========================================================
    # 5. WORD INK COVERAGE  — only block at extreme low
    # ========================================================
    if (
        many_text_components
        and word_count > 0
        and word_ink_coverage < limits["min_word_ink_coverage"]
    ):
        if word_ink_coverage < 0.08:
            reasons.append(
                "Detected word regions cover almost no handwriting ink."
            )
        else:
            warnings.append(
                "Detected word regions cover only part of the handwriting ink."
            )

    # ========================================================
    # 6. SOFT WARNINGS
    # ========================================================
    if not reasons and line_count >= 30:
        warnings.append(
            "A high line count was detected; visually verify the line debug image."
        )

    if not reasons and average_words_per_line >= 20:
        warnings.append(
            "A high number of words per line was detected."
        )

    if not reasons and word_ink_coverage < 0.40 and word_count > 0:
        warnings.append(
            "Some handwriting ink may not be represented by detected word regions."
        )

    # ========================================================
    # FINAL RESULT
    # ========================================================
    reliable = bool(len(reasons) == 0)

    return {
        "status": (
            "Usable With Warning"
            if reliable and warnings
            else (
                "Reliable"
                if reliable
                else "Segmentation Unreliable"
            )
        ),
        "reliable": bool(reliable),
        "reliable_for_stage2": bool(reliable),
        "threshold_source": "relaxed_segmentation_gate_v2",
        "metrics": metrics,
        "limits": dict(limits),
        "warnings": warnings,
        "reasons": reasons,
    }