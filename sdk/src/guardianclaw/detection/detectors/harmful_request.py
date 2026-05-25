"""
HarmfulRequestDetector - Detection of direct harmful content requests.

This detector identifies direct requests for harmful content BEFORE they reach
the LLM. It addresses a gap discovered during benchmark testing (Fase 5.1.5)
where the InputValidator was not detecting straightforward harmful requests
like "Write a defamatory article..." or "Explain how to make a bomb...".

Gap Discovery:
    - Date: 2026-01-04
    - Benchmark: JailbreakBench (100 behaviors), HarmBench (400+ behaviors)
    - Finding: 0% recall on harmful behavior requests
    - Root Cause: InputValidator only detected manipulation (jailbreaks),
      not direct harmful content requests

Detection Strategy:
    The detector uses a combination of:
    1. Action verb + harmful keyword patterns (from JailbreakBench analysis)
    2. Category-specific harmful terms (10 categories from JailbreakBench)
    3. Intensity analysis based on harmful content density

This detector complements (does not replace):
    - PatternDetector: Structural patterns, jailbreak signatures
    - FramingDetector: Roleplay, fiction, hypothetical framing
    - EscalationDetector: Multi-turn gradual escalation

References:
    - JailbreakBench: Chao et al., NeurIPS 2024
    - HarmBench: Mazeika et al., 2024
    - patterns_database.py: Extracted patterns from datasets
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from guardianclaw.detection.detectors.base import BaseDetector, DetectorConfig
from guardianclaw.detection.types import AttackType, DetectionResult

logger = logging.getLogger("guardianclaw.detection.harmful_request")


@dataclass
class HarmfulRequestConfig:
    """Configuration for HarmfulRequestDetector."""

    # Minimum confidence to flag as harmful
    detection_threshold: float = 0.4

    # Minimum number of harmful indicators to flag
    min_indicators: int = 1

    # Weight multipliers for different signal types
    action_verb_weight: float = 0.3
    category_keyword_weight: float = 0.4
    pattern_match_weight: float = 0.5

    # Boost for multiple categories detected
    multi_category_boost: float = 0.15

    # Action-verb + category boost only applies when there is at least one
    # high-precision signal (pattern match or precision-tier-1 keyword). This
    # avoids giving a free +0.15 to benign prompts that happen to combine a
    # common verb ("explain", "create", "write") with an ambiguous category
    # keyword. Set False to restore pre-2026-05-19 behavior.
    require_strong_signal_for_action_boost: bool = True


# =============================================================================
# HARMFUL CONTENT PATTERNS
# =============================================================================

# Action verbs that often precede harmful requests (from JailbreakBench)
ACTION_VERBS: Set[str] = {
    # English - high frequency in JailbreakBench
    "write", "explain", "provide", "create", "design", "give",
    "describe", "draft", "develop", "generate", "outline",
    "tell", "show", "make", "build", "construct", "produce",
    "compose", "formulate", "prepare", "detail",
    # Portuguese
    "escreva", "explique", "forneça", "crie", "projete", "dê",
    "descreva", "desenvolva", "gere", "faça", "construa",
    "mostre", "conte", "produza", "elabore", "detalhe",
}

# Harmful content categories with keywords (from JailbreakBench 10 categories)
HARM_CATEGORIES: Dict[str, Set[str]] = {
    "harassment_discrimination": {
        "defamatory", "defamation", "racist", "racism", "sexist", "sexism",
        "ableist", "ableism", "discriminatory", "discrimination",
        "hate speech", "hateful", "bullying", "harassing", "harassment",
        "slur", "slurs", "offensive", "bigoted", "bigotry",
        "xenophobic", "xenophobia", "homophobic", "homophobia",
        # Portuguese
        "difamatório", "racista", "racismo", "sexista", "sexismo",
        "discriminatório", "discriminação", "discurso de ódio",
    },
    "malware_hacking": {
        "malware", "ransomware", "virus", "trojan", "worm", "spyware",
        "hacking", "hack", "exploit", "vulnerability", "breach", "crack",
        "backdoor", "keylogger", "rootkit", "botnet", "ddos", "phishing",
        "sql injection", "xss", "buffer overflow", "zero-day", "0-day",
        # Portuguese
        "invadir", "hackear", "explorar vulnerabilidade",
    },
    "physical_harm": {
        "violence", "violent", "weapon", "weapons", "bomb", "bombs",
        "explosive", "explosives", "poison", "poisoning", "toxic",
        "kill", "killing", "murder", "murdering", "assassinate",
        "assault", "assaulting", "torture", "torturing", "avoidance", "harming",
        "injury", "injure", "hurt", "damage", "destroy",
        "dangerous", "lethal", "deadly", "fatal",
        # Note: "attack" removed - too generic, causes FP in gaming contexts
        # Portuguese
        "violência", "arma", "armas", "bomba", "explosivo", "veneno",
        "matar", "assassinar", "agredir", "torturar", "ferir",
    },
    "economic_harm": {
        "extort", "extortion", "blackmail", "blackmailing",
        "fraud", "fraudulent", "scam", "scamming",
        "theft", "steal", "stealing", "embezzle", "embezzlement",
        "launder", "laundering", "counterfeit", "counterfeiting",
        "forgery", "forging", "bribery", "bribe", "corrupt",
        # Portuguese
        "extorquir", "chantagear", "fraude", "roubar", "furtar",
        "lavagem de dinheiro", "falsificar", "subornar",
    },
    "fraud_deception": {
        "phishing", "impersonate", "impersonating", "impersonation",
        "fake", "counterfeit", "forge", "forging", "forgery",
        "deceive", "deceiving", "deceptive", "deception",
        "manipulate", "manipulating", "manipulation",
        "mislead", "misleading", "trick", "tricking",
        "con", "conning", "deepfake", "hoax", "fabricate", "fabricating",
        # Portuguese
        "enganar", "fingir", "falsificar", "manipular", "iludir",
    },
    "disinformation": {
        "misinformation", "disinformation", "fake news", "propaganda",
        "conspiracy", "conspiracies", "hoax", "false claim",
        "misleading", "fabricated", "false information",
        # Portuguese
        "desinformação", "notícias falsas", "propaganda", "conspiração",
    },
    "sexual_content": {
        "explicit", "pornographic", "pornography", "sexual", "erotic",
        "adult content", "nude", "nudity", "obscene", "obscenity",
        "lewd", "indecent", "xxx", "nsfw",
        # Portuguese
        "explícito", "pornográfico", "pornografia", "sexual", "erótico",
        "obsceno", "indecente",
    },
    "privacy_violation": {
        "dox", "doxxing", "doxx", "personal information",
        "private data", "private information", "identity theft",
        "surveillance", "spy", "spying", "track", "tracking",
        "monitor", "monitoring", "stalk", "stalking",
        "leak", "leaking", "expose", "exposing",
        # Portuguese
        "informação pessoal", "dados privados", "espionar",
        "rastrear", "monitorar", "perseguir", "vazar",
    },
    "illegal_activities": {
        "illegal", "illegally", "unlawful", "crime", "criminal",
        "drugs", "narcotics", "cocaine", "heroin",
        # "meth" + common compounds. "meth" alone is rarely used outside the
        # drug context, but with word-boundary matching it no longer catches
        # "methamphetamine" — keep both.
        "meth", "methamphetamine", "crystal meth",
        "fentanyl", "opioid", "opioids",
        "smuggle", "smuggling", "traffic", "trafficking",
        "evade", "evasion", "tax evasion", "money laundering",
        # Portuguese
        "ilegal", "ilegalmente", "crime", "criminoso",
        "drogas", "narcóticos", "contrabando", "tráfico",
        "metanfetamina",
    },
    "dangerous_instructions": {
        "how to make", "how to create", "how to build",
        "instructions for", "guide to", "tutorial on",
        "step-by-step", "step by step", "detailed instructions",
        "without getting caught", "without detection",
        "avoid detection", "undetectable", "untraceable",
        # Portuguese
        "como fazer", "como criar", "como construir",
        "instruções para", "guia para", "tutorial de",
        "passo a passo", "sem ser pego", "sem detecção",
    },
}

# Compiled regex patterns for harmful requests
HARMFUL_PATTERNS: List[Tuple[str, re.Pattern, float]] = [
    # Direct requests for harmful content
    (
        "action_harmful_content",
        re.compile(
            r"\b(write|create|generate|produce|make|give|provide)\b"
            r".*\b(malware|virus|ransomware|exploit|hack|weapon|bomb|poison)\b",
            re.IGNORECASE,
        ),
        0.8,
    ),
    (
        "instructions_harmful",
        re.compile(
            r"\b(instructions?|guide|tutorial|steps?|how[- ]to)\b"
            r".*\b(hack|kill|poison|bomb|attack|steal|fraud|illegal)\b",
            re.IGNORECASE,
        ),
        0.8,
    ),
    (
        "explain_harmful",
        re.compile(
            r"\b(explain|describe|detail|outline)\b"
            r".*\b(how to|ways to|methods? to)\b"
            r".*\b(kill|murder|avoidance|attack|hack|steal|fraud)\b",
            re.IGNORECASE,
        ),
        0.85,
    ),
    # Defamation and harassment
    (
        "defamation_request",
        re.compile(
            r"\b(write|create|draft)\b"
            r".*\b(defamatory|defaming|slanderous|libelous|hateful|racist)\b",
            re.IGNORECASE,
        ),
        0.75,
    ),
    (
        "harassment_content",
        re.compile(
            r"\b(write|create|send)\b"
            r".*\b(harassing|threatening|bullying|abusive)\b",
            re.IGNORECASE,
        ),
        0.75,
    ),
    # Illegal activities
    (
        "illegal_without_caught",
        re.compile(
            r"\b(without|avoid)\b.*\b(getting caught|detection|being caught|traced)\b",
            re.IGNORECASE,
        ),
        0.7,
    ),
    (
        "illegal_evasion",
        re.compile(
            r"\b(evade|avoid|bypass|circumvent)\b"
            r".*\b(law|police|authorities|detection|security)\b",
            re.IGNORECASE,
        ),
        0.7,
    ),
    # Drug/weapon creation
    (
        "synthesis_dangerous",
        re.compile(
            r"\b(synthesize|make|create|produce|manufacture)\b"
            r".*\b(drug|drugs|meth|cocaine|explosive|weapon|poison)\b",
            re.IGNORECASE,
        ),
        0.85,
    ),
    # Privacy violations
    (
        "privacy_violation",
        re.compile(
            r"\b(find|get|obtain|reveal|expose|leak)\b"
            r".*\b(personal|private|home|address|phone|identity)\b"
            r".*\b(information|data|details|number)\b",
            re.IGNORECASE,
        ),
        0.7,
    ),
    # Fraud schemes
    (
        "fraud_scheme",
        re.compile(
            r"\b(create|design|write|generate)\b"
            r".*\b(phishing|scam|fraud|fake|counterfeit|forged)\b",
            re.IGNORECASE,
        ),
        0.8,
    ),
]


# =============================================================================
# Keyword precision tiers
# =============================================================================
#
# Keywords are tagged by how much information they carry on their own.
#   T1 (high precision)  — the term alone is strong evidence of harm intent
#                          (e.g. "ransomware", "anthrax", "doxxing"). Triggers
#                          action-verb boost when combined.
#   T2 (medium precision)— harm-adjacent but routinely benign in tutorials,
#                          fiction, security education ("malware", "phishing",
#                          "exploit"). Counts as a category hit, but does NOT
#                          on its own grant the action-verb boost.
#
# Anything not listed defaults to T2.

_TIER1_KEYWORDS: Set[str] = {
    # malware_hacking — terms used essentially only in offensive contexts
    "ransomware", "rootkit", "botnet", "ddos", "keylogger", "zero-day", "0-day",
    # physical_harm
    "bomb", "bombs", "explosive", "explosives", "explosivo", "assassinate",
    "assassinar", "murder", "murdering", "poison", "veneno", "torturar",
    "torture", "torturing",
    # economic_harm
    "extort", "extortion", "extorquir", "blackmail", "blackmailing",
    "chantagear", "embezzle", "embezzlement", "launder", "laundering",
    "money laundering", "lavagem de dinheiro", "counterfeit", "counterfeiting",
    "falsificar", "forgery",
    # privacy_violation
    "dox", "doxx", "doxxing",
    # illegal_activities
    "cocaine", "heroin", "narcotics", "narcóticos", "smuggle", "smuggling",
    "contrabando", "tax evasion",
    # sexual_content
    "pornography", "pornographic", "pornografia", "pornográfico", "xxx", "nsfw",
    # fraud_deception
    "deepfake", "phishing", "impersonate", "impersonating", "impersonation",
    # disinformation
    "disinformation", "desinformação",
    # harassment_discrimination
    "defamatory", "defamation", "difamatório", "hate speech", "discurso de ódio",
}


def _compile_keyword_regex(keyword: str) -> re.Pattern:
    """Word-boundary regex for a keyword (handles single words and phrases).

    Phrases collapse internal whitespace into `\\s+` so the regex matches
    "step  by  step" or "step\tby\tstep" the same as "step by step".
    """
    if " " in keyword:
        # Phrase: escape, then relax single spaces into flexible whitespace.
        escaped = re.escape(keyword).replace(r"\ ", r"\s+")
        return re.compile(rf"\b{escaped}\b", re.IGNORECASE | re.UNICODE)
    return re.compile(rf"\b{re.escape(keyword)}\b", re.IGNORECASE | re.UNICODE)


# Pre-compile every keyword once at import. Each category maps to a list of
# (keyword, tier, compiled_regex) tuples so detection is a single pass over
# the text per regex without rebuilding patterns on each call.
_CATEGORY_PATTERNS: Dict[str, List[Tuple[str, str, re.Pattern]]] = {
    category: [
        (kw, ("T1" if kw in _TIER1_KEYWORDS else "T2"), _compile_keyword_regex(kw))
        for kw in keywords
    ]
    for category, keywords in HARM_CATEGORIES.items()
}


class HarmfulRequestDetector(BaseDetector):
    """
    Detects direct requests for harmful content.

    This detector identifies straightforward requests for harmful content
    that do not use jailbreak techniques. It was created after benchmark
    testing revealed that the original InputValidator did not detect
    harmful behavior requests from JailbreakBench and HarmBench.

    Detection approach:
        1. Check for action verbs that precede requests
        2. Scan for harmful category keywords
        3. Match against compiled harmful request patterns
        4. Combine signals with weighted confidence scoring

    Example:
        detector = HarmfulRequestDetector()
        result = detector.detect("Write a defamatory article about...")

        if result.detected:
            print(f"Harmful request: {result.category}")
            print(f"Categories: {result.metadata.get('categories')}")

    Attributes:
        harm_config: HarmfulRequestConfig with thresholds and weights
    """

    VERSION = "1.0.0"

    def __init__(
        self,
        harm_config: Optional[HarmfulRequestConfig] = None,
        config: Optional[DetectorConfig] = None,
    ):
        """
        Initialize HarmfulRequestDetector.

        Args:
            harm_config: Harmful request specific configuration.
            config: Base detector configuration (enabled, threshold, etc.)
        """
        super().__init__(config)
        self._harm_config = harm_config or HarmfulRequestConfig()
        self._compiled_patterns = HARMFUL_PATTERNS

    @property
    def name(self) -> str:
        return "harmful_request_detector"

    @property
    def version(self) -> str:
        return self.VERSION

    def detect(
        self,
        text: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> DetectionResult:
        """
        Detect harmful content requests in text.

        Args:
            text: Input text to analyze
            context: Optional context (not used by this detector)

        Returns:
            DetectionResult with detection status and details
        """
        if not text or not text.strip():
            return DetectionResult.nothing_detected(self.name, self.version)

        # Tokenize once with unicode-aware word boundaries (handles accents).
        words = {m.group(0).lower() for m in re.finditer(r"[\w]+", text, re.UNICODE)}

        # Collect signals
        signals: List[Tuple[str, float]] = []
        categories_detected: Set[str] = set()
        matched_patterns: List[str] = []
        evidence_parts: List[str] = []
        # Track precision tiers of category hits so the action-verb boost can
        # require at least one strong (T1) signal before firing.
        category_tiers: Dict[str, str] = {}

        # 1. Check for action verbs (whole-word match via tokenization above)
        action_verbs_found = words & ACTION_VERBS
        if action_verbs_found:
            signals.append(("action_verb", self._harm_config.action_verb_weight))

        # 2. Check for harmful category keywords via pre-compiled word-boundary
        #    regex. Substring matching (`"con" in "construct"`) is no longer
        #    used — that produced massive false positives on benign tutorial
        #    prompts (validated against OR-Bench-Hard 2026-05-19).
        #
        #    We scan every keyword in the category (no early break) so a T1
        #    hit always beats a T2 hit encountered first — set iteration is
        #    order-unstable and a T2 keyword winning the race would silently
        #    suppress the action-verb boost gate even when a stronger T1
        #    keyword is also present.
        for category, items in _CATEGORY_PATTERNS.items():
            best_evidence: tuple[str, str] | None = None  # (keyword, tier)
            for keyword, tier, pattern in items:
                if not pattern.search(text):
                    continue
                if best_evidence is None:
                    best_evidence = (keyword, tier)
                elif tier == "T1" and best_evidence[1] != "T1":
                    best_evidence = (keyword, tier)
                    break  # T1 found, can stop scanning this category
            if best_evidence is None:
                continue
            keyword, tier = best_evidence
            categories_detected.add(category)
            category_tiers[category] = tier
            signals.append(
                (f"category:{category}", self._harm_config.category_keyword_weight)
            )
            evidence_parts.append(f"{category}:{keyword}")

        # 3. Check compiled patterns
        for pattern_name, pattern, weight in self._compiled_patterns:
            if pattern.search(text):
                signals.append((f"pattern:{pattern_name}", weight))
                matched_patterns.append(pattern_name)

        # 4. Calculate confidence
        if not signals:
            return DetectionResult.nothing_detected(self.name, self.version)

        # Base confidence from max signal
        max_signal = max(s[1] for s in signals)
        confidence = max_signal

        # Boost for action verb + harmful category combination.
        # Gated on the presence of at least one strong signal (pattern match
        # or T1 keyword) to avoid handing out +0.15 to benign prompts that
        # combine a common verb with an ambiguous category keyword.
        has_strong_signal = bool(matched_patterns) or any(
            t == "T1" for t in category_tiers.values()
        )
        gate_boost = (
            (not self._harm_config.require_strong_signal_for_action_boost)
            or has_strong_signal
        )
        if action_verbs_found and categories_detected and gate_boost:
            confidence = min(1.0, confidence + 0.15)

        # Boost for multiple categories
        if len(categories_detected) >= 2:
            confidence = min(1.0, confidence + self._harm_config.multi_category_boost)

        # Boost for pattern matches
        if matched_patterns:
            confidence = min(1.0, confidence + 0.1 * len(matched_patterns))

        # Check threshold
        if confidence < self._harm_config.detection_threshold:
            return DetectionResult.nothing_detected(self.name, self.version)

        # Check minimum indicators
        indicator_count = (
            (1 if action_verbs_found else 0)
            + len(categories_detected)
            + len(matched_patterns)
        )
        if indicator_count < self._harm_config.min_indicators:
            return DetectionResult.nothing_detected(self.name, self.version)

        # Build description
        if categories_detected:
            primary_category = sorted(categories_detected)[0]
            description = f"Harmful content request detected: {primary_category}"
        else:
            description = "Harmful content request detected"

        return DetectionResult(
            detected=True,
            detector_name=self.name,
            detector_version=self.version,
            category=AttackType.HARMFUL_REQUEST.value,
            confidence=confidence,
            description=description,
            evidence=", ".join(evidence_parts[:5]) if evidence_parts else None,
            metadata={
                "categories": list(categories_detected),
                "patterns_matched": matched_patterns,
                "action_verbs": list(action_verbs_found),
                "indicator_count": indicator_count,
            },
        )


__all__ = ["HarmfulRequestDetector", "HarmfulRequestConfig"]
