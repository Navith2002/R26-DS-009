import os
import sys

import numpy as np

ROOT = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from image_utils import ensure_ink_white


def test_white_paper_black_ink_becomes_white_ink():
    image = np.full(
        (100, 120),
        255,
        dtype=np.uint8,
    )
    image[40:60, 20:100] = 0

    binary = ensure_ink_white(image)

    assert binary is not None
    assert set(
        np.unique(binary).tolist()
    ).issubset({0, 255})
    assert binary[50, 50] == 255
    assert binary[5, 5] == 0


def test_canonical_binary_remains_canonical():
    image = np.zeros(
        (80, 100),
        dtype=np.uint8,
    )
    image[30:45, 20:80] = 255

    binary = ensure_ink_white(image)

    assert binary[35, 40] == 255
    assert binary[5, 5] == 0
