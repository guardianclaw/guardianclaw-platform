"""
ElizaOS Integration Handler.

This handler provides GuardianClaw protection for ElizaOS-based social agents.
ElizaOS is a framework for building personality-driven autonomous agents
that interact on platforms like Twitter, Discord, and Telegram.

Features:
    - Character-based personality configuration
    - Memory integrity protection (HMAC-based)
    - Multi-platform social delivery
    - GuardianClaw CLAW validation at message boundaries

Configuration:
    {
        "seed_level": "minimal" | "standard" | "full",
        "on_violation": "block" | "log" | "warn" | "ignore",
        "inject_seed": true | false,
        "seed_version": "v1" | "v2",
        "seed_variant": "minimal" | "standard" | "full",
        "block_unsafe": true | false,
        "log_checks": true | false,
        "memory_integrity": {
            "enabled": true | false,
            "verify_on_read": true | false,
            "sign_on_write": true | false,
            "min_trust_score": 0.0-1.0
        },
        "character": {
            "name": "Agent Name",
            "personality": "Description",
            "bio": "Background",
            "topics": ["allowed", "topics"]
        }
    }

Note:
    The actual ElizaOS runtime execution happens in Node.js via the
    execute_elizaos endpoint. This handler focuses on GuardianClaw validation
    and configuration preparation.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple, TypedDict

from claw_runtime.integrations.base_handler import (
    BaseIntegrationHandler,
    IntegrationConfig,
    IntegrationResult,
    ValidationResult,
    Violation,
    ViolationSeverity,
    SeedLevel,
    OnViolation,
)

logger = logging.getLogger("claw_runtime.integrations.elizaos")


# =============================================================================
# ELIZAOS-SPECIFIC TYPES
# =============================================================================

class MemoryIntegrityConfig(TypedDict, total=False):
    """Configuration for ElizaOS memory integrity protection."""
    enabled: bool
    verify_on_read: bool
    sign_on_write: bool
    min_trust_score: float
    secret_key: str


class CharacterConfig(TypedDict, total=False):
    """ElizaOS character configuration."""
    name: str
    personality: str
    bio: str
    topics: List[str]
    forbidden_topics: List[str]
    adjectives: List[str]
    knowledge: List[str]
    examples: List[Dict[str, str]]


@dataclass
class ElizaOSRuntimeConfig:
    """
    Complete configuration for ElizaOS runtime execution.

    This is the configuration passed to the Node.js runtime.
    """
    character: CharacterConfig
    claw_config: Dict[str, Any]
    memory_integrity: MemoryIntegrityConfig
    platform_config: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "character": dict(self.character),
            "claw_config": self.claw_config,
            "memory_integrity": dict(self.memory_integrity),
            "platform_config": self.platform_config,
        }


# =============================================================================
# HMAC MEMORY INTEGRITY FUNCTIONS
# =============================================================================

# Default secret key (should be overridden in production)
_DEFAULT_SECRET_KEY = "claw-memory-integrity-default-key"


def generate_secret_key() -> str:
    """
    Generate a cryptographically secure secret key for HMAC signing.

    Returns:
        Hex-encoded 32-byte secret key
    """
    return secrets.token_hex(32)


def sign_memory_content(
    content: str,
    secret_key: str,
    timestamp: Optional[float] = None,
    source: str = "unknown",
) -> str:
    """
    Sign memory content with HMAC-SHA256.

    Creates a signature that includes the content, timestamp, and source
    to prevent replay attacks and ensure content integrity.

    Args:
        content: The memory content to sign
        secret_key: Secret key for HMAC
        timestamp: Unix timestamp (uses current time if not provided)
        source: Source identifier (self, user, system, external)

    Returns:
        Signature in format: "timestamp:source:hmac_hex"
    """
    if timestamp is None:
        timestamp = time.time()

    # Create message to sign: content|timestamp|source
    message = f"{content}|{timestamp}|{source}"

    # Generate HMAC-SHA256
    signature = hmac.new(
        key=secret_key.encode("utf-8"),
        msg=message.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    # Return composite signature
    return f"{timestamp}:{source}:{signature}"


def verify_memory_signature(
    content: str,
    signature: str,
    secret_key: str,
    max_age_seconds: Optional[float] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Verify a memory content signature.

    Args:
        content: The memory content to verify
        signature: Signature in format "timestamp:source:hmac_hex"
        secret_key: Secret key for HMAC verification
        max_age_seconds: Maximum allowed age of signature (None = no limit)

    Returns:
        Tuple of (is_valid, error_message)
        - (True, None) if valid
        - (False, "error description") if invalid
    """
    try:
        # Parse signature
        parts = signature.split(":", 2)
        if len(parts) != 3:
            return False, "Invalid signature format"

        timestamp_str, source, provided_hmac = parts

        try:
            timestamp = float(timestamp_str)
        except ValueError:
            return False, "Invalid timestamp in signature"

        # Check age if max_age specified
        if max_age_seconds is not None:
            age = time.time() - timestamp
            if age > max_age_seconds:
                return False, f"Signature expired (age: {age:.0f}s, max: {max_age_seconds:.0f}s)"
            if age < -60:  # Allow 1 minute clock skew
                return False, "Signature timestamp is in the future"

        # Recreate message and compute expected HMAC
        message = f"{content}|{timestamp}|{source}"
        expected_hmac = hmac.new(
            key=secret_key.encode("utf-8"),
            msg=message.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).hexdigest()

        # Constant-time comparison to prevent timing attacks
        if hmac.compare_digest(provided_hmac, expected_hmac):
            return True, None
        else:
            return False, "Signature mismatch"

    except Exception as e:
        return False, f"Signature verification error: {str(e)}"


