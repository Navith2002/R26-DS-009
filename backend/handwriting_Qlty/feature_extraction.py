"""
feature_extraction.py
=====================

Canonical feature extraction for the bilingual Handwriting Quality Analysis
System.

Binary convention
-----------------
handwriting / ink = 255
background        = 0

Stage 1 input-quality features
------------------------------
contrast_score
blur_score
ink_density
text_visibility_score
word_detection_ratio

Stage 2 Tamil model features (10)
--------------------------------
spacing_std
baseline_std
local_baseline_drift
avg_slant
avg_size_variation
curve_smoothness
loop_roundness
stroke_continuity
stroke_thickness_consistency
density_distribution

Stage 2 Sinhala model features (15)
----------------------------------
Tamil/common 10 +
character_shape_consistency
character_proportion_variation
upper_lower_balance
character_spacing_variation
word_spacing_variation

IMPORTANT
---------
All pixel-facing feature functions use image_utils.ensure_ink_white().
The saved ML model remains the source of truth for the final quality class.
"""

import cv2
import numpy as np
from scipy.ndimage import distance_transform_edt

from image_utils import ensure_gray, ensure_ink_white


TAMIL_QUALITY_FEATURES = [
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
]

SINHALA_QUALITY_FEATURES = TAMIL_QUALITY_FEATURES + [
    "character_shape_consistency",
    "character_proportion_variation",
    "upper_lower_balance",
    "character_spacing_variation",
    "word_spacing_variation",
]

STAGE1_IMAGE_QUALITY_FEATURES = [
    "contrast_score",
    "blur_score",
    "ink_density",
    "text_visibility_score",
    "word_detection_ratio",
]


# ============================================================
# BACKWARD-COMPATIBLE IMAGE ALIASES
# ============================================================

def ensure_binary(image):
    """Backward-compatible alias for the canonical polarity helper."""
    return ensure_ink_white(image)


def get_foreground(image):
    """Backward-compatible alias; never blindly inverts pixels."""
    return ensure_ink_white(image)


# ============================================================
# NUMERIC HELPERS
# ============================================================

def _finite(values):
    output = []

    for value in values:
        try:
            number = float(value)
            if np.isfinite(number):
                output.append(number)
        except Exception:
            continue

    return output


def _safe_mean(values):
    clean = _finite(values)
    return float(np.mean(clean)) if clean else np.nan


def _safe_cv(values):
    clean = np.asarray(
        _finite(values),
        dtype=float,
    )

    if len(clean) < 2:
        return np.nan

    mean_value = float(np.mean(clean))

    if abs(mean_value) < 1e-12:
        return np.nan

    return float(
        np.std(clean)
        / (abs(mean_value) + 1e-6)
    )


def _valid_gaps(boxes):
    """Horizontal gaps between adjacent x-sorted boxes."""
    if boxes is None or len(boxes) < 2:
        return []

    try:
        boxes = sorted(
            boxes,
            key=lambda box: box[0],
        )
    except Exception:
        return []

    gaps = []

    for first, second in zip(
        boxes[:-1],
        boxes[1:],
    ):
        try:
            x1, _, w1, h1 = first
            x2, _, w2, h2 = second

            if w1 <= 0 or h1 <= 0 or w2 <= 0 or h2 <= 0:
                continue

            gap = float(
                x2 - (x1 + w1)
            )

            if gap >= 0:
                gaps.append(gap)
        except Exception:
            continue

    return gaps


# ============================================================
# COMMON STRUCTURAL FEATURES
# ============================================================

def calculate_word_spacing(word_boxes):
    """
    Normalized variation in adjacent word gaps.
    Lower = more consistent.
    """
    return _safe_cv(
        _valid_gaps(word_boxes)
    )


def calculate_word_spacing_variation(
    word_boxes_or_line_box_lists,
):
    """
    Explicit word-spacing variation.

    Accepts either one list of boxes or a list of per-line box lists.
    For production, use per-line local word boxes so line transitions are not
    interpreted as giant word gaps.
    """
    if not word_boxes_or_line_box_lists:
        return np.nan

    first = word_boxes_or_line_box_lists[0]

    if (
        isinstance(first, (list, tuple))
        and len(first) == 4
        and all(
            isinstance(
                value,
                (int, float, np.integer, np.floating),
            )
            for value in first
        )
    ):
        return calculate_word_spacing(
            word_boxes_or_line_box_lists
        )

    values = []

    for boxes in word_boxes_or_line_box_lists:
        value = calculate_word_spacing(boxes)

        if np.isfinite(value):
            values.append(value)

    return _safe_mean(values)


