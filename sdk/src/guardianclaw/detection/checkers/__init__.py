"""
Output Checkers for OutputValidator.

This module provides the checker components used by OutputValidator to
verify AI output and detect when safety measures (seed) have failed.
Checkers implement the BaseChecker interface and can be registered,
swapped, and upgraded at runtime.

Available Checkers:
    BaseChecker: Abstract base class for all checkers
    CheckerConfig: Configuration dataclass for checkers

Planned Checkers (future versions):
    DeceptionChecker: Detects deceptive/false content in output
    HarmfulContentChecker: Detects harmful content in output
    BypassIndicatorChecker: Detects signs of successful jailbreak
    ComplianceChecker: Checks policy/rules compliance

Key Difference from Detectors:
    - Detectors (input): "Is this an ATTACK?" - Pattern/intent based
    - Checkers (output): "Did the SEED fail?" - Behavior/content based

    Checkers often need the input context to understand if the output
    is appropriate given what was asked.

Quick Start:
    from guardianclaw.detection.checkers import HarmfulContentChecker

    checker = HarmfulContentChecker()
    result = checker.check(
        output="Here's how to make a bomb...",
        input_context="How do I make explosives?",
    )

    if result.detected:
        print(f"Seed failed: {result.category}")
        print(f"CLAW gate: {CheckFailureType(result.category).gate}")

Custom Checker:
    from guardianclaw.detection.checkers import BaseChecker, CheckerConfig
    from guardianclaw.detection.types import DetectionResult, CheckFailureType

    class PolicyChecker(BaseChecker):
        @property
        def name(self) -> str:
            return "policy_checker"

        @property
        def version(self) -> str:
            return "1.0.0"

        def check(self, output, input_context=None, rules=None):
            merged_rules = self._merge_rules(rules)
            if self._violates_policy(output, merged_rules):
                return DetectionResult(
                    detected=True,
                    detector_name=self.name,
                    detector_version=self.version,
                    confidence=0.9,
                    category=CheckFailureType.POLICY_VIOLATION.value,
                    description="Output violates policy",
                )
            return DetectionResult.nothing_detected(self.name, self.version)

Context Awareness:
    Checkers receive input_context to make informed decisions:

    # Chemistry output appropriate for chemistry input
    checker.check(
        output="NaCl is sodium chloride...",
        input_context="What is table salt made of?",
    )  # -> Safe

    # Chemistry output suspicious for hacking input
    checker.check(
        output="To synthesize...",
        input_context="How do I hack into systems?",
    )  # -> Potentially suspicious topic shift

Architecture:
    Checkers are designed as plugins that can be:
    - Registered with CheckerRegistry
    - Enabled/disabled at runtime
    - Upgraded to newer versions
    - Configured with custom rules

References:
    - OUTPUT_VALIDATOR_v2.md: Design specification
    - VALIDATION_360_v2.md: Architecture overview
"""

from guardianclaw.detection.checkers.base import (
    BaseChecker,
    CheckerConfig,
)

from guardianclaw.detection.checkers.harmful import HarmfulContentChecker
from guardianclaw.detection.checkers.deception import DeceptionChecker
from guardianclaw.detection.checkers.bypass import BypassIndicatorChecker
from guardianclaw.detection.checkers.compliance import ComplianceChecker
from guardianclaw.detection.checkers.sensitive_data import SensitiveDataChecker

from guardianclaw.detection.checkers.semantic import (
    SemanticChecker,
    SemanticCheckerConfig,
    AsyncSemanticChecker,
)

from guardianclaw.detection.checkers.toxicity import (
    ToxicityChecker,
    ToxicityCheckerConfig,
)

from guardianclaw.detection.checkers.embedding import (
    EmbeddingChecker,
    EmbeddingCheckerConfig,
    AsyncEmbeddingChecker,
)

from guardianclaw.detection.checkers.behavior_checker import (
    BehaviorChecker,
    BehaviorCheckerConfig,
)

from guardianclaw.detection.checkers.output_signal import (
    OutputSignalChecker,
    OutputSignalConfig,
)

__all__ = [
    # Base classes
    "BaseChecker",
    "CheckerConfig",
    # Heuristic Checkers
    "HarmfulContentChecker",
    "DeceptionChecker",
    "BypassIndicatorChecker",
    "ComplianceChecker",
    "SensitiveDataChecker",
    "ToxicityChecker",
    "ToxicityCheckerConfig",
    # Semantic Checkers (LLM-based)
    "SemanticChecker",
    "SemanticCheckerConfig",
    "AsyncSemanticChecker",
    # Embedding Checkers
    "EmbeddingChecker",
    "EmbeddingCheckerConfig",
    "AsyncEmbeddingChecker",
    # Behavior Checker
    "BehaviorChecker",
    "BehaviorCheckerConfig",
    # Output Signal Checker
    "OutputSignalChecker",
    "OutputSignalConfig",
]

__version__ = "1.4.0"
