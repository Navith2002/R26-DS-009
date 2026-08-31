"""
segmentation.py
===============

Production structural segmentation for Sinhala and Tamil handwriting.

Public API
----------
    segment_lines(binary_img) -> (lines, line_boxes)
    segment_words(line_img) -> (words, word_boxes)
    segment_character_regions(word_img, language="sinhala")
        -> (regions, region_boxes)

Canonical binary convention
---------------------------
    handwriting / foreground = 255 (WHITE)
    background               =   0 (BLACK)

Coordinate convention
---------------------
    every box = (x, y, width, height)

    line_boxes:
        page/global coordinates

    word_boxes:
        local coordinates inside the returned line crop

    character-region boxes:
        local coordinates inside the returned word crop

Important research wording
--------------------------
Character segmentation here means STRUCTURAL CHARACTER REGIONS.
It is not OCR and does not claim that every returned region is a
linguistically recognized Sinhala/Tamil character.
"""

from __future__ import annotations

import cv2
import numpy as np

from image_utils import ensure_ink_white


# ============================================================
# CONFIGURATION
# ============================================================

MIN_COMPONENT_AREA_PIXELS = 3
MIN_COMPONENT_AREA_RATIO = 0.000001

MIN_LINE_INK_PIXELS = 12
MIN_WORD_INK_PIXELS = 6
MIN_CHARACTER_INK_PIXELS = 3

LINE_HORIZONTAL_PADDING_RATIO = 0.08
LINE_VERTICAL_PADDING_RATIO = 0.08

WORD_HORIZONTAL_PADDING_RATIO = 0.04
WORD_VERTICAL_PADDING_RATIO = 0.06

MIN_WORD_WIDTH_RATIO_TO_LINE_HEIGHT = 0.08
MIN_WORD_HEIGHT_RATIO_TO_LINE_HEIGHT = 0.10


# Residual horizontal structures are removed only from the
# segmentation-analysis mask.
#
# Returned crops still come from the original cleaned binary image.
PROJECTION_HORIZONTAL_KERNEL_RATIOS = (
    0.045,
    0.070,
    0.100,
)


CHARACTER_PARAMS = {
    "sinhala": {
        "body_height_ratio": 0.34,
        "body_area_ratio": 0.22,
        "body_merge_gap_height_ratio": 0.12,
        "modifier_attach_x_height_ratio": 0.80,
        "modifier_attach_y_height_ratio": 1.10,
        "region_padding_ratio": 0.05,
    },

    "tamil": {
        "body_height_ratio": 0.32,
        "body_area_ratio": 0.20,
        "body_merge_gap_height_ratio": 0.10,
        "modifier_attach_x_height_ratio": 0.72,
        "modifier_attach_y_height_ratio": 1.00,
        "region_padding_ratio": 0.05,
    },
}


# ============================================================
# BASIC HELPERS
# ============================================================

def ensure_foreground_white(image):
    """
    Backward-compatible alias.

    There is only ONE actual canonical polarity helper:
        image_utils.ensure_ink_white()
    """

    return ensure_ink_white(image)


def _clip_box(
    x,
    y,
    w,
    h,
    image_width,
    image_height,
):
    x = int(
        max(
            0,
            x,
        )
    )

    y = int(
        max(
            0,
            y,
        )
    )

    w = int(
        max(
            0,
            w,
        )
    )

    h = int(
        max(
            0,
            h,
        )
    )

    right = int(
        min(
            image_width,
            x + w,
        )
    )

    bottom = int(
        min(
            image_height,
            y + h,
        )
    )

    return (
        x,
        y,
        max(
            0,
            right - x,
        ),
        max(
            0,
            bottom - y,
        ),
    )


def _content_box(
    binary_img,
    padding_x=0,
    padding_y=0,
):
    """
    Tight foreground bounding box.

    Returns:
        (x, y, width, height)
    """

    canonical = ensure_ink_white(
        binary_img
    )

    if (
        canonical is None
        or canonical.ndim != 2
    ):
        return None

    coords = cv2.findNonZero(
        canonical
    )

    if coords is None:
        return None

    x, y, w, h = cv2.boundingRect(
        coords
    )

    image_h, image_w = (
        canonical.shape[:2]
    )

    return _clip_box(
        x - int(
            padding_x
        ),
        y - int(
            padding_y
        ),
        w
        + 2
        * int(
            padding_x
        ),
        h
        + 2
        * int(
            padding_y
        ),
        image_w,
        image_h,
    )


def crop_content(
    binary_img,
    padding=5,
):
    """
    Backward-compatible content crop.
    """

    canonical = ensure_ink_white(
        binary_img
    )

    if canonical is None:
        return None

    box = _content_box(
        canonical,
        padding_x=padding,
        padding_y=padding,
    )

    if box is None:
        return None

    x, y, w, h = box

    crop = canonical[
        y:y + h,
        x:x + w,
    ]

    if crop.size == 0:
        return None

    return crop.copy()


# ============================================================
# CONNECTED COMPONENT HELPERS
# ============================================================