def calculate_baseline_variation(word_boxes):
    """Normalized variation of word bottom positions."""
    if word_boxes is None or len(word_boxes) < 2:
        return np.nan

    baselines = []

    for box in word_boxes:
        try:
            _, y, w, h = box

            if w > 0 and h > 0:
                baselines.append(
                    float(y + h)
                )
        except Exception:
            continue

    if len(baselines) < 2:
        return np.nan

    mean_baseline = float(
        np.mean(baselines)
    )

    return float(
        np.std(baselines)
        / (abs(mean_baseline) + 1e-6)
    )


def calculate_local_baseline_drift(word_boxes):
    """
    Mean absolute movement between successive word baselines.

    Kept in pixel scale for compatibility with the existing trained model.
    """
    if word_boxes is None or len(word_boxes) < 2:
        return np.nan

    try:
        boxes = sorted(
            word_boxes,
            key=lambda box: box[0],
        )
    except Exception:
        return np.nan

    baselines = []

    for box in boxes:
        try:
            _, y, w, h = box

            if w > 0 and h > 0:
                baselines.append(
                    float(y + h)
                )
        except Exception:
            continue

    if len(baselines) < 2:
        return np.nan

    return float(
        np.mean(
            np.abs(
                np.diff(
                    np.asarray(
                        baselines,
                        dtype=float,
                    )
                )
            )
        )
    )


def calculate_slant_angle(words):
    angles = []

    if words is None:
        return np.nan

    for word in words:
        foreground = ensure_ink_white(word)

        if foreground is None:
            continue

        coords = np.column_stack(
            np.where(
                foreground == 255
            )
        )

        if len(coords) < 10:
            continue

        try:
            xy = coords[:, ::-1].astype(
                np.float32
            )

            angle = float(
                cv2.minAreaRect(xy)[-1]
            )

            if angle > 45:
                angle -= 90

            angle = abs(angle)

            if angle <= 60:
                angles.append(angle)
        except Exception:
            continue

    return _safe_mean(angles)


def calculate_size_variation(words):
    heights = []

    if words is None:
        return np.nan

    for word in words:
        foreground = ensure_ink_white(word)

        if foreground is None:
            continue

        try:
            contours, _ = cv2.findContours(
                foreground,
                cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_SIMPLE,
            )
        except Exception:
            continue

        for contour in contours:
            _, _, w, h = cv2.boundingRect(
                contour
            )

            if w > 2 and h > 2:
                heights.append(float(h))

    return _safe_cv(heights)


# ============================================================
# CURVE / STROKE FEATURES
# ============================================================

def calculate_curve_smoothness(words):
    values = []

    if words is None:
        return np.nan

    for word in words:
        foreground = ensure_ink_white(word)

        if foreground is None:
            continue

        try:
            contours, _ = cv2.findContours(
                foreground,
                cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_NONE,
            )
        except Exception:
            continue

        for contour in contours:
            if len(contour) < 20:
                continue

            perimeter = float(
                cv2.arcLength(
                    contour,
                    True,
                )
            )

            if perimeter <= 0:
                continue

            approx = cv2.approxPolyDP(
                contour,
                0.01 * perimeter,
                True,
            )

            values.append(
                float(
                    len(approx)
                    / (perimeter + 1e-6)
                )
            )

    return _safe_mean(values)


def calculate_loop_roundness(words):
    values = []

    if words is None:
        return np.nan

    for word in words:
        foreground = ensure_ink_white(word)

        if foreground is None:
            continue

        try:
            contours, _ = cv2.findContours(
                foreground,
                cv2.RETR_CCOMP,
                cv2.CHAIN_APPROX_SIMPLE,
            )
        except Exception:
            continue

        for contour in contours:
            area = float(
                cv2.contourArea(contour)
            )

            if area < 20:
                continue

            perimeter = float(
                cv2.arcLength(
                    contour,
                    True,
                )
            )

            if perimeter <= 0:
                continue

            circularity = (
                4.0
                * np.pi
                * area
                / (perimeter ** 2 + 1e-6)
            )

            values.append(
                float(
                    np.clip(
                        circularity,
                        0.0,
                        1.0,
                    )
                )
            )

    return _safe_mean(values)


def calculate_stroke_continuity(words):
    values = []

    if words is None:
        return np.nan

    for word in words:
        foreground = ensure_ink_white(word)

        if foreground is None:
            continue

        try:
            count, _, stats, _ = (
                cv2.connectedComponentsWithStats(
                    foreground,
                    connectivity=8,
                )
            )
        except Exception:
            continue

        sizes = []

        for index in range(1, count):
            area = float(
                stats[
                    index,
                    cv2.CC_STAT_AREA,
                ]
            )

            if area > 10:
                sizes.append(area)

        if not sizes:
            continue

        values.append(
            float(
                max(sizes)
                / (sum(sizes) + 1e-6)
            )
        )

    return _safe_mean(values)


