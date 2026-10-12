"""
preprocessing.py
================

Production preprocessing for Sinhala and Tamil handwriting-quality analysis.

Pipeline
--------
    original image
        ↓
    correct_skew()
        ↓
    remove_shadow()
        ↓
    binarize()
        ↓
    remove_ruled_lines()
        ↓
    canonical binary

Canonical binary convention
---------------------------
    handwriting / foreground / ink = 255 (WHITE)
    background                     =   0 (BLACK)

IMPORTANT
---------
The trained ML model still receives the same configured 10 Tamil / 15 Sinhala
feature names. These preprocessing corrections improve the reliability of the
regions from which those features are calculated.

Ruled-line removal is intentionally conservative:
- removes long notebook ruling,
- supports slightly broken/tilted lines,
- protects likely handwriting crossings,
- can use the original/reference colour image when available,
- returns a rule mask and diagnostics for debugging.
"""

from __future__ import annotations

import cv2
import numpy as np

from image_utils import (
    ensure_gray,
    ensure_ink_white,
)


# ============================================================
# CONFIGURATION
# ============================================================

# Adaptive-threshold settings
ADAPTIVE_BLOCK_SIZE = 31
ADAPTIVE_C = 15

# Very small foreground noise removal
BINARIZE_OPEN_KERNEL = (2, 2)

# Maximum page skew we are willing to automatically correct
MAX_AUTO_SKEW_DEGREES = 25.0


# ------------------------------------------------------------
# Ruled-line detection
# ------------------------------------------------------------

# Multiple widths are deliberately used because notebook ruling
# may be broken by handwriting or slightly curved after capture.
RULE_KERNEL_WIDTH_RATIOS = (
    0.045,
    0.070,
    0.100,
    0.140,
)

# Candidate component must be reasonably long relative to page.
MIN_RULE_WIDTH_RATIO = 0.10

# Long/thin structure requirement.
MIN_RULE_ASPECT_RATIO = 8.0

# Reject extremely tall components from the rule mask.
MAX_RULE_HEIGHT_RATIO = 0.035

# Minimum absolute horizontal rule width.
MIN_RULE_WIDTH_PIXELS = 25

# Small closing joins tiny interruptions in notebook lines.
RULE_BRIDGE_WIDTH_RATIO = 0.012

# Protect coloured handwriting when the source image makes
# colour distinction possible.
COLOUR_INK_SATURATION_MIN = 32

# Protect local vertical handwriting structures where notebook
# lines cross letters.
VERTICAL_PROTECTION_HEIGHT_RATIO = 0.012

# Expand protected handwriting slightly around crossings.
PROTECTION_DILATION_SIZE = 3


# ============================================================
# BASIC HELPERS
# ============================================================

def _valid_image(image):
    return (
        image is not None
        and isinstance(image, np.ndarray)
        and image.size > 0
        and image.ndim in (2, 3)
    )


def _odd(value):
    """
    Return a positive odd integer.
    """

    value = max(
        3,
        int(value),
    )

    if value % 2 == 0:
        value += 1

    return value


# ============================================================
# SKEW CORRECTION
# ============================================================

def correct_skew(image):
    """
    Correct moderate page/text skew.

    Large or suspicious rotations are intentionally ignored.
    """

    if not _valid_image(image):
        return image

    try:
        gray = ensure_gray(
            image
        )

        if gray is None:
            return image.copy()

        _, threshold = cv2.threshold(
            gray,
            0,
            255,
            cv2.THRESH_BINARY_INV
            + cv2.THRESH_OTSU,
        )

        coordinates = cv2.findNonZero(
            threshold
        )

        if (
            coordinates is None
            or len(coordinates) < 10
        ):
            return image.copy()

        rectangle = cv2.minAreaRect(
            coordinates
        )

        angle = float(
            rectangle[-1]
        )

        # OpenCV's rotated-rectangle angle convention
        # differs depending on orientation.
        if angle < -45.0:
            angle = 90.0 + angle

        elif angle > 45.0:
            angle = angle - 90.0

        # We rotate in the opposite direction.
        angle = -angle

        if (
            not np.isfinite(angle)
            or abs(angle)
            > MAX_AUTO_SKEW_DEGREES
        ):
            return image.copy()

        # Extremely small corrections add interpolation but
        # provide little value.
        if abs(angle) < 0.15:
            return image.copy()

        height, width = (
            image.shape[:2]
        )

        center = (
            width // 2,
            height // 2,
        )

        matrix = cv2.getRotationMatrix2D(
            center,
            angle,
            1.0,
        )

        corrected = cv2.warpAffine(
            image,
            matrix,
            (
                width,
                height,
            ),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )

        return corrected

    except Exception:
        return image.copy()


# ============================================================
# ILLUMINATION / SHADOW NORMALIZATION
# ============================================================