def _component_stats(binary):
    """
    Get handwriting connected-component statistics.

    Very small noise is removed conservatively because both
    Sinhala and Tamil may contain small legitimate modifiers.
    """

    canonical = ensure_ink_white(
        binary
    )

    if (
        canonical is None
        or canonical.ndim != 2
    ):
        return []

    try:

        count, _, stats, _ = (
            cv2.connectedComponentsWithStats(
                canonical,
                connectivity=8,
            )
        )

        min_area = max(
            MIN_COMPONENT_AREA_PIXELS,
            int(
                canonical.size
                * MIN_COMPONENT_AREA_RATIO
            ),
        )

        result = []

        for label_id in range(
            1,
            count,
        ):

            x = int(
                stats[
                    label_id,
                    cv2.CC_STAT_LEFT,
                ]
            )

            y = int(
                stats[
                    label_id,
                    cv2.CC_STAT_TOP,
                ]
            )

            w = int(
                stats[
                    label_id,
                    cv2.CC_STAT_WIDTH,
                ]
            )

            h = int(
                stats[
                    label_id,
                    cv2.CC_STAT_HEIGHT,
                ]
            )

            area = int(
                stats[
                    label_id,
                    cv2.CC_STAT_AREA,
                ]
            )

            if (
                area < min_area
                or w <= 0
                or h <= 0
            ):
                continue

            result.append(
                {
                    "x": x,
                    "y": y,
                    "w": w,
                    "h": h,
                    "area": area,
                }
            )

        return result

    except Exception:
        return []


def _robust_median_component_height(
    binary,
):
    components = _component_stats(
        binary
    )

    values = np.asarray(
        [
            item["h"]
            for item in components
            if (
                item["h"] >= 2
                and item["h"]
                < binary.shape[0]
                * 0.50
            )
        ],
        dtype=float,
    )

    if values.size == 0:
        return max(
            4.0,
            binary.shape[0]
            * 0.05,
        )

    upper = np.percentile(
        values,
        90,
    )

    values = values[
        values <= upper
    ]

    if values.size == 0:
        return 4.0

    return float(
        np.median(
            values
        )
    )


def _robust_median_component_width(
    binary,
):
    components = _component_stats(
        binary
    )

    values = np.asarray(
        [
            item["w"]
            for item in components
            if (
                item["w"] >= 2
                and item["w"]
                < binary.shape[1]
                * 0.60
            )
        ],
        dtype=float,
    )

    if values.size == 0:
        return max(
            3.0,
            binary.shape[1]
            * 0.01,
        )

    upper = np.percentile(
        values,
        90,
    )

    values = values[
        values <= upper
    ]

    if values.size == 0:
        return 3.0

    return float(
        np.median(
            values
        )
    )


# ============================================================
# HORIZONTAL RULE SUPPRESSION FOR SEGMENTATION
# ============================================================

def _suppress_horizontal_artifacts(
    binary,
):
    """
    Create a temporary analysis mask for segmentation.

    This DOES NOT modify the actual handwriting image returned
    to later feature extraction.

    Remaining notebook-rule fragments are suppressed only so
    they cannot join several handwriting lines together.
    """

    canonical = ensure_ink_white(
        binary
    )

    if canonical is None:
        return None

    h, w = canonical.shape[:2]

    horizontal = np.zeros_like(
        canonical
    )

    for ratio in (
        PROJECTION_HORIZONTAL_KERNEL_RATIOS
    ):

        kernel_len = max(
            15,
            int(
                round(
                    w
                    * ratio
                )
            ),
        )

        kernel = (
            cv2.getStructuringElement(
                cv2.MORPH_RECT,
                (
                    kernel_len,
                    1,
                ),
            )
        )

        opened = cv2.morphologyEx(
            canonical,
            cv2.MORPH_OPEN,
            kernel,
        )

        horizontal = cv2.bitwise_or(
            horizontal,
            opened,
        )

    row_coverage = (
        np.count_nonzero(
            horizontal == 255,
            axis=1,
        )
        / max(
            1,
            w,
        )
    )

    # Only remove meaningful long-horizontal evidence.
    row_selector = (
        row_coverage
        >= 0.10
    )

    removal = np.zeros_like(
        canonical
    )

    removal[
        row_selector,
        :
    ] = horizontal[
        row_selector,
        :
    ]

    removal = cv2.dilate(
        removal,
        cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (3, 3),
        ),
        iterations=1,
    )

    analysis = cv2.bitwise_and(
        canonical,
        cv2.bitwise_not(
            removal
        ),
    )

    return ensure_ink_white(
        analysis
    )


# ============================================================
# 1-D PROFILE HELPERS
# ============================================================

def _smooth_profile(
    values,
    window,
):
    values = np.asarray(
        values,
        dtype=float,
    )

    if values.size == 0:
        return values

    window = max(
        1,
        int(
            window
        ),
    )

    if window % 2 == 0:
        window += 1

    if window <= 1:
        return values.copy()

    kernel = (
        np.ones(
            window,
            dtype=float,
        )
        / float(
            window
        )
    )

    return np.convolve(
        values,
        kernel,
        mode="same",
    )


def _true_runs(mask):
    mask = np.asarray(
        mask,
        dtype=bool,
    )

    indices = np.flatnonzero(
        mask
    )

    if indices.size == 0:
        return []

    runs = []

    start = int(
        indices[0]
    )

    previous = int(
        indices[0]
    )

    for index in indices[1:]:

        index = int(
            index
        )

        if index > previous + 1:

            runs.append(
                (
                    start,
                    previous,
                )
            )

            start = index

        previous = index

    runs.append(
        (
            start,
            previous,
        )
    )

    return runs


