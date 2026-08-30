"""Shared image helpers.

Canonical binary convention used by the whole backend:
    handwriting / foreground = 255 (white)
    background               =   0 (black)
"""

import cv2
import numpy as np


def ensure_gray(image):
    if image is None or not isinstance(image, np.ndarray) or image.size == 0:
        return None
    try:
        if image.ndim == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        elif image.ndim == 2:
            gray = image.copy()
        else:
            return None
        if gray.dtype != np.uint8:
            gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        return gray
    except Exception:
        return None


def ensure_ink_white(image):
    """Return uint8 binary image with ink=255 and background=0."""
    gray = ensure_gray(image)
    if gray is None:
        return None
    try:
        unique = np.unique(gray)
        if len(unique) <= 4:
            binary = np.where(gray > 127, 255, 0).astype(np.uint8)
        else:
            _, binary = cv2.threshold(
                gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
            )

        white_ratio = np.count_nonzero(binary == 255) / binary.size
        # In ordinary paper photos the majority is the page background.
        # If white dominates, white is probably the paper, therefore invert.
        if white_ratio > 0.50:
            binary = 255 - binary
        return binary.astype(np.uint8)
    except Exception:
        return None


def is_canonical_binary(image):
    binary = ensure_ink_white(image)
    if binary is None:
        return False
    values = set(np.unique(binary).tolist())
    return values.issubset({0, 255})
