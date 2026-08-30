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

from segmentation_quality import evaluate_segmentation_reliability


def _word_record():
    return {
        "word": np.zeros((30, 60), dtype=np.uint8),
        "local_box": (0, 0, 60, 30),
        "character_boxes": [(0, 0, 10, 20)] * 5,
    }


def test_audit_scale_oversegmentation_is_rejected():
    # Mirrors the audited failure pattern: 15 lines, 370 words,
    # 1,725 character regions.
    segmentation = {
        "lines": [np.zeros((50, 100), dtype=np.uint8)] * 15,
        "all_words": [None] * 370,
        "character_region_count": 1725,
        "line_records": [],
    }

    result = evaluate_segmentation_reliability(
        segmentation
    )

    assert result["reliable_for_stage2"] is False
    assert result["status"] == "Segmentation Unreliable"


def test_reasonable_small_page_can_pass_sanity_gate():
    line_records = []
    all_words = []

    for _ in range(6):
        word_records = [_word_record() for _ in range(7)]
        line_records.append(
            {
                "line": np.zeros((60, 500), dtype=np.uint8),
                "local_word_boxes": [
                    (i * 65, 10, 50, 35)
                    for i in range(7)
                ],
                "word_records": word_records,
            }
        )
        all_words.extend([None] * 7)

    segmentation = {
        "lines": [np.zeros((60, 500), dtype=np.uint8)] * 6,
        "all_words": all_words,
        "character_region_count": 6 * 7 * 5,
        "line_records": line_records,
    }

    result = evaluate_segmentation_reliability(
        segmentation
    )

    assert result["reliable_for_stage2"] is True


def test_clear_undersegmentation_is_rejected():
    # Synthetic version of the ruled-notebook failure pattern: one giant line
    # box contains most of a paragraph and many text-like components collapse
    # into only a few words.
    page = np.zeros((400, 700), dtype=np.uint8)

    # Create many separated text-like components across eight rows.
    for row in range(8):
        y = 35 + row * 42
        for col in range(18):
            x = 20 + col * 35
            page[y:y + 12, x:x + 15] = 255

    segmentation = {
        "page_binary": page,
        "lines": [
            page[0:45, :],
            page[45:360, :],
            page[360:400, :],
        ],
        "line_boxes": [
            (0, 0, 700, 45),
            (0, 45, 700, 315),
            (0, 360, 700, 40),
        ],
        "all_words": [None] * 5,
        "character_region_count": 21,
        "line_records": [],
    }

    result = evaluate_segmentation_reliability(segmentation)

    assert result["reliable_for_stage2"] is False
    assert result["status"] == "Segmentation Unreliable"
    assert any(
        "merged" in reason.lower()
        or "too few word" in reason.lower()
        or "only a few words" in reason.lower()
        for reason in result["reasons"]
    )