def _nonmaximum_peaks(
    profile,
    min_height,
    min_distance,
):
    """
    Dependency-free 1-D peak detector.
    """

    n = len(
        profile
    )

    if n < 3:
        return []

    candidates = []

    for index in range(
        1,
        n - 1,
    ):

        value = profile[
            index
        ]

        if (
            value >= min_height
            and value
            >= profile[
                index - 1
            ]
            and value
            > profile[
                index + 1
            ]
        ):

            candidates.append(
                index
            )

    chosen = []

    for index in sorted(
        candidates,
        key=lambda item:
            profile[
                item
            ],
        reverse=True,
    ):

        if all(
            abs(
                index
                - existing
            )
            >= min_distance
            for existing
            in chosen
        ):

            chosen.append(
                index
            )

    return sorted(
        chosen
    )


def _estimate_line_peaks(
    analysis_mask,
):
    """
    Detect handwriting-line centres using a smoothed
    horizontal ink profile.
    """

    h, w = (
        analysis_mask.shape[:2]
    )

    projection = (
        np.count_nonzero(
            analysis_mask == 255,
            axis=1,
        )
        .astype(
            float
        )
    )

    smooth_window = max(
        3,
        min(
            15,
            int(
                round(
                    h
                    * 0.015
                )
            ),
        ),
    )

    if smooth_window % 2 == 0:
        smooth_window += 1

    smoothed = _smooth_profile(
        projection,
        smooth_window,
    )

    positive = smoothed[
        smoothed > 0
    ]

    if positive.size == 0:
        return (
            [],
            projection,
            smoothed,
        )

    reference = float(
        np.percentile(
            positive,
            60,
        )
    )

    min_height = max(
        5.0,
        w * 0.010,
        reference * 0.65,
    )

    median_component_height = (
        _robust_median_component_height(
            analysis_mask
        )
    )

    min_distance = max(
        8,
        int(
            round(
                h
                * 0.040
            )
        ),
        int(
            round(
                median_component_height
                * 0.70
            )
        ),
    )

    peaks = _nonmaximum_peaks(
        smoothed,
        min_height=min_height,
        min_distance=min_distance,
    )

    # Remove weak residual-line peaks.
    prominence_radius = max(
        6,
        int(
            round(
                min_distance
                * 0.75
            )
        ),
    )

    filtered = []

    for peak in peaks:

        left = smoothed[
            max(
                0,
                peak - prominence_radius,
            ):
            peak + 1
        ]

        right = smoothed[
            peak:
            min(
                h,
                peak
                + prominence_radius
                + 1,
            )
        ]

        left_min = (
            float(
                np.min(
                    left
                )
            )
            if left.size
            else 0.0
        )

        right_min = (
            float(
                np.min(
                    right
                )
            )
            if right.size
            else 0.0
        )

        prominence = float(
            smoothed[
                peak
            ]
            - max(
                left_min,
                right_min,
            )
        )

        if prominence >= max(
            3.0,
            smoothed[
                peak
            ]
            * 0.10,
        ):

            filtered.append(
                int(
                    peak
                )
            )

    return (
        filtered,
        projection,
        smoothed,
    )


def _line_boundaries_from_peaks(
    peaks,
    smoothed,
):
    """
    Put line boundaries at valleys between neighbouring
    handwriting-line peaks.
    """

    if not peaks:
        return []

    boundaries = [
        0
    ]

    for (
        left_peak,
        right_peak,
    ) in zip(
        peaks[:-1],
        peaks[1:],
    ):

        segment = smoothed[
            left_peak:
            right_peak + 1
        ]

        if segment.size == 0:

            boundary = int(
                round(
                    (
                        left_peak
                        + right_peak
                    )
                    / 2.0
                )
            )

        else:

            boundary = int(
                left_peak
                + np.argmin(
                    segment
                )
            )

        boundaries.append(
            boundary
        )

    boundaries.append(
        len(
            smoothed
        )
        - 1
    )

    return boundaries


# ============================================================
# LINE SEGMENTATION
# ============================================================

def _fallback_line_runs(
    analysis_mask,
):
    """
    Conservative fallback if peak detection cannot detect
    useful line centres.
    """

    row_counts = np.count_nonzero(
        analysis_mask == 255,
        axis=1,
    )

    threshold = max(
        2,
        int(
            round(
                analysis_mask.shape[1]
                * 0.0015
            )
        ),
    )

    runs = _true_runs(
        row_counts
        >= threshold
    )

    if not runs:
        return []

    median_height = (
        _robust_median_component_height(
            analysis_mask
        )
    )

    max_gap = max(
        1,
        int(
            round(
                median_height
                * 0.18
            )
        ),
    )

    merged = []

    start, end = (
        runs[0]
    )

    for (
        next_start,
        next_end,
    ) in runs[1:]:

        gap = (
            next_start
            - end
            - 1
        )

        if gap <= max_gap:

            end = next_end

        else:

            merged.append(
                (
                    start,
                    end,
                )
            )

            start, end = (
                next_start,
                next_end,
            )

    merged.append(
        (
            start,
            end,
        )
    )

    return merged


