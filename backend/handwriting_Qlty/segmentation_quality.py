"""Stage 1B structural segmentation gate.

Missing records, combined merged-line failures and severe fragmentation block
classification. Isolated borderline geometry remains advisory. These are
engineering safeguards requiring evaluation on labelled captures.
"""

from __future__ import annotations

import cv2
import numpy as np

from image_utils import ensure_canonical_binary as ensure_ink_white


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

    Missing records, combined merged-line evidence and severe fragmentation
    block the model. Isolated borderline measurements remain warnings.
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
    if line_count <= 0 or word_count <= 0:
        reasons.append(
            "No reliable handwriting lines or words were segmented."
        )

    records = segmentation.get("line_records", []) or []
    if line_count and len(records) != line_count:
        reasons.append("Line records are missing or inconsistent with detected lines.")
    recorded_words = sum(len(r.get("word_records", []) or []) for r in records)
    if word_count and recorded_words != word_count:
        reasons.append("Word records are missing or inconsistent with detected words.")

    if (many_text_components and components_per_word > 60
            and word_geometry["tiny_region_ratio"] > .65):
        reasons.append("Too many fragmented components and tiny regions make word measurements unreliable.")

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

    # Audited catastrophic over-segmentation pattern.
    if word_count >= 350 and character_count >= 1500:
        reasons.append(
            "The handwriting was severely over-segmented into too many "
            "word and character regions."
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
    # 3. UNDER-SEGMENTATION — combined extremes block; individual warnings
    # ========================================================
    substantial_page_evidence = bool(
        line_count >= 3 or many_text_components
    )

    merged_line_failure = bool(
        substantial_page_evidence
        and metrics["largest_line_height_ratio"]
        > limits["max_largest_line_height_ratio"]
        and metrics["line_height_to_median_ratio"]
        > limits["max_line_height_to_median_ratio"]
    )
    if merged_line_failure:
        reasons.append(
            "Possible merged handwriting lines were detected; "
            "too few word regions may represent multiple writing rows."
        )

    if (
        not merged_line_failure
        and substantial_page_evidence
        and metrics["largest_line_height_ratio"] > limits["max_largest_line_height_ratio"]
    ):
        warnings.append(
            "One detected line occupies most of the handwriting height; possible merged lines."
        )

    if (
        not merged_line_failure
        and substantial_page_evidence
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
        if word_ink_coverage < limits["min_word_ink_coverage"]:
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
        "threshold_source": "structural_segmentation_gate_v3",
        "metrics": metrics,
        "limits": dict(limits),
        "warnings": warnings,
        "reasons": reasons,
    }


def _repeated_glyph_metrics(mask):
    """Find multiple exactly repeated raster shapes, supporting print suspicion.

    No rejection is based on neatness, equal spacing or equal character size.
    Six distinct repeated substantial bitmap shapes are required. This only
    catches some digital print; it cannot certify photographed print/handwriting.
    """
    from collections import Counter

    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    signatures = []
    for index in range(1, count):
        x, y, width, height, area = stats[index]
        if (height >= 10 and width >= 5 and area >= 25
                and .08 < area / (width * height) < .85):
            glyph = labels[y:y+height, x:x+width] == index
            signatures.append((int(width), int(height), np.packbits(glyph).tobytes()))
    counts = Counter(signatures)
    duplicates = [value for value in counts.values() if value >= 2]
    suspected = bool(len(signatures) >= 30 and len(duplicates) >= 6)
    return {"substantial_component_count": len(signatures),
            "exact_repeated_shape_groups": len(duplicates),
            "exact_repeated_component_count": sum(duplicates),
            "suspected_printed_text": suspected}


def evaluate_handwriting_presence(binary):
    """Screen text structure; passing is not proof of handwritten origin.

    This existing module owns Stage 1 presence and segmentation validation.
    The limits are development safeguards, not validated detector accuracy.
    """
    mask = ensure_ink_white(binary)
    reasons, metrics = [], {}
    status = "NON_HANDWRITING_INPUT"
    if mask is None:
        reasons.append("No usable writing mask was available.")
    else:
        repetition = _repeated_glyph_metrics(mask)
        # Analysis-only resizing: never alter the Stage 2 feature scale.
        scale = min(1.0, 1200.0 / max(mask.shape))
        if scale < 1:
            mask = cv2.resize(mask, None, fx=scale, fy=scale,
                              interpolation=cv2.INTER_NEAREST)
        h, w = mask.shape
        ink = int(np.count_nonzero(mask))
        density = ink / mask.size
        n, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
        candidates = []
        for i in range(1, n):
            x, y, cw, ch, area = stats[i]
            # Exclude speckles, ruling/borders and large pictorial shapes.
            if (area >= 5 and 3 <= ch <= h * .9
                    and 2 <= cw <= w * .35 and .06 <= cw / ch <= 18
                    and area / mask.size <= .15 and area / (cw * ch) <= .9):
                candidates.append((i, x, y, cw, ch, area))
        candidate_ink = sum(int(c[-1]) for c in candidates)
        # Group components by vertical centre with a script-neutral tolerance.
        rows = []
        median_height = float(np.median([c[4] for c in candidates])) if candidates else 0
        for c in sorted(candidates, key=lambda c: c[2] + c[4] / 2):
            cy = c[2] + c[4] / 2
            if rows and abs(cy - np.median([a[2] + a[4]/2 for a in rows[-1]])) <= max(4, median_height * .65):
                rows[-1].append(c)
            else:
                rows.append([c])
        aligned = [c for row in rows if len(row) >= 3 for c in row]
        largest_share = float(stats[1:, cv2.CC_STAT_AREA].max() / max(ink, 1)) if n > 1 else 0
        row_ink = np.count_nonzero(mask, axis=1).astype(float)
        nonempty = np.flatnonzero(row_ink)
        content_rows = row_ink[nonempty[0]:nonempty[-1]+1] if len(nonempty) else row_ink
        p10, p90 = np.percentile(content_rows, [10, 90])
        row_modulation = float((p90 - p10) / max(p90, 1))
        metrics = {
            **repetition,
            "row_projection_modulation": round(row_modulation, 4),
            "ink_fraction": round(density, 4),
            "text_like_component_count": len(candidates),
            "text_like_ink_fraction": round(candidate_ink / max(ink, 1), 4),
            "aligned_component_fraction": round(len(aligned) / max(len(candidates), 1), 4),
            "supported_row_count": sum(len(row) >= 3 for row in rows),
            "largest_component_ink_fraction": round(largest_share, 4),
        }
        if ink < 20 or density < .001:
            status = "INPUT_RETAKE_REQUIRED"
            reasons.append("The image has too little visible writing to assess.")
        else:
            if repetition["suspected_printed_text"]:
                reasons.append("Multiple exactly repeated character shapes suggest printed or digitally repeated text; upload an original handwriting sample.")
            if row_modulation < .50:
                reasons.append("Foreground texture is distributed uniformly instead of forming writing rows.")
            if density > .45:
                reasons.append("The foreground is too dense to be a writing sample.")
            if len(candidates) < 6:
                reasons.append("Too few separate text-like strokes support handwriting analysis.")
            if candidate_ink / max(ink, 1) < .35:
                reasons.append("Most foreground belongs to large shapes, rules or non-text regions.")
            if len(aligned) / max(len(candidates), 1) < .45:
                reasons.append("The marks do not provide enough evidence of text arranged in rows.")
            if largest_share > .65:
                reasons.append("A single connected object dominates the foreground.")
    accepted = not reasons
    return {
        "status": "TEXT_LIKE_STRUCTURE" if accepted else status,
        "valid_for_stage2": accepted,
        "handwritten_origin_verified": False,
        "method": "text_structure_and_raster_repetition_screen_v2",
        "metrics": metrics,
        "reasons": reasons,
        "limitations": ["Printed text and text-like drawings can pass this structural screen.",
                        "A separately validated handwriting-versus-print/photo detector is required for that distinction."],
    }
