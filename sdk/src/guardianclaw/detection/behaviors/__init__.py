"""
Behavior Detection Module - GuardianClaw v3.0

Detects harmful AI behaviors without relying on external LLMs.

This module provides behavior-level analysis that goes beyond
pattern matching to detect contextual behavioral issues like:
- Self-preservation behaviors
- Deception and manipulation
- Goal misalignment
- Boundary violations
- User avoidance patterns

Architecture:
    BehaviorAnalyzer
    ├── SelfPreservationDetector
    ├── DeceptionDetector
    ├── GoalMisalignmentDetector
    ├── BoundaryViolationDetector
    ├── AdversarialBehaviorDetector
    ├── UserHarmDetector
    ├── SocialEngineeringDetector
    ├── OutputIntegrityDetector
    ├── InstrumentalConvergenceDetector
    └── SystemicRiskDetector

Each detector uses a combination of:
- Pattern matching (fast, deterministic)
- Embedding similarity (semantic understanding)
- Structural analysis (response patterns)
- Behavioral heuristics (domain-specific rules)

Usage:
    from guardianclaw.detection.behaviors import BehaviorAnalyzer

    analyzer = BehaviorAnalyzer()
    result = analyzer.analyze(
        input_text="User message",
        output_text="AI response",
        context={"role": "assistant", "task": "help with coding"}
    )

    if result.has_harmful_behavior:
        print(f"Detected: {result.behaviors}")
        print(f"Confidence: {result.confidence}")
"""

from guardianclaw.detection.behaviors.analyzer import (
    BehaviorAnalyzer,
    BehaviorAnalysisResult,
    DetectedBehavior,
)

from guardianclaw.detection.behaviors.types import (
    BehaviorCategory,
    BehaviorSeverity,
    BehaviorType,
)

__all__ = [
    "BehaviorAnalyzer",
    "BehaviorAnalysisResult",
    "DetectedBehavior",
    "BehaviorCategory",
    "BehaviorSeverity",
    "BehaviorType",
]