def segment_lines(
    binary_img,
):
    """
    Segment a page into structural handwriting lines.

    Improvements over the old implementation:
    -----------------------------------------
    - canonical white-ink polarity
    - residual ruled-line suppression
    - no fixed 8-pixel row-gap threshold
    - smoothed row projection
    - peak detection
    - valley-based line boundaries
    - coordinate-preserving crops
    """

    canonical = ensure_ink_white(
        binary_img
    )

    if (
        canonical is None
        or canonical.ndim != 2
    ):
        return [], []

    page_h, page_w = (
        canonical.shape[:2]
    )

    if (
        page_h < 2
        or page_w < 2
    ):
        return [], []

    if np.count_nonzero(
        canonical == 255
    ) < MIN_LINE_INK_PIXELS:

        return [], []

    analysis_mask = (
        _suppress_horizontal_artifacts(
            canonical
        )
    )

    if analysis_mask is None:
        return [], []

    peaks, _, smoothed = (
        _estimate_line_peaks(
            analysis_mask
        )
    )

    candidate_bands = []

    if peaks:

        boundaries = (
            _line_boundaries_from_peaks(
                peaks,
                smoothed,
            )
        )

        for index in range(
            len(
                peaks
            )
        ):

            top = int(
                boundaries[
                    index
                ]
            )

            bottom = int(
                boundaries[
                    index + 1
                ]
            )

            if bottom <= top:
                continue

            candidate_bands.append(
                (
                    top,
                    bottom,
                )
            )

    else:

        candidate_bands = (
            _fallback_line_runs(
                analysis_mask
            )
        )

    if not candidate_bands:
        return [], []

    lines = []

    boxes = []

    for (
        band_top,
        band_bottom,
    ) in candidate_bands:

        band_top = max(
            0,
            int(
                band_top
            ),
        )

        band_bottom = min(
            page_h - 1,
            int(
                band_bottom
            ),
        )

        if band_bottom <= band_top:
            continue

        analysis_band = (
            analysis_mask[
                band_top:
                band_bottom + 1,
                :
            ]
        )

        if np.count_nonzero(
            analysis_band == 255
        ) < MIN_LINE_INK_PIXELS:

            continue

        band_height = (
            band_bottom
            - band_top
            + 1
        )

        pad_y = max(
            2,
            int(
                round(
                    band_height
                    * LINE_VERTICAL_PADDING_RATIO
                )
            ),
        )

        pad_x = max(
            2,
            int(
                round(
                    band_height
                    * LINE_HORIZONTAL_PADDING_RATIO
                )
            ),
        )

        tight = _content_box(
            analysis_band,
            padding_x=pad_x,
            padding_y=pad_y,
        )

        if tight is None:
            continue

        (
            local_x,
            local_y,
            width,
            height,
        ) = tight

        x, y, w, h = _clip_box(
            local_x,
            band_top
            + local_y,
            width,
            height,
            page_w,
            page_h,
        )

        if (
            w <= 0
            or h <= 0
        ):
            continue

        # IMPORTANT:
        # crop from canonical/original cleaned handwriting,
        # not from temporary rule-suppressed mask.
        crop = canonical[
            y:y + h,
            x:x + w,
        ]

        if (
            crop.size == 0
            or np.count_nonzero(
                crop == 255
            )
            < MIN_LINE_INK_PIXELS
        ):
            continue

        lines.append(
            crop.copy()
        )

        boxes.append(
            (
                int(
                    x
                ),
                int(
                    y
                ),
                int(
                    w
                ),
                int(
                    h
                ),
            )
        )

    # --------------------------------------------------------
    # Remove very thin residual rule-only bands.
    # --------------------------------------------------------

    if len(
        lines
    ) >= 3:

        candidate_heights = (
            np.asarray(
                [
                    box[3]
                    for box in boxes
                    if box[3] > 0
                ],
                dtype=float,
            )
        )

        if candidate_heights.size:

            median_line_height = float(
                np.median(
                    candidate_heights
                )
            )

            minimum_plausible_height = max(
                6.0,
                median_line_height
                * 0.60,
            )

            filtered_boxes = []

            filtered_lines = []

            for (
                box,
                crop,
            ) in zip(
                boxes,
                lines,
            ):

                if (
                    box[3]
                    < minimum_plausible_height
                ):
                    continue

                filtered_boxes.append(
                    box
                )

                filtered_lines.append(
                    crop
                )

            if filtered_lines:

                boxes = (
                    filtered_boxes
                )

                lines = (
                    filtered_lines
                )

    paired = sorted(
        zip(
            boxes,
            lines,
        ),
        key=lambda item: (
            item[0][1],
            item[0][0],
        ),
    )

    if not paired:
        return [], []

    return (
        [
            item[1]
            for item in paired
        ],
        [
            item[0]
            for item in paired
        ],
    )


# ============================================================
# WORD SEGMENTATION
# ============================================================

def _horizontal_ink_runs(
    line,
):
    column_has_ink = (
        np.count_nonzero(
            line == 255,
            axis=0,
        )
        > 0
    )

    return _true_runs(
        column_has_ink
    )


def _inter_run_gaps(
    runs,
):
    gaps = []

    for index in range(
        len(
            runs
        )
        - 1
    ):

        current_end = (
            runs[
                index
            ][1]
        )

        next_start = (
            runs[
                index + 1
            ][0]
        )

        gap = (
            next_start
            - current_end
            - 1
        )

        if gap > 0:

            gaps.append(
                float(
                    gap
                )
            )

    return gaps