def _normalize_plane(
    plane,
):
    """
    Normalize one grayscale/channel plane using the
    historical shadow-removal approach.
    """

    dilated = cv2.dilate(
        plane,
        np.ones(
            (7, 7),
            np.uint8,
        ),
    )

    blurred = cv2.medianBlur(
        dilated,
        21,
    )

    difference = (
        255
        - cv2.absdiff(
            plane,
            blurred,
        )
    )

    normalized = cv2.normalize(
        difference,
        None,
        0,
        255,
        cv2.NORM_MINMAX,
    )

    return normalized.astype(
        np.uint8
    )


def remove_shadow(image):
    """
    Reduce uneven page lighting and shadows.

    Handles both grayscale and colour images.
    """

    if not _valid_image(image):
        return image

    try:
        if image.ndim == 2:
            return _normalize_plane(
                image
            )

        channels = cv2.split(
            image
        )

        normalized_channels = [
            _normalize_plane(
                channel
            )
            for channel
            in channels
        ]

        return cv2.merge(
            normalized_channels
        )

    except Exception:
        return image.copy()


# ============================================================
# BINARIZATION
# ============================================================

def binarize(image):
    """
    Convert the handwriting image to the canonical binary format:

        handwriting = 255
        background  = 0
    """

    if not _valid_image(image):
        return None

    try:
        gray = ensure_gray(
            image
        )

        if gray is None:
            return None

        gray = cv2.GaussianBlur(
            gray,
            (5, 5),
            0,
        )

        block_size = _odd(
            ADAPTIVE_BLOCK_SIZE
        )

        binary = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            block_size,
            ADAPTIVE_C,
        )

        # Remove isolated tiny noise.
        kernel = np.ones(
            BINARIZE_OPEN_KERNEL,
            dtype=np.uint8,
        )

        binary = cv2.morphologyEx(
            binary,
            cv2.MORPH_OPEN,
            kernel,
            iterations=1,
        )

        # Final mandatory polarity guarantee.
        binary = ensure_ink_white(
            binary
        )

        if binary is None:
            return None

        return binary.astype(
            np.uint8
        )

    except Exception:
        return None


# ============================================================
# RULED-LINE HELPERS
# ============================================================

def _build_horizontal_rule_candidates(
    binary,
):
    """
    Detect long horizontal structures using several
    page-relative morphology kernels.

    The output is only a CANDIDATE mask.
    """

    height, width = (
        binary.shape[:2]
    )

    candidate_mask = np.zeros_like(
        binary
    )

    # --------------------------------------------------------
    # Join small gaps in notebook lines first.
    # --------------------------------------------------------

    bridge_width = max(
        3,
        int(
            round(
                width
                * RULE_BRIDGE_WIDTH_RATIO
            )
        ),
    )

    bridge_kernel = (
        cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (
                bridge_width,
                1,
            ),
        )
    )

    bridged = cv2.morphologyEx(
        binary,
        cv2.MORPH_CLOSE,
        bridge_kernel,
        iterations=1,
    )

    # --------------------------------------------------------
    # Detect lines at several scales.
    # --------------------------------------------------------

    for ratio in RULE_KERNEL_WIDTH_RATIOS:

        kernel_width = max(
            MIN_RULE_WIDTH_PIXELS,
            int(
                round(
                    width
                    * ratio
                )
            ),
        )

        kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (
                kernel_width,
                1,
            ),
        )

        detected = cv2.morphologyEx(
            bridged,
            cv2.MORPH_OPEN,
            kernel,
            iterations=1,
        )

        candidate_mask = cv2.bitwise_or(
            candidate_mask,
            detected,
        )

    return candidate_mask


def _filter_rule_components(
    candidate_mask,
):
    """
    Keep only components that look like notebook ruling.

    This prevents ordinary letter strokes from being removed
    simply because they contain a horizontal section.
    """

    height, width = (
        candidate_mask.shape[:2]
    )

    filtered = np.zeros_like(
        candidate_mask
    )

    try:
        count, labels, stats, _ = (
            cv2.connectedComponentsWithStats(
                candidate_mask,
                connectivity=8,
            )
        )

    except Exception:
        return candidate_mask.copy()

    minimum_width = max(
        MIN_RULE_WIDTH_PIXELS,
        int(
            round(
                width
                * MIN_RULE_WIDTH_RATIO
            )
        ),
    )

    maximum_height = max(
        3,
        int(
            round(
                height
                * MAX_RULE_HEIGHT_RATIO
            )
        ),
    )

    accepted_components = 0

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

        component_width = int(
            stats[
                label_id,
                cv2.CC_STAT_WIDTH,
            ]
        )

        component_height = int(
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
            component_width <= 0
            or component_height <= 0
            or area <= 0
        ):
            continue

        aspect_ratio = (
            float(component_width)
            / max(
                1.0,
                float(component_height),
            )
        )

        if component_width < minimum_width:
            continue

        if component_height > maximum_height:
            continue

        if aspect_ratio < MIN_RULE_ASPECT_RATIO:
            continue

        component_pixels = (
            labels[
                y:
                y + component_height,
                x:
                x + component_width,
            ]
            == label_id
        )

        region = filtered[
            y:
            y + component_height,
            x:
            x + component_width,
        ]

        region[
            component_pixels
        ] = 255

        accepted_components += 1

    return filtered