def extract_signature_metadata(signature: str) -> Optional[Dict[str, Any]]:
    """
    Extract metadata from a signature without verifying it.

    Args:
        signature: Signature in format "timestamp:source:hmac_hex"

    Returns:
        Dict with timestamp and source, or None if invalid format
    """
    try:
        parts = signature.split(":", 2)
        if len(parts) != 3:
            return None

        timestamp_str, source, _ = parts
        timestamp = float(timestamp_str)

        return {
            "timestamp": timestamp,
            "source": source,
            "age_seconds": time.time() - timestamp,
        }
    except Exception:
        return None


# =============================================================================
# ELIZAOS HANDLER
# =============================================================================

class ElizaOSHandler(BaseIntegrationHandler):
    """
    Integration handler for ElizaOS social agents.

    This handler provides GuardianClaw protection for ElizaOS agents by:
    1. Validating incoming messages before processing
    2. Injecting safety seeds into the agent's system prompt
    3. Validating outgoing responses before delivery
    4. Protecting agent memory with HMAC signatures

    The actual agent execution happens in Node.js via Modal.
    This handler focuses on validation and configuration.

    Example:
        handler = ElizaOSHandler(IntegrationConfig.from_dict({
            "seed_level": "standard",
            "inject_seed": True,
            "memory_integrity": {"enabled": True},
            "character": {"name": "MyBot", "personality": "Friendly helper"}
        }))

        # Validate incoming message
        input_result = handler.validate_input(user_message)
        if input_result.blocked:
            return {"blocked": True, "reason": input_result.violations}

        # Get runtime configuration for Node.js execution
        runtime_config = handler.get_runtime_config()

        # After Node.js execution, validate response
        output_result = handler.validate_output(agent_response, user_message)
    """

    FRAMEWORK = "elizaos"
    DEFAULT_SEED_LEVEL = SeedLevel.STANDARD
    DEFAULT_ON_VIOLATION = OnViolation.BLOCK

    def __init__(self, config: IntegrationConfig):
        """
        Initialize ElizaOS handler.

        Args:
            config: Integration configuration with ElizaOS-specific settings
        """
        # Extract ElizaOS-specific configuration
        fc = config.framework_config

        # Seed configuration
        self._seed_version = fc.get("seed_version", "v2")
        self._seed_variant = fc.get("seed_variant", "standard")
        self._block_unsafe = fc.get("block_unsafe", True)
        self._log_checks = fc.get("log_checks", True)

        # Memory integrity configuration
        memory_config = fc.get("memory_integrity", {})
        self._memory_integrity: MemoryIntegrityConfig = {
            "enabled": memory_config.get("enabled", False),
            "verify_on_read": memory_config.get("verify_on_read", True),
            "sign_on_write": memory_config.get("sign_on_write", True),
            "min_trust_score": memory_config.get("min_trust_score", 0.5),
        }

        # Character configuration
        character = fc.get("character", {})
        self._character: CharacterConfig = {
            "name": character.get("name", "GuardianClaw Agent"),
            "personality": character.get("personality", ""),
            "bio": character.get("bio", ""),
            "topics": character.get("topics", []),
            "forbidden_topics": character.get("forbidden_topics", []),
            "adjectives": character.get("adjectives", []),
            "knowledge": character.get("knowledge", []),
            "examples": character.get("examples", []),
        }

        # Platform configuration (Discord, Telegram, Twitter)
        self._platform_config = fc.get("platform_config", {})

        # Call parent init (creates validator)
        super().__init__(config)

    def _create_validator(self) -> Any:
        """
        Create the GuardianClaw validator for ElizaOS.

        Uses the standard ClawValidator from guardianclaw SDK.
        The ElizaOS-specific plugin (@guardianclaw/elizaos-plugin)
        runs in Node.js, but validation logic is framework-agnostic.
        """
        try:
            from guardianclaw import ClawValidator, ClawConfig

            # Configure gates based on settings
            gates = self.config.gates
            sdk_config = ClawConfig(
                gate1_enabled=gates.get("limits", True),
                gate2_enabled=gates.get("avoidance", True) or gates.get("credibility", True),
                gate3_enabled=False,  # Observer gate handled separately
                fail_closed=self.config.fail_closed,
            )

            validator = ClawValidator(config=sdk_config)
            logger.info(
                f"ElizaOS validator created: seed_version={self._seed_version}, "
                f"memory_integrity={self._memory_integrity.get('enabled', False)}"
            )
            return validator

        except ImportError as e:
            logger.warning(f"guardianclaw not available: {e}")
            return None

    def _execute_internal(
        self,
        state: Dict[str, Any],
        step: Any,
    ) -> IntegrationResult:
        """
        Execute ElizaOS-specific logic.

        This method prepares the configuration for Node.js execution.
        The actual ElizaOS agent runs in the Node.js runtime.

        Args:
            state: Current execution state containing input/history
            step: Current flow step being executed

        Returns:
            IntegrationResult with prepared configuration
        """
        current_input = state.get("current_input", state.get("initial_input", ""))

        # 1. Validate input
        input_result = self.validate_input(current_input)
        if input_result.blocked and self.config.on_violation == OnViolation.BLOCK:
            return IntegrationResult(
                success=False,
                error=f"Input blocked: {[v.type for v in input_result.violations]}",
                validation_input=input_result,
            )

        # 2. Prepare character with seed injection
        prepared_character = self._prepare_character_with_seed()

        # 3. Build runtime configuration
        runtime_config = ElizaOSRuntimeConfig(
            character=prepared_character,
            claw_config={
                "seed_level": self.config.seed_level.value,
                "seed_version": self._seed_version,
                "seed_variant": self._seed_variant,
                "block_unsafe": self._block_unsafe,
                "log_checks": self._log_checks,
                "gates": self.config.gates,
            },
            memory_integrity=self._memory_integrity,
            platform_config=self._platform_config,
        )

        # 4. Return result with prepared configuration
        return IntegrationResult(
            success=True,
            data={
                "runtime_config": runtime_config.to_dict(),
                "seed_injected": self.config.inject_seed and self.get_seed() is not None,
                "memory_integrity_enabled": self._memory_integrity.get("enabled", False),
            },
            validation_input=input_result,
            metadata={
                "character_name": self._character.get("name", "Unknown"),
                "seed_version": self._seed_version,
                "seed_variant": self._seed_variant,
            },
        )

    def _prepare_character_with_seed(self) -> CharacterConfig:
        """
        Prepare character configuration with seed injection.

        The seed is injected into the character's personality/bio
        to influence the agent's behavior at the system prompt level.
        """
        character = dict(self._character)

        if self.config.inject_seed:
            seed = self.get_seed()
            if seed:
                # Prepend seed to personality
                original_personality = character.get("personality", "")
                character["personality"] = f"{seed}\n\n{original_personality}"

                logger.debug(
                    f"Injected {self._seed_variant} seed into character personality"
                )

        return character

    def get_runtime_config(self) -> Dict[str, Any]:
        """
        Get the complete runtime configuration for Node.js execution.

        This method returns all configuration needed by the Node.js
        ElizaOS runtime to initialize and run the agent.

        Returns:
            Dictionary with complete runtime configuration
        """
        return {
            "character": self._prepare_character_with_seed(),
            "claw": {
                "seed_level": self.config.seed_level.value,
                "seed_version": self._seed_version,
                "seed_variant": self._seed_variant,
                "block_unsafe": self._block_unsafe,
                "log_checks": self._log_checks,
                "gates": self.config.gates,
                "on_violation": self.config.on_violation.value,
            },
            "memory_integrity": self._memory_integrity,
            "platform": self._platform_config,
        }

    def get_character(self) -> CharacterConfig:
        """Get the character configuration."""
        return self._character

    def get_memory_integrity_config(self) -> MemoryIntegrityConfig:
        """Get memory integrity configuration."""
        return self._memory_integrity

    def get_secret_key(self) -> str:
        """
        Get the secret key for HMAC operations.

        Returns the configured secret key or generates a default one.
        In production, this should be set via memory_integrity.secret_key.
        """
        return self._memory_integrity.get("secret_key", _DEFAULT_SECRET_KEY)

    def sign_memory_entry(
        self,
        content: str,
        source: str = "self",
    ) -> str:
        """
        Sign a memory entry for integrity protection.

        Creates an HMAC-SHA256 signature that includes content, timestamp,
        and source to ensure memory integrity.

        Args:
            content: Memory content to sign
            source: Source identifier (self, user, system)

        Returns:
            Signature string in format "timestamp:source:hmac_hex"

        Example:
            signature = handler.sign_memory_entry("Agent response", source="self")
            # Store content + signature together
        """
        if not self._memory_integrity.get("sign_on_write", False):
            logger.debug("Memory signing disabled, returning empty signature")
            return ""

        return sign_memory_content(
            content=content,
            secret_key=self.get_secret_key(),
            source=source,
        )

    def validate_memory_entry(
        self,
        content: str,
        signature: Optional[str] = None,
        source: str = "unknown",
        max_age_seconds: Optional[float] = None,
    ) -> ValidationResult:
        """
        Validate a memory entry for integrity.

        Performs comprehensive validation including:
        1. Trust score based on source
        2. HMAC signature verification (if enabled)
        3. Signature age verification (optional)

        Args:
            content: Memory content to validate
            signature: HMAC signature in format "timestamp:source:hmac_hex"
            source: Source of the memory entry (used for trust scoring)
            max_age_seconds: Maximum allowed signature age (None = no limit)

        Returns:
            ValidationResult indicating if memory is trusted
        """
        if not self._memory_integrity.get("enabled", False):
            return ValidationResult.passed(decided_by="memory_integrity_disabled")

        # Trust score based on source
        trust_scores = {
            "self": 1.0,      # Agent's own outputs
            "user": 0.7,      # Direct user input
            "system": 0.9,    # System messages
            "external": 0.3,  # External data
            "unknown": 0.3,
        }

        trust_score = trust_scores.get(source, 0.3)
        min_trust = self._memory_integrity.get("min_trust_score", 0.5)

        if trust_score < min_trust:
            return ValidationResult.failed(
                violations=[Violation(
                    type="memory:low_trust",
                    message=f"Memory from '{source}' has trust score {trust_score} < {min_trust}",
                    severity=ViolationSeverity.MEDIUM,
                    metadata={"source": source, "trust_score": trust_score},
                )],
                decided_by="memory_integrity",
            )

        # Check if signature verification is required
        if not self._memory_integrity.get("verify_on_read", False):
            return ValidationResult.passed(decided_by="memory_integrity_trust_only")

        # Signature required but not provided
        if not signature:
            return ValidationResult.failed(
                violations=[Violation(
                    type="memory:missing_signature",
                    message="Memory entry missing required signature",
                    severity=ViolationSeverity.HIGH,
                )],
                decided_by="memory_integrity",
            )

        # Verify HMAC signature
        is_valid, error_msg = verify_memory_signature(
            content=content,
            signature=signature,
            secret_key=self.get_secret_key(),
            max_age_seconds=max_age_seconds,
        )

        if not is_valid:
            return ValidationResult.failed(
                violations=[Violation(
                    type="memory:invalid_signature",
                    message=f"Memory signature verification failed: {error_msg}",
                    severity=ViolationSeverity.HIGH,
                    metadata={
                        "source": source,
                        "error": error_msg,
                    },
                )],
                decided_by="memory_integrity",
            )

        # Extract and log signature metadata
        sig_metadata = extract_signature_metadata(signature)
        if sig_metadata and self._log_checks:
            logger.debug(
                f"Memory signature verified: source={sig_metadata.get('source')}, "
                f"age={sig_metadata.get('age_seconds', 0):.1f}s"
            )

        return ValidationResult.passed(
            decided_by="memory_integrity",
            metadata={
                "signature_verified": True,
                "signature_metadata": sig_metadata,
            },
        )


# =============================================================================
# HANDLER REGISTRATION
# =============================================================================

def _register():
    """Register ElizaOS handler on module import."""
    try:
        from claw_runtime.integrations import register_handler
        register_handler("elizaos", handler_class=ElizaOSHandler)
        logger.debug("ElizaOS handler registered")
    except ImportError:
        pass


_register()
