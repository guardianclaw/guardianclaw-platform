"""
GuardianClaw CLAW Plugin for Garak (NVIDIA)

This package provides probes and detectors for testing LLM resistance
to attacks on the CLAW (Credibility, Limits, Avoidance, Worth) protocol.

Garak is NVIDIA's LLM vulnerability scanner. This plugin extends it
with probes and detectors based on the GuardianClaw CLAW protocol.

Installation Options:

    Option 1 - Copy to Garak directory:
        python -m guardianclaw.integrations.garak.install

    Option 2 - Manual copy:
        # Find garak installation
        python -c "import garak; print(garak.__path__[0])"

        # Copy probes
        cp probes.py /path/to/garak/probes/claw_claw.py

        # Copy detectors
        cp detectors.py /path/to/garak/detectors/claw_claw.py

Usage after installation:

    # Test all CLAW gates
    garak --model_type openai --model_name gpt-4o --probes claw_claw

    # Test specific gate
    garak --model_type openai --model_name gpt-4o --probes claw_claw.TruthGate

    # Use with GuardianClaw detectors
    garak --model_type openai --model_name gpt-4o \\
        --probes claw_claw \\
        --detectors claw_claw

Documentation: https://github.com/guardian-claw/guardianclaw/tree/main/src/guardianclaw/integrations/garak
GitHub: https://github.com/NVIDIA/garak

References:
    - Garak Documentation: https://docs.garak.ai
    - CLAW Protocol: https://github.com/guardian-claw/guardianclaw#claw-protocol
"""

__version__ = "2.26.0"
__author__ = "GuardianClaw Team"

# Minimum required Garak version
MIN_GARAK_VERSION = "0.9.0"

# Re-export probe and detector classes for convenience
from guardianclaw.integrations.garak.probes import (
    TruthGate,
    HarmGate,
    ScopeGate,
    PurposeGate,
    CLAWCombined,
)

from guardianclaw.integrations.garak.detectors import (
    TruthViolation,
    HarmViolation,
    ScopeViolation,
    PurposeViolation,
    CLAWCombinedDetector,
    DetectionMetrics,
    AmbiguousScoreConfig,
)

__all__ = [
    # Constants
    "__version__",
    "__author__",
    "MIN_GARAK_VERSION",
    # Probes
    "TruthGate",
    "HarmGate",
    "ScopeGate",
    "PurposeGate",
    "CLAWCombined",
    # Detectors
    "TruthViolation",
    "HarmViolation",
    "ScopeViolation",
    "PurposeViolation",
    "CLAWCombinedDetector",
    # Configuration Classes
    "DetectionMetrics",
    "AmbiguousScoreConfig",
]