def _build_colour_handwriting_protection(
    reference_image,
    binary_shape,
):
    """
    Protect strongly coloured handwriting.

    This is especially useful for notebook pages where:
        handwriting = blue ink
        ruling       = grey / faint blue-grey

    If no colour image is supplied, an empty protection
    mask is returned.
    """

    height, width = (
        binary_shape
    )

    protection = np.zeros(
        (
            height,
            width,
        ),
        dtype=np.uint8,
    )

    if (
        reference_image is None
        or not isinstance(
            reference_image,
            np.ndarray,
        )
        or reference_image.size == 0
        or reference_image.ndim != 3
    ):
        return protection

    try:
        reference = reference_image

        if (
            reference.shape[0]
            != height
            or reference.shape[1]
            != width
        ):
            reference = cv2.resize(
                reference,
                (
                    width,
                    height,
                ),
                interpolation=cv2.INTER_AREA,
            )

        hsv = cv2.cvtColor(
            reference,
            cv2.COLOR_BGR2HSV,
        )

        saturation = hsv[
            :,
            :,
            1,
        ]

        value = hsv[
            :,
            :,
            2,
        ]

        # Coloured ink generally retains more saturation than
        # grey notebook ruling.
        coloured_ink = (
            (
                saturation
                >= COLOUR_INK_SATURATION_MIN
            )
            & (
                value < 245
            )
        )

        protection[
            coloured_ink
        ] = 255

        # Connect close handwriting pixels slightly.
        protection = cv2.dilate(
            protection,
            cv2.getStructuringElement(
                cv2.MORPH_ELLIPSE,
                (3, 3),
            ),
            iterations=1,
        )

        return protection

    except Exception:
        return np.zeros(
            (
                height,
                width,
            ),
            dtype=np.uint8,
        )


def _build_structural_handwriting_protection(
    binary,
):
    """
    Protect local vertical stroke evidence where notebook
    ruling crosses handwriting.

    Without this protection, subtracting a long horizontal
    rule can cut through character strokes.
    """

    height, _ = (
        binary.shape[:2]
    )

    vertical_length = max(
        3,
        int(
            round(
                height
                * VERTICAL_PROTECTION_HEIGHT_RATIO
            )
        ),
    )

    vertical_kernel = (
        cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (
                1,
                vertical_length,
            ),
        )
    )

    vertical_structure = (
        cv2.morphologyEx(
            binary,
            cv2.MORPH_OPEN,
            vertical_kernel,
            iterations=1,
        )
    )

    dilation_size = max(
        1,
        int(
            PROTECTION_DILATION_SIZE
        ),
    )

    protection_kernel = (
        cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (
                dilation_size,
                dilation_size,
            ),
        )
    )

    protected = cv2.dilate(
        vertical_structure,
        protection_kernel,
        iterations=1,
    )

    return protected


def _clean_rule_mask(
    rule_mask,
):
    """
    Make the final removal mask thin and conservative.
    """

    if (
        rule_mask is None
        or rule_mask.size == 0
    ):
        return rule_mask

    # Fill tiny interruptions but avoid thickening notebook
    # ruling excessively.
    closing_kernel = (
        cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (5, 1),
        )
    )

    cleaned = cv2.morphologyEx(
        rule_mask,
        cv2.MORPH_CLOSE,
        closing_kernel,
        iterations=1,
    )

    return cleaned


# ============================================================
# RULED-LINE REMOVAL
# ============================================================