def _estimate_word_gap_threshold(
    line,
    ink_runs,
):
    """
    Estimate word spacing dynamically.

    Replaces the old fixed:
        MORPH_RECT (7, 3)
    """

    line_height = float(
        line.shape[0]
    )

    median_component_width = (
        _robust_median_component_width(
            line
        )
    )

    gaps = np.asarray(
        _inter_run_gaps(
            ink_runs
        ),
        dtype=float,
    )

    structural_floor = max(
        3.0,
        line_height
        * 0.12,
        median_component_width
        * 0.50,
    )

    if gaps.size == 0:

        return float(
            structural_floor
        )

    median_gap = float(
        np.median(
            gaps
        )
    )

    mad = float(
        np.median(
            np.abs(
                gaps
                - median_gap
            )
        )
    )

    robust_threshold = (
        median_gap
        + max(
            2.5
            * mad,
            median_gap
            * 0.75,
            2.0,
        )
    )

    threshold = max(
        structural_floor,
        robust_threshold,
    )

    if gaps.size >= 4:

        upper_reference = float(
            np.percentile(
                gaps,
                75,
            )
        )

        threshold = min(
            threshold,
            max(
                structural_floor,
                upper_reference
                * 1.35,
            ),
        )

    return float(
        max(
            3.0,
            threshold,
        )
    )


def _word_x_ranges(
    analysis_line,
):
    ink_runs = _horizontal_ink_runs(
        analysis_line
    )

    if not ink_runs:
        return []

    if len(
        ink_runs
    ) == 1:

        return [
            ink_runs[0]
        ]

    threshold = (
        _estimate_word_gap_threshold(
            analysis_line,
            ink_runs,
        )
    )

    ranges = []

    (
        current_start,
        current_end,
    ) = ink_runs[0]

    for (
        next_start,
        next_end,
    ) in ink_runs[1:]:

        gap = (
            next_start
            - current_end
            - 1
        )

        if gap >= threshold:

            ranges.append(
                (
                    current_start,
                    current_end,
                )
            )

            current_start = (
                next_start
            )

            current_end = (
                next_end
            )

        else:

            current_end = max(
                current_end,
                next_end,
            )

    ranges.append(
        (
            current_start,
            current_end,
        )
    )

    return ranges


def _tight_word_box(
    canonical_line,
    analysis_line,
    x_start,
    x_end,
):
    line_h, line_w = (
        canonical_line.shape[:2]
    )

    x_start = max(
        0,
        int(
            x_start
        ),
    )

    x_end = min(
        line_w - 1,
        int(
            x_end
        ),
    )

    if x_end < x_start:
        return None

    analysis_candidate = (
        analysis_line[
            :,
            x_start:
            x_end + 1,
        ]
    )

    if (
        analysis_candidate.size == 0
        or np.count_nonzero(
            analysis_candidate
            == 255
        )
        < MIN_WORD_INK_PIXELS
    ):
        return None

    vertical_padding = max(
        1,
        int(
            round(
                line_h
                * WORD_VERTICAL_PADDING_RATIO
            )
        ),
    )

    horizontal_padding = max(
        1,
        int(
            round(
                line_h
                * WORD_HORIZONTAL_PADDING_RATIO
            )
        ),
    )

    tight = _content_box(
        analysis_candidate,
        padding_x=horizontal_padding,
        padding_y=vertical_padding,
    )

    if tight is None:
        return None

    (
        local_x,
        local_y,
        width,
        height,
    ) = tight

    return _clip_box(
        x_start
        + local_x,
        local_y,
        width,
        height,
        line_w,
        line_h,
    )


def _horizontal_gap_between_boxes(
    a,
    b,
):
    ax, _, aw, _ = a

    bx, _, bw, _ = b

    if ax <= bx:

        return max(
            0.0,
            float(
                bx
                - (
                    ax + aw
                )
            ),
        )

    return max(
        0.0,
        float(
            ax
            - (
                bx + bw
            )
        ),
    )


def _box_union(
    boxes,
):
    if not boxes:
        return None

    x1 = min(
        box[0]
        for box
        in boxes
    )

    y1 = min(
        box[1]
        for box
        in boxes
    )

    x2 = max(
        box[0]
        + box[2]
        for box
        in boxes
    )

    y2 = max(
        box[1]
        + box[3]
        for box
        in boxes
    )

    return (
        int(
            x1
        ),
        int(
            y1
        ),
        int(
            x2 - x1
        ),
        int(
            y2 - y1
        ),
    )