def calculate_stroke_thickness_consistency(words):
    widths = []

    if words is None:
        return np.nan

    for word in words:
        foreground = ensure_ink_white(word)

        if foreground is None:
            continue

        mask = foreground == 255

        if not np.any(mask):
            continue

        distance = distance_transform_edt(
            mask
        )

        values = distance[
            distance > 0
        ]

        if len(values):
            widths.extend(
                values.astype(float)
            )

    return _safe_cv(widths)


def calculate_density_distribution(words):
    """
    Variation of ink counts between top/middle/bottom thirds.

    Kept in raw pixel scale for compatibility with the existing model.
    """
    values = []

    if words is None:
        return np.nan

    for word in words:
        foreground = ensure_ink_white(word)

        if foreground is None:
            continue

        h, w = foreground.shape[:2]

        if h < 3 or w < 1:
            continue

        thirds = [
            foreground[:h // 3],
            foreground[
                h // 3:
                (2 * h) // 3
            ],
            foreground[
                (2 * h) // 3:
            ],
        ]

        counts = [
            np.count_nonzero(
                part == 255
            )
            for part in thirds
        ]

        values.append(
            float(
                np.std(counts)
            )
        )

    return _safe_mean(values)


# ============================================================
# CHARACTER-REGION FEATURES
# ============================================================

def calculate_character_proportion_variation(
    per_word_character_boxes,
):
    """Average per-word CV of character-region width/height ratios."""
    per_word = []

    for boxes in (
        per_word_character_boxes
        or []
    ):
        ratios = []

        for box in boxes:
            try:
                _, _, w, h = box

                if w > 0 and h > 0:
                    ratios.append(
                        float(w / h)
                    )
            except Exception:
                continue

        value = _safe_cv(ratios)

        if np.isfinite(value):
            per_word.append(value)

    return _safe_mean(per_word)


def _region_descriptor(region):
    foreground = ensure_ink_white(region)

    if foreground is None:
        return None

    try:
        contours, _ = cv2.findContours(
            foreground,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )
    except Exception:
        return None

    if not contours:
        return None

    contour = max(
        contours,
        key=cv2.contourArea,
    )

    area = float(
        cv2.contourArea(contour)
    )

    perimeter = float(
        cv2.arcLength(
            contour,
            True,
        )
    )

    _, _, w, h = cv2.boundingRect(
        contour
    )

    if (
        area <= 0
        or perimeter <= 0
        or w <= 0
        or h <= 0
    ):
        return None

    aspect = float(w / h)
    extent = float(
        area
        / (w * h + 1e-6)
    )

    circularity = float(
        np.clip(
            4.0
            * np.pi
            * area
            / (perimeter ** 2 + 1e-6),
            0.0,
            1.0,
        )
    )

    return np.asarray(
        [
            aspect,
            extent,
            circularity,
        ],
        dtype=float,
    )


def calculate_character_shape_consistency(
    per_word_character_regions,
):
    """
    Geometric consistency of structural regions within each word.
    Higher = more consistent.
    """
    word_scores = []

    for regions in (
        per_word_character_regions
        or []
    ):
        descriptors = []

        for region in regions:
            descriptor = _region_descriptor(
                region
            )

            if descriptor is not None:
                descriptors.append(
                    descriptor
                )

        if len(descriptors) < 2:
            continue

        values = np.vstack(
            descriptors
        )

        means = np.mean(
            values,
            axis=0,
        )

        stds = np.std(
            values,
            axis=0,
        )

        variation = float(
            np.mean(
                stds
                / (np.abs(means) + 1e-6)
            )
        )

        word_scores.append(
            float(
                np.clip(
                    1.0 / (1.0 + variation),
                    0.0,
                    1.0,
                )
            )
        )

    return _safe_mean(word_scores)


def calculate_upper_lower_balance(
    per_word_character_regions,
):
    """Mean upper/lower ink balance. Higher = more balanced."""
    values = []

    for regions in (
        per_word_character_regions
        or []
    ):
        for region in regions:
            foreground = ensure_ink_white(
                region
            )

            if foreground is None:
                continue

            h, _ = foreground.shape[:2]

            if h < 2:
                continue

            mid = h // 2

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

            if total <= 0:
                continue

            values.append(
                float(
                    np.clip(
                        1.0
                        - abs(upper - lower)
                        / total,
                        0.0,
                        1.0,
                    )
                )
            )

    return _safe_mean(values)


def calculate_character_spacing_variation(
    per_word_character_boxes,
):
    """
    Average per-word character-region spacing variation.
    Lower = more consistent.
    """
    values = []

    for boxes in (
        per_word_character_boxes
        or []
    ):
        value = _safe_cv(
            _valid_gaps(boxes)
        )

        if np.isfinite(value):
            values.append(value)

    return _safe_mean(values)


# ============================================================
# STAGE 1 INPUT-QUALITY FEATURES
# ============================================================

def calculate_contrast_score(image):
    gray = ensure_gray(image)

    return (
        float(np.std(gray))
        if gray is not None
        else np.nan
    )


def calculate_blur_score(image):
    gray = ensure_gray(image)

    if gray is None:
        return np.nan

    try:
        return float(
            cv2.Laplacian(
                gray,
                cv2.CV_64F,
            ).var()
        )
    except Exception:
        return np.nan


def calculate_ink_density(binary_image):
    foreground = ensure_ink_white(
        binary_image
    )

    if (
        foreground is None
        or foreground.size == 0
    ):
        return np.nan

    return float(
        np.count_nonzero(
            foreground == 255
        )
        / foreground.size
        * 100.0
    )


def calculate_text_visibility_score(
    image,
    binary_image=None,
):
    if binary_image is None:
        binary_image = ensure_ink_white(
            image
        )

    contrast = calculate_contrast_score(
        image
    )

    blur = calculate_blur_score(
        image
    )

    density = calculate_ink_density(
        binary_image
    )

    if not all(
        np.isfinite(value)
        for value in (
            contrast,
            blur,
            density,
        )
    ):
        return np.nan

    return float(
        contrast * 0.50
        + min(blur, 300.0) * 0.10
        + density * 3.00
    )


def calculate_word_detection_ratio(
    word_boxes,
    image_shape,
):
    """Percentage of page area occupied by detected word boxes."""
    if (
        word_boxes is None
        or not word_boxes
        or image_shape is None
    ):
        return np.nan

    try:
        image_h = int(image_shape[0])
        image_w = int(image_shape[1])
    except Exception:
        return np.nan

    image_area = image_h * image_w

    if image_area <= 0:
        return np.nan

    detected_area = 0.0

    for box in word_boxes:
        try:
            _, _, w, h = box

            if w > 0 and h > 0:
                detected_area += float(w * h)
        except Exception:
            continue

    return float(
        detected_area
        / image_area
        * 100.0
    )


def calculate_readability_features(
    image,
    binary_image,
    word_boxes,
):
    image_shape = (
        binary_image.shape
        if isinstance(
            binary_image,
            np.ndarray,
        )
        else None
    )

    return {
        "contrast_score":
            calculate_contrast_score(image),
        "blur_score":
            calculate_blur_score(image),
        "ink_density":
            calculate_ink_density(binary_image),
        "text_visibility_score":
            calculate_text_visibility_score(
                image,
                binary_image,
            ),
        "word_detection_ratio":
            calculate_word_detection_ratio(
                word_boxes,
                image_shape,
            ),
    }


# ============================================================
# FINAL LINE-RECORD BASED EXTRACTION
# ============================================================

def _all_words(line_records):
    words = []

    for record in (
        line_records
        or []
    ):
        words.extend(
            record.get(
                "words",
                [],
            )
        )

    return words


def extract_tamil_quality_features(
    line_records,
):
    """
    Produce exactly the 10 Stage 2 Tamil/common features.

    Line-relative measurements are computed per line and then averaged to
    avoid mixing coordinates across unrelated writing lines.
    """
    spacing_values = []
    baseline_values = []
    drift_values = []
    size_values = []
    curve_values = []
    loop_values = []
    continuity_values = []
    thickness_values = []
    density_values = []

    for record in (
        line_records
        or []
    ):
        words = record.get(
            "words",
            [],
        )

        local_boxes = record.get(
            "local_word_boxes",
            [],
        )

        if not words:
            continue

        spacing_values.append(
            calculate_word_spacing(
                local_boxes
            )
        )

        baseline_values.append(
            calculate_baseline_variation(
                local_boxes
            )
        )

        drift_values.append(
            calculate_local_baseline_drift(
                local_boxes
            )
        )

        size_values.append(
            calculate_size_variation(
                words
            )
        )

        curve_values.append(
            calculate_curve_smoothness(
                words
            )
        )

        loop_values.append(
            calculate_loop_roundness(
                words
            )
        )

        continuity_values.append(
            calculate_stroke_continuity(
                words
            )
        )

        thickness_values.append(
            calculate_stroke_thickness_consistency(
                words
            )
        )

        density_values.append(
            calculate_density_distribution(
                words
            )
        )

    all_words = _all_words(
        line_records
    )

    features = {
        "spacing_std":
            _safe_mean(spacing_values),
        "baseline_std":
            _safe_mean(baseline_values),
        "local_baseline_drift":
            _safe_mean(drift_values),
        "avg_slant":
            calculate_slant_angle(
                all_words
            ),
        "avg_size_variation":
            _safe_mean(size_values),
        "curve_smoothness":
            _safe_mean(curve_values),
        "loop_roundness":
            _safe_mean(loop_values),
        "stroke_continuity":
            _safe_mean(continuity_values),
        "stroke_thickness_consistency":
            _safe_mean(thickness_values),
        "density_distribution":
            _safe_mean(density_values),
    }

    return validate_feature_vector(
        features,
        TAMIL_QUALITY_FEATURES,
    )


def extract_sinhala_quality_features(
    line_records,
):
    """Produce the final 15-feature Sinhala model input."""
    features = dict(
        extract_tamil_quality_features(
            line_records
        )
    )

    per_word_regions = []
    per_word_boxes = []
    line_word_boxes = []

    for line_record in (
        line_records
        or []
    ):
        line_word_boxes.append(
            line_record.get(
                "local_word_boxes",
                [],
            )
        )

        for word_record in line_record.get(
            "word_records",
            [],
        ):
            per_word_regions.append(
                word_record.get(
                    "character_regions",
                    [],
                )
            )

            per_word_boxes.append(
                word_record.get(
                    "character_boxes",
                    [],
                )
            )

    features.update(
        {
            "character_shape_consistency":
                calculate_character_shape_consistency(
                    per_word_regions
                ),
            "character_proportion_variation":
                calculate_character_proportion_variation(
                    per_word_boxes
                ),
            "upper_lower_balance":
                calculate_upper_lower_balance(
                    per_word_regions
                ),
            "character_spacing_variation":
                calculate_character_spacing_variation(
                    per_word_boxes
                ),
            "word_spacing_variation":
                calculate_word_spacing_variation(
                    line_word_boxes
                ),
        }
    )

    return validate_feature_vector(
        features,
        SINHALA_QUALITY_FEATURES,
    )


def extract_quality_features(
    language,
    line_records,
):
    language = str(
        language
    ).strip().lower()

    if language == "tamil":
        return extract_tamil_quality_features(
            line_records
        )

    if language == "sinhala":
        return extract_sinhala_quality_features(
            line_records
        )

    raise ValueError(
        "Unsupported language. Expected 'sinhala' or 'tamil'."
    )


# ============================================================
# STRICT MODEL FEATURE VALIDATION
# ============================================================

def validate_feature_vector(
    features,
    expected_features,
):
    if not isinstance(features, dict):
        raise TypeError(
            "features must be a dictionary."
        )

    missing = [
        feature
        for feature in expected_features
        if feature not in features
    ]

    if missing:
        raise ValueError(
            "Missing model features: "
            + ", ".join(missing)
        )

    ordered = {}

    for feature in expected_features:
        value = features[feature]

        try:
            number = float(value)
            ordered[feature] = (
                number
                if np.isfinite(number)
                else np.nan
            )
        except Exception:
            ordered[feature] = np.nan

    return ordered


# ============================================================
# BACKWARD-COMPATIBLE COLLECTION
# ============================================================

def extract_all_features(
    image,
    binary_image,
    words,
    word_boxes,
    language="tamil",
):
    """
    Legacy convenience wrapper.

    Production analysis should use extract_quality_features(language,
    line_records) so character-region segmentation and line-aware aggregation
    are preserved.
    """
    pseudo_record = {
        "words": list(words or []),
        "local_word_boxes": list(
            word_boxes or []
        ),
        "word_records": [],
    }

    if str(language).lower() == "tamil":
        quality = extract_tamil_quality_features(
            [pseudo_record]
        )
    else:
        quality = {
            **extract_tamil_quality_features(
                [pseudo_record]
            ),
            "character_shape_consistency": np.nan,
            "character_proportion_variation": np.nan,
            "upper_lower_balance": np.nan,
            "character_spacing_variation": np.nan,
            "word_spacing_variation":
                calculate_word_spacing(
                    word_boxes
                ),
        }

    quality.update(
        calculate_readability_features(
            image,
            binary_image,
            word_boxes,
        )
    )

    return quality