def remove_ruled_lines(
    binary,
    reference_image=None,
    return_mask=False,
):
    """
    Remove long horizontal notebook ruling conservatively.

    Parameters
    ----------
    binary:
        Canonical or near-canonical binary handwriting mask.

    reference_image:
        Optional colour/grayscale preprocessed image.

        When colour information is available it helps distinguish
        coloured handwriting from grey notebook ruling.

    return_mask:
        False:
            returns cleaned_binary

        True:
            returns:
                cleaned_binary,
                final_rule_mask,
                diagnostics

    Returns
    -------
    cleaned binary:
        handwriting = 255
        background  = 0

    Notes
    -----
    This function focuses on HORIZONTAL notebook ruling.

    The older implementation also aggressively removed vertical
    structures using a fixed (1, 80) kernel. That can accidentally
    remove legitimate handwriting strokes and is therefore not
    performed here.

    A left page-margin rule should normally be handled separately
    as a page/layout artifact rather than using broad vertical
    stroke deletion.
    """

    canonical = ensure_ink_white(
        binary
    )

    if canonical is None:
        if return_mask:
            return (
                None,
                None,
                {
                    "success": False,
                    "error":
                        "Invalid binary image.",
                },
            )

        return None

    if canonical.ndim != 2:
        if return_mask:
            return (
                canonical,
                np.zeros_like(
                    canonical
                ),
                {
                    "success": False,
                    "error":
                        "Expected a 2-D binary image.",
                },
            )

        return canonical

    try:
        height, width = (
            canonical.shape[:2]
        )

        original_ink_pixels = int(
            np.count_nonzero(
                canonical == 255
            )
        )

        # ====================================================
        # STEP 1
        # Detect candidate horizontal structures.
        # ====================================================

        raw_candidates = (
            _build_horizontal_rule_candidates(
                canonical
            )
        )

        # ====================================================
        # STEP 2
        # Keep only long/thin components.
        # ====================================================

        filtered_rules = (
            _filter_rule_components(
                raw_candidates
            )
        )

        # ====================================================
        # STEP 3
        # Protect handwriting.
        # ====================================================

        structural_protection = (
            _build_structural_handwriting_protection(
                canonical
            )
        )

        colour_protection = (
            _build_colour_handwriting_protection(
                reference_image,
                canonical.shape,
            )
        )

        handwriting_protection = (
            cv2.bitwise_or(
                structural_protection,
                colour_protection,
            )
        )

        # ====================================================
        # STEP 4
        # Remove protected handwriting pixels from the line
        # removal mask.
        # ====================================================

        inverse_protection = (
            cv2.bitwise_not(
                handwriting_protection
            )
        )

        removable_rules = (
            cv2.bitwise_and(
                filtered_rules,
                inverse_protection,
            )
        )

        removable_rules = (
            _clean_rule_mask(
                removable_rules
            )
        )

        # ====================================================
        # STEP 5
        # Remove only identified notebook-line pixels.
        # ====================================================

        cleaned = cv2.bitwise_and(
            canonical,
            cv2.bitwise_not(
                removable_rules
            ),
        )

        cleaned = ensure_ink_white(
            cleaned
        )

        if cleaned is None:
            cleaned = canonical.copy()

        # ====================================================
        # DIAGNOSTICS
        # ====================================================

        raw_candidate_pixels = int(
            np.count_nonzero(
                raw_candidates == 255
            )
        )

        filtered_rule_pixels = int(
            np.count_nonzero(
                filtered_rules == 255
            )
        )

        protection_pixels = int(
            np.count_nonzero(
                handwriting_protection
                == 255
            )
        )

        removed_pixels = int(
            np.count_nonzero(
                removable_rules == 255
            )
        )

        cleaned_ink_pixels = int(
            np.count_nonzero(
                cleaned == 255
            )
        )

        removed_fraction_of_ink = (
            float(
                removed_pixels
            )
            / max(
                1,
                original_ink_pixels,
            )
        )

        diagnostics = {
            "success":
                True,

            "image_width":
                int(
                    width
                ),

            "image_height":
                int(
                    height
                ),

            "original_ink_pixels":
                int(
                    original_ink_pixels
                ),

            "raw_rule_candidate_pixels":
                int(
                    raw_candidate_pixels
                ),

            "filtered_rule_pixels":
                int(
                    filtered_rule_pixels
                ),

            "protected_handwriting_pixels":
                int(
                    protection_pixels
                ),

            "removed_rule_pixels":
                int(
                    removed_pixels
                ),

            "cleaned_ink_pixels":
                int(
                    cleaned_ink_pixels
                ),

            "removed_fraction_of_original_ink":
                round(
                    removed_fraction_of_ink,
                    6,
                ),

            "colour_reference_used":
                bool(
                    reference_image is not None
                    and isinstance(
                        reference_image,
                        np.ndarray,
                    )
                    and reference_image.ndim == 3
                ),

            "canonical_convention":
                {
                    "foreground":
                        255,

                    "background":
                        0,
                },
        }

        if return_mask:
            return (
                cleaned,
                removable_rules,
                diagnostics,
            )

        return cleaned

    except Exception as error:

        fallback = canonical.copy()

        diagnostics = {
            "success":
                False,

            "error":
                str(
                    error
                ),

            "canonical_convention":
                {
                    "foreground":
                        255,

                    "background":
                        0,
                },
        }

        if return_mask:
            return (
                fallback,
                np.zeros_like(
                    canonical
                ),
                diagnostics,
            )

        return fallback