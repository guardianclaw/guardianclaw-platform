"""
Memory Shield Module - Cryptographic protection for agent memory.

Uses MemoryIntegrityChecker from guardianclaw SDK to prevent
memory injection attacks through HMAC verification.
"""

import logging
import hashlib
import hmac
import json
from typing import Dict, Any, Optional

logger = logging.getLogger("claw_runtime.modules.memory_shield")


class MemoryIntegrityError(Exception):
    """Raised when memory integrity check fails."""

    def __init__(self, field: str, reason: str):
        self.field = field
        self.reason = reason
        super().__init__(f"Memory integrity failed for {field}: {reason}")


class MemoryShieldModule:
    """
    Protects agent memory with HMAC-based integrity verification.

    Prevents memory injection attacks by signing memory entries
    and verifying them before use.
    """

    def __init__(self, config: Dict[str, Any] = None, llm_key: str = None):
        """
        Initialize the memory shield.

        Args:
            config: Module configuration
                - secret_key: HMAC signing key (auto-generated if not provided)
            llm_key: Not used, included for interface consistency
        """
        self.config = config or {}

        # Generate or use provided secret key
        self._secret_key = self.config.get("secret_key")
        if not self._secret_key:
            # Generate from a deterministic source if available, or random
            import os
            self._secret_key = os.urandom(32).hex()

        self._checker = None
        self._init_checker()

        logger.info("MemoryShieldModule initialized")

    def _init_checker(self):
        """Initialize the MemoryIntegrityChecker."""
        try:
            from guardianclaw.memory import MemoryIntegrityChecker

            self._checker = MemoryIntegrityChecker(secret_key=self._secret_key)
        except ImportError:
            logger.warning("guardianclaw memory module not available, using fallback")
            self._checker = None
        except Exception as e:
            logger.error(f"Failed to initialize memory checker: {e}")
            self._checker = None

    def sign(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sign memory data for integrity verification.

        Args:
            data: Memory data to sign

        Returns:
            Data with signature attached
        """
        if self._checker:
            return self._checker.sign(data)

        # Fallback implementation
        signature = self._compute_signature(data)
        return {
            **data,
            "_memory_signature": signature,
            "_memory_version": 1,
        }

    def verify(self, data: Dict[str, Any]) -> bool:
        """
        Verify memory data integrity.

        Args:
            data: Memory data with signature

        Returns:
            True if integrity verified, False otherwise
        """
        if self._checker:
            return self._checker.verify(data)

        # Fallback implementation
        if "_memory_signature" not in data:
            logger.warning("Memory data missing signature")
            return False

        stored_signature = data.pop("_memory_signature")
        data.pop("_memory_version", None)

        computed = self._compute_signature(data)

        # Restore signature
        data["_memory_signature"] = stored_signature

        return hmac.compare_digest(stored_signature, computed)

    def process(self, memory: Dict[str, Any]) -> Dict[str, Any]:
        """
        Verify memory integrity before use.

        Args:
            memory: Agent memory state

        Returns:
            Verified memory

        Raises:
            MemoryIntegrityError: If verification fails
        """
        if not memory:
            return {}

        # If memory has signature, verify it
        if "_memory_signature" in memory:
            if not self.verify(memory.copy()):
                raise MemoryIntegrityError(
                    field="memory",
                    reason="Memory integrity verification failed - possible tampering detected"
                )

        return memory

    def protect(self, memory: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sign memory for storage.

        Args:
            memory: Memory to protect

        Returns:
            Signed memory
        """
        # Remove old signature if present
        clean_memory = {k: v for k, v in memory.items() if not k.startswith("_memory_")}
        return self.sign(clean_memory)

    def _compute_signature(self, data: Dict[str, Any]) -> str:
        """Compute HMAC signature for data."""
        # Sort keys for consistent serialization
        serialized = json.dumps(data, sort_keys=True, default=str)
        signature = hmac.new(
            self._secret_key.encode() if isinstance(self._secret_key, str) else self._secret_key,
            serialized.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature

    def get_stats(self) -> Dict[str, Any]:
        """Get module statistics."""
        return {
            "module": "memory_shield",
            "checker": "sdk" if self._checker else "fallback",
        }