def _merge_tiny_word_boxes(
    boxes,
    line_height,
):
    """
    Prevent a detached modifier/noise speck from becoming
    its own standalone word.
    """

    if len(
        boxes
    ) <= 1:

        return boxes

    boxes = sorted(
        [
            tuple(
                map(
                    int,
                    box,
                )
            )
            for box
            in boxes
        ],
        key=lambda box:
            box[0],
    )

    min_width = max(
        2,
        int(
            round(
                line_height
                * MIN_WORD_WIDTH_RATIO_TO_LINE_HEIGHT
            )
        ),
    )

    min_height = max(
        2,
        int(
            round(
                line_height
                * MIN_WORD_HEIGHT_RATIO_TO_LINE_HEIGHT
            )
        ),
    )

    result = []

    index = 0

    while index < len(
        boxes
    ):

        current = (
            boxes[
                index
            ]
        )

        _, _, w, h = (
            current
        )

        tiny = (
            w < min_width
            or h < min_height
        )

        if not tiny:

            result.append(
                current
            )

            index += 1

            continue

        previous = (
            result[-1]
            if result
            else None
        )

        nxt = (
            boxes[
                index + 1
            ]
            if (
                index + 1
                < len(
                    boxes
                )
            )
            else None
        )

        previous_gap = (
            _horizontal_gap_between_boxes(
                previous,
                current,
            )
            if previous
            is not None
            else float(
                "inf"
            )
        )

        next_gap = (
            _horizontal_gap_between_boxes(
                current,
                nxt,
            )
            if nxt
            is not None
            else float(
                "inf"
            )
        )

        if (
            previous
            is not None
            and previous_gap
            <= next_gap
        ):

            result[-1] = (
                _box_union(
                    [
                        previous,
                        current,
                    ]
                )
            )

        elif nxt is not None:

            boxes[
                index + 1
            ] = _box_union(
                [
                    current,
                    nxt,
                ]
            )

        else:

            result.append(
                current
            )

        index += 1

    return sorted(
        result,
        key=lambda box:
            box[0],
    )


def segment_words(
    line_img,
):
    """
    Segment one line into structural word regions.

    Uses adaptive horizontal whitespace instead of the old
    fixed 7x3 dilation kernel.
    """

    canonical = ensure_ink_white(
        line_img
    )

    if (
        canonical is None
        or canonical.ndim != 2
    ):
        return [], []

    line_h, line_w = (
        canonical.shape[:2]
    )

    if (
        line_h < 2
        or line_w < 2
        or np.count_nonzero(
            canonical == 255
        )
        < MIN_WORD_INK_PIXELS
    ):
        return [], []

    analysis_line = (
        _suppress_horizontal_artifacts(
            canonical
        )
    )

    if analysis_line is None:
        return [], []

    x_ranges = _word_x_ranges(
        analysis_line
    )

    candidate_boxes = []

    for (
        x_start,
        x_end,
    ) in x_ranges:

        box = _tight_word_box(
            canonical,
            analysis_line,
            x_start,
            x_end,
        )

        if box is None:
            continue

        x, y, w, h = (
            box
        )

        candidate = (
            analysis_line[
                y:y + h,
                x:x + w,
            ]
        )

        if (
            candidate.size == 0
            or np.count_nonzero(
                candidate
                == 255
            )
            < MIN_WORD_INK_PIXELS
        ):
            continue

        candidate_boxes.append(
            (
                x,
                y,
                w,
                h,
            )
        )

    candidate_boxes = (
        _merge_tiny_word_boxes(
            candidate_boxes,
            line_height=line_h,
        )
    )

    words = []

    boxes = []

    for box in candidate_boxes:

        x, y, w, h = _clip_box(
            *box,
            line_w,
            line_h,
        )

        if (
            w <= 0
            or h <= 0
        ):
            continue

        evidence = (
            analysis_line[
                y:y + h,
                x:x + w,
            ]
        )

        if (
            evidence.size == 0
            or np.count_nonzero(
                evidence
                == 255
            )
            < MIN_WORD_INK_PIXELS
        ):
            continue

        # Crop from canonical handwriting image.
        word = canonical[
            y:y + h,
            x:x + w,
        ]

        if word.size == 0:
            continue

        words.append(
            word.copy()
        )

        boxes.append(
            (
                int(
                    x
                ),
                int(
                    y
                ),
                int(
                    w
                ),
                int(
                    h
                ),
            )
        )

    paired = sorted(
        zip(
            boxes,
            words,
        ),
        key=lambda item: (
            item[0][0],
            item[0][1],
        ),
    )

    if not paired:
        return [], []

    return (
        [
            item[1]
            for item
            in paired
        ],
        [
            item[0]
            for item
            in paired
        ],
    )


# ============================================================
# CHARACTER-REGION SEGMENTATION
# ============================================================

def _horizontal_overlap_ratio(
    a,
    b,
):
    ax, _, aw, _ = a

    bx, _, bw, _ = b

    overlap = max(
        0,
        min(
            ax + aw,
            bx + bw,
        )
        - max(
            ax,
            bx,
        ),
    )

    return float(
        overlap
        / max(
            1,
            min(
                aw,
                bw,
            ),
        )
    )


def _box_center(
    box,
):
    x, y, w, h = (
        box
    )

    return (
        float(
            x
            + w / 2.0
        ),
        float(
            y
            + h / 2.0
        ),
    )


