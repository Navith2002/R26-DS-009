import os
import sys

ROOT = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from feature_extraction import (
    TAMIL_QUALITY_FEATURES,
    SINHALA_QUALITY_FEATURES,
)


def test_tamil_feature_count():
    assert len(TAMIL_QUALITY_FEATURES) == 10


def test_sinhala_feature_count_and_order():
    assert len(SINHALA_QUALITY_FEATURES) == 15
    assert SINHALA_QUALITY_FEATURES[:10] == TAMIL_QUALITY_FEATURES
    assert SINHALA_QUALITY_FEATURES[-5:] == [
        "character_shape_consistency",
        "character_proportion_variation",
        "upper_lower_balance",
        "character_spacing_variation",
        "word_spacing_variation",
    ]
