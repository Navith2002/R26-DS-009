"""
scoring.py
==========

Compatibility placeholder.

The audited production architecture intentionally does NOT generate an
independent 0-100 handwriting-quality score. The final quality decision comes
from the calibrated language-specific ML class probabilities.

Do not map labels to artificial values such as 20/40/60/80/100 and present
those values as measured handwriting quality.
"""


def scoring_is_enabled():
    return False