def _merge_body_components(
    body_components,
    median_height,
    params,
):
    """
    Join disconnected structural pieces that are likely
    to belong to the same character region.
    """

    if not body_components:
        return []

    groups = [
        [
            component
        ]
        for component
        in sorted(
            body_components,
            key=lambda item: (
                item[
                    "x"
                ],
                item[
                    "y"
                ],
            ),
        )
    ]

    changed = True

    max_gap = max(
        1.0,
        float(
            median_height
        )
        * float(
            params[
                "body_merge_gap_height_ratio"
            ]
        ),
    )

    while (
        changed
        and len(
            groups
        )
        > 1
    ):

        changed = False

        merged = []

        index = 0

        while index < len(
            groups
        ):

            current = (
                groups[
                    index
                ]
            )

            if (
                index + 1
                >= len(
                    groups
                )
            ):

                merged.append(
                    current
                )

                break

            nxt = (
                groups[
                    index + 1
                ]
            )

            current_box = _box_union(
                [
                    (
                        item[
                            "x"
                        ],
                        item[
                            "y"
                        ],
                        item[
                            "w"
                        ],
                        item[
                            "h"
                        ],
                    )
                    for item
                    in current
                ]
            )

            next_box = _box_union(
                [
                    (
                        item[
                            "x"
                        ],
                        item[
                            "y"
                        ],
                        item[
                            "w"
                        ],
                        item[
                            "h"
                        ],
                    )
                    for item
                    in nxt
                ]
            )

            overlap = (
                _horizontal_overlap_ratio(
                    current_box,
                    next_box,
                )
            )

            gap = (
                _horizontal_gap_between_boxes(
                    current_box,
                    next_box,
                )
            )

            if (
                overlap >= 0.30
                or gap <= max_gap
            ):

                merged.append(
                    current
                    + nxt
                )

                index += 2

                changed = True

            else:

                merged.append(
                    current
                )

                index += 1

        groups = (
            merged
        )

    return groups


def _attach_modifiers(
    groups,
    modifiers,
    median_height,
    params,
):
    """
    Attach small detached dots/modifiers to a nearby
    structural character body.
    """

    if not groups:

        return [
            [
                modifier
            ]
            for modifier
            in modifiers
        ]

    max_x = max(
        2.0,
        float(
            median_height
        )
        * float(
            params[
                "modifier_attach_x_height_ratio"
            ]
        ),
    )

    max_y = max(
        2.0,
        float(
            median_height
        )
        * float(
            params[
                "modifier_attach_y_height_ratio"
            ]
        ),
    )

    for modifier in modifiers:

        modifier_box = (
            modifier[
                "x"
            ],
            modifier[
                "y"
            ],
            modifier[
                "w"
            ],
            modifier[
                "h"
            ],
        )

        mx, my = (
            _box_center(
                modifier_box
            )
        )

        best_index = None

        best_score = None

        for (
            group_index,
            group,
        ) in enumerate(
            groups
        ):

            group_box = (
                _box_union(
                    [
                        (
                            item[
                                "x"
                            ],
                            item[
                                "y"
                            ],
                            item[
                                "w"
                            ],
                            item[
                                "h"
                            ],
                        )
                        for item
                        in group
                    ]
                )
            )

            gx, gy = (
                _box_center(
                    group_box
                )
            )

            dx = abs(
                mx - gx
            )

            dy = abs(
                my - gy
            )

            gap = (
                _horizontal_gap_between_boxes(
                    modifier_box,
                    group_box,
                )
            )

            overlap = (
                _horizontal_overlap_ratio(
                    modifier_box,
                    group_box,
                )
            )

            plausible = (
                overlap > 0.0
                or (
                    dx <= max_x
                    and dy <= max_y
                )
                or gap
                <= max_x
                * 0.50
            )

            if not plausible:
                continue

            score = (
                dx
                + 0.40
                * dy
                + 0.60
                * gap
                - overlap
                * float(
                    median_height
                )
            )

            if (
                best_score
                is None
                or score
                < best_score
            ):

                best_score = (
                    score
                )

                best_index = (
                    group_index
                )

        if best_index is None:

            groups.append(
                [
                    modifier
                ]
            )

        else:

            groups[
                best_index
            ].append(
                modifier
            )

    return groups


def segment_character_regions(
    word_img,
    language="sinhala",
):
    """
    Segment a word into structural character-like regions.

    IMPORTANT:
        These are structural regions used for handwriting
        quality analysis.

        They are NOT OCR-recognized characters.
    """

    word = ensure_ink_white(
        word_img
    )

    if (
        word is None
        or word.ndim != 2
    ):
        return [], []

    word_h, word_w = (
        word.shape[:2]
    )

    if (
        word_h < 2
        or word_w < 2
        or np.count_nonzero(
            word == 255
        )
        < MIN_CHARACTER_INK_PIXELS
    ):
        return [], []

    language = str(
        language
        or "sinhala"
    ).strip().lower()

    params = (
        CHARACTER_PARAMS.get(
            language,
            CHARACTER_PARAMS[
                "sinhala"
            ],
        )
    )

    analysis_word = (
        _suppress_horizontal_artifacts(
            word
        )
    )

    if analysis_word is None:
        return [], []

    components = (
        _component_stats(
            analysis_word
        )
    )

    if not components:
        return [], []

    heights = np.asarray(
        [
            max(
                1,
                item[
                    "h"
                ],
            )
            for item
            in components
        ],
        dtype=float,
    )

    areas = np.asarray(
        [
            max(
                1,
                item[
                    "area"
                ],
            )
            for item
            in components
        ],
        dtype=float,
    )

    median_height = max(
        2.0,
        float(
            np.median(
                heights
            )
        ),
    )

    median_area = max(
        2.0,
        float(
            np.median(
                areas
            )
        ),
    )

    body_components = []

    modifiers = []

    for item in components:

        is_body = (
            item[
                "h"
            ]
            >= median_height
            * float(
                params[
                    "body_height_ratio"
                ]
            )
            and
            item[
                "area"
            ]
            >= median_area
            * float(
                params[
                    "body_area_ratio"
                ]
            )
        )

        if is_body:

            body_components.append(
                item
            )

        else:

            modifiers.append(
                item
            )

    if not body_components:

        largest = max(
            components,
            key=lambda item:
                item[
                    "area"
                ],
        )

        body_components = [
            largest
        ]

        modifiers = [
            item
            for item
            in components
            if item
            is not largest
        ]

    groups = (
        _merge_body_components(
            body_components,
            median_height,
            params,
        )
    )

    groups = (
        _attach_modifiers(
            groups,
            modifiers,
            median_height,
            params,
        )
    )

    padding = max(
        1,
        int(
            round(
                median_height
                * float(
                    params[
                        "region_padding_ratio"
                    ]
                )
            )
        ),
    )

    results = []

    for group in groups:

        raw_box = _box_union(
            [
                (
                    item[
                        "x"
                    ],
                    item[
                        "y"
                    ],
                    item[
                        "w"
                    ],
                    item[
                        "h"
                    ],
                )
                for item
                in group
            ]
        )

        if raw_box is None:
            continue

        x, y, w, h = (
            raw_box
        )

        x, y, w, h = (
            _clip_box(
                x - padding,
                y - padding,
                w
                + 2
                * padding,
                h
                + 2
                * padding,
                word_w,
                word_h,
            )
        )

        if (
            w <= 0
            or h <= 0
        ):
            continue

        evidence = (
            analysis_word[
                y:y + h,
                x:x + w,
            ]
        )

        if (
            evidence.size == 0
            or np.count_nonzero(
                evidence
                == 255
            )
            < MIN_CHARACTER_INK_PIXELS
        ):
            continue

        crop = word[
            y:y + h,
            x:x + w,
        ]

        results.append(
            (
                (
                    int(
                        x
                    ),
                    int(
                        y
                    ),
                    int(
                        w
                    ),
                    int(
                        h
                    ),
                ),
                crop.copy(),
            )
        )

    # Remove duplicate boxes.
    deduplicated = {}

    for (
        box,
        crop,
    ) in results:

        deduplicated[
            box
        ] = crop

    ordered = sorted(
        deduplicated.items(),
        key=lambda item: (
            item[0][0],
            item[0][1],
        ),
    )

    return (
        [
            crop
            for _,
            crop
            in ordered
        ],
        [
            box
            for box,
            _
            in ordered
        ],
    )


# ============================================================
# COORDINATE HELPERS
# ============================================================

def local_box_to_global(
    local_box,
    parent_box,
):
    """
    Convert local child coordinates to page/global coordinates.
    """

    lx, ly, lw, lh = (
        local_box
    )

    px, py, _, _ = (
        parent_box
    )

    return (
        int(
            px + lx
        ),
        int(
            py + ly
        ),
        int(
            lw
        ),
        int(
            lh
        ),
    )


def local_boxes_to_global(
    local_boxes,
    parent_box,
):
    return [
        local_box_to_global(
            box,
            parent_box,
        )
        for box
        in (
            local_boxes
            or []
        )
    ]


# ============================================================
# VALIDATION / DEBUG HELPERS
# ============================================================

def validate_boxes(
    image,
    boxes,
):
    canonical = ensure_ink_white(
        image
    )

    if (
        canonical is None
        or boxes is None
    ):
        return False

    image_h, image_w = (
        canonical.shape[:2]
    )

    for box in boxes:

        if (
            not isinstance(
                box,
                (
                    tuple,
                    list,
                ),
            )
            or len(
                box
            )
            != 4
        ):
            return False

        try:

            x, y, w, h = [
                int(
                    value
                )
                for value
                in box
            ]

        except Exception:

            return False

        if (
            x < 0
            or y < 0
            or w <= 0
            or h <= 0
            or x + w
            > image_w
            or y + h
            > image_h
        ):

            return False

    return True


def segmentation_summary(
    binary_img,
    language="sinhala",
):
    """
    Lightweight diagnostic summary.

    This helps reveal obvious cases such as:

        3 lines / 5 words
    or
        15 lines / 370 words

    before trusting the ML result.
    """

    lines, line_boxes = (
        segment_lines(
            binary_img
        )
    )

    total_words = 0

    total_regions = 0

    words_per_line = []

    regions_per_word = []

    for line in lines:

        words, _ = (
            segment_words(
                line
            )
        )

        words_per_line.append(
            int(
                len(
                    words
                )
            )
        )

        total_words += len(
            words
        )

        for word in words:

            regions, _ = (
                segment_character_regions(
                    word,
                    language=language,
                )
            )

            regions_per_word.append(
                int(
                    len(
                        regions
                    )
                )
            )

            total_regions += len(
                regions
            )

    return {
        "line_count":
            int(
                len(
                    lines
                )
            ),

        "word_count":
            int(
                total_words
            ),

        "character_region_count":
            int(
                total_regions
            ),

        "words_per_line":
            words_per_line,

        "regions_per_word":
            regions_per_word,

        "line_boxes_valid":
            bool(
                validate_boxes(
                    binary_img,
                    line_boxes,
                )
            ),
    }