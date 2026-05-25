"""Deterministic drainer/threat-intel lookup for ClawPay.

This module is the runtime counterpart of the ``drainer_intel`` Supabase table
introduced in migration ``20260521000000_drainer_intel.sql``. The
``CredibilityGateValidator`` consults a :class:`DrainerLookup` to check whether
a payment recipient address, endpoint, or pattern matches a known indicator
before letting the payment proceed.

Why deterministic and not classifier-based? The Sessão #038 calibration audit
empirically confirmed that classifier-based detection over an adversarial
benchmark fails (AUROC < 0.5 in OR-Bench-Hard). For payment-blocking decisions
we want hits that an auditor can explain in one sentence:

    "blocked because pay_to=0xABC matched ScamSniffer feed entry, imported
     2026-05-21, severity=critical, source_ref=..."

Sources are pluggable. The default deployment chains a remote Supabase source
with an in-memory cache; tests and offline use cases can use the in-memory
source directly. The interface is sync so it composes with the existing sync
``PaymentValidator`` flow; an async variant lives in :func:`DrainerLookup.aconsult`.

Example:
    >>> from guardianclaw.integrations.coinbase.x402.drainer_db import (
    ...     DrainerLookup, InMemoryDrainerSource, DrainerKind, DrainerEntry,
    ... )
    >>> source = InMemoryDrainerSource([
    ...     DrainerEntry(
    ...         kind=DrainerKind.ADDRESS,
    ...         value="0xdeadbeef",
    ...         severity="critical",
    ...         source="manual",
    ...     ),
    ... ])
    >>> lookup = DrainerLookup(sources=[source])
    >>> match = lookup.consult(DrainerKind.ADDRESS, "0xDEADBEEF")
    >>> match is not None and match.severity == "critical"
    True
"""

from __future__ import annotations

import logging
import re
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Iterable, Optional

logger = logging.getLogger("guardianclaw.integrations.coinbase.x402.drainer_db")


class DrainerKind(str, Enum):
    """Indicator kind. Mirrors the ``drainer_intel_kind`` Postgres enum."""

    ADDRESS = "address"
    ENDPOINT = "endpoint"
    PATTERN = "pattern"


DrainerSeverity = str  # 'critical' | 'high' | 'medium' | 'low' (mirrors enum)


@dataclass(frozen=True)
class DrainerEntry:
    """A single intel row as returned by a source.

    Mirrors the ``drainer_intel`` row schema in
    ``20260521000000_drainer_intel.sql``. Sources construct these from feed
    payloads; the lookup layer treats them as immutable.
    """

    kind: DrainerKind
    value: str
    severity: DrainerSeverity = "high"
    source: str = "unknown"
    source_ref: Optional[str] = None
    network: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)
    notes: Optional[str] = None
    # Compiled pattern is cached at construction for patterns. None for non-patterns.
    _compiled_pattern: Optional[re.Pattern[str]] = None

    @classmethod
    def pattern(
        cls,
        regex: str,
        *,
        severity: DrainerSeverity = "high",
        source: str = "manual",
        source_ref: Optional[str] = None,
        network: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        notes: Optional[str] = None,
        flags: int = re.IGNORECASE,
    ) -> "DrainerEntry":
        """Build a ``PATTERN`` entry with a pre-compiled regex."""
        try:
            compiled = re.compile(regex, flags)
        except re.error as exc:
            raise ValueError(f"Invalid drainer pattern regex {regex!r}: {exc}") from exc
        return cls(
            kind=DrainerKind.PATTERN,
            value=regex,
            severity=severity,
            source=source,
            source_ref=source_ref,
            network=network,
            metadata=metadata or {},
            notes=notes,
            _compiled_pattern=compiled,
        )


@dataclass(frozen=True)
class DrainerMatch:
    """Outcome of a successful lookup.

    Contains both the matched entry and the matched value/source so the caller
    can produce a deterministic audit log entry like::

        "blocked: kind=address value=0xdead severity=critical source=scamsniffer"
    """

    entry: DrainerEntry
    matched_value: str
    matched_at: float  # epoch seconds, for cache eviction and audit

    @property
    def severity(self) -> DrainerSeverity:
        return self.entry.severity

    @property
    def source(self) -> str:
        return self.entry.source

    def to_audit_dict(self) -> dict[str, Any]:
        """Render for inclusion in a CLAWGateResult.details payload."""
        return {
            "kind": self.entry.kind.value,
            "value": self.matched_value,
            "severity": self.entry.severity,
            "source": self.entry.source,
            "source_ref": self.entry.source_ref,
            "network": self.entry.network,
            "notes": self.entry.notes,
        }


class DrainerSource(ABC):
    """Pluggable backend for drainer intel.

    Implementations must be safe to call from a sync context and must not raise
    on lookup miss — they return ``None`` instead. Errors should be logged and
    swallowed so a transient source outage cannot cause a panic-block of all
    payments.
    """

    @abstractmethod
    def lookup(
        self,
        kind: DrainerKind,
        value: str,
        network: Optional[str] = None,
    ) -> Optional[DrainerEntry]:
        """Return a matching entry, or ``None`` if not found.

        ``value`` is the raw payment-side value (EVM addresses come in as
        already-lowercased; Solana base58 is case-preserving). Implementations
        should normalize internally as needed.
        """

    def iter_patterns(self, network: Optional[str] = None) -> Iterable[DrainerEntry]:
        """Return all active pattern entries (for pattern-scan path).

        Sources that cannot enumerate patterns cheaply may return an empty
        iterable; the caller will simply skip pattern matching for them.
        """
        return ()


class InMemoryDrainerSource(DrainerSource):
    """In-memory source — used in tests and for offline / bootstrap mode.

    Builds two indexes at construction:
        - ``_by_address_endpoint`` keyed by (kind, lower(value), network or '')
        - ``_patterns`` flat list iterated linearly

    For small static blocklists this is a fine production fallback too.
    """

    def __init__(self, entries: Iterable[DrainerEntry]) -> None:
        self._by_address_endpoint: dict[tuple[DrainerKind, str, str], DrainerEntry] = {}
        self._patterns: list[DrainerEntry] = []

        for entry in entries:
            if entry.kind == DrainerKind.PATTERN:
                self._patterns.append(entry)
            else:
                key = (entry.kind, entry.value.lower(), entry.network or "")
                self._by_address_endpoint[key] = entry

    def lookup(
        self,
        kind: DrainerKind,
        value: str,
        network: Optional[str] = None,
    ) -> Optional[DrainerEntry]:
        if kind == DrainerKind.PATTERN:
            # Patterns aren't looked up by exact value — use iter_patterns.
            return None

        normalized = value.lower()
        # Try network-specific first (more specific), then network-agnostic.
        if network:
            hit = self._by_address_endpoint.get((kind, normalized, network))
            if hit is not None:
                return hit
        return self._by_address_endpoint.get((kind, normalized, ""))

    def iter_patterns(self, network: Optional[str] = None) -> Iterable[DrainerEntry]:
        if network is None:
            yield from self._patterns
            return
        for entry in self._patterns:
            if entry.network is None or entry.network == network:
                yield entry


class SupabaseDrainerSource(DrainerSource):
    """Source backed by the ``drainer_intel`` Supabase table.

    Uses Supabase's PostgREST endpoint directly via ``httpx`` — no
    ``supabase-py`` dependency. Requires a service-role or authenticated
    client key with SELECT on ``drainer_intel``.

    Patterns are cached in-process; address/endpoint lookups go through a TTL
    cache layered above the source (see :class:`DrainerLookup`).
    """

    def __init__(
        self,
        *,
        supabase_url: str,
        api_key: str,
        table: str = "drainer_intel",
        timeout_seconds: float = 1.0,
    ) -> None:
        # Import inside __init__ so the SDK can be installed without httpx
        # when the user only consumes in-memory sources.
        try:
            import httpx  # noqa: F401
        except ImportError as exc:
            raise ImportError(
                "SupabaseDrainerSource requires httpx. Install with "
                "`pip install guardianclaw[x402]`."
            ) from exc

        self.supabase_url = supabase_url.rstrip("/")
        self.api_key = api_key
        self.table = table
        self.timeout = timeout_seconds
        self._patterns_cache: Optional[list[DrainerEntry]] = None
        self._patterns_cached_at: float = 0.0
        self._patterns_ttl = 60.0  # Refresh patterns once a minute.

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }

    def _row_to_entry(self, row: dict[str, Any]) -> Optional[DrainerEntry]:
        try:
            kind = DrainerKind(row["kind"])
        except (KeyError, ValueError):
            logger.debug("Skipping drainer_intel row with unknown kind: %r", row)
            return None

        common_kwargs = dict(
            value=row["value"],
            severity=row.get("severity", "high"),
            source=row.get("source", "unknown"),
            source_ref=row.get("source_ref"),
            network=row.get("network"),
            metadata=row.get("metadata") or {},
            notes=row.get("notes"),
        )

        if kind == DrainerKind.PATTERN:
            try:
                return DrainerEntry.pattern(regex=row["value"], **{
                    k: v for k, v in common_kwargs.items() if k != "value"
                })
            except ValueError as exc:
                logger.warning("Invalid pattern in drainer_intel id=%s: %s", row.get("id"), exc)
                return None

        return DrainerEntry(kind=kind, **common_kwargs)

    def lookup(
        self,
        kind: DrainerKind,
        value: str,
        network: Optional[str] = None,
    ) -> Optional[DrainerEntry]:
        if kind == DrainerKind.PATTERN:
            return None
        try:
            import httpx
        except ImportError:
            return None

        normalized = value.lower()
        params: list[tuple[str, str]] = [
            ("kind", f"eq.{kind.value}"),
            ("value_normalized", f"eq.{normalized}"),
            ("active", "eq.true"),
            ("limit", "1"),
            ("select", "id,kind,value,severity,source,source_ref,network,metadata,notes"),
        ]
        if network:
            # Prefer network-specific row, fall back to NULL (any network).
            params.append(("or", f"(network.eq.{network},network.is.null)"))
            params.append(("order", "network.desc.nullslast"))

        try:
            resp = httpx.get(
                f"{self.supabase_url}/rest/v1/{self.table}",
                headers=self._headers(),
                params=params,
                timeout=self.timeout,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("SupabaseDrainerSource lookup failed: %s", exc)
            return None

        data = resp.json()
        if not data:
            return None
        return self._row_to_entry(data[0])

    def iter_patterns(self, network: Optional[str] = None) -> Iterable[DrainerEntry]:
        now = time.monotonic()
        if (
            self._patterns_cache is None
            or now - self._patterns_cached_at > self._patterns_ttl
        ):
            self._refresh_patterns()
        cached = self._patterns_cache or []
        if network is None:
            return cached
        return [
            entry for entry in cached
            if entry.network is None or entry.network == network
        ]

    def _refresh_patterns(self) -> None:
        try:
            import httpx
        except ImportError:
            self._patterns_cache = []
            self._patterns_cached_at = time.monotonic()
            return

        params: list[tuple[str, str]] = [
            ("kind", "eq.pattern"),
            ("active", "eq.true"),
            ("select", "id,kind,value,severity,source,source_ref,network,metadata,notes"),
            ("limit", "1000"),
        ]
        try:
            resp = httpx.get(
                f"{self.supabase_url}/rest/v1/{self.table}",
                headers=self._headers(),
                params=params,
                timeout=self.timeout * 2,  # patterns refresh is rarer; give it more headroom
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("SupabaseDrainerSource pattern refresh failed: %s", exc)
            return  # Keep stale cache rather than wiping.

        entries = [
            entry for entry in (self._row_to_entry(row) for row in resp.json())
            if entry is not None
        ]
        self._patterns_cache = entries
        self._patterns_cached_at = time.monotonic()


class DrainerLookup:
    """Compose one or more sources with a TTL cache.

    The lookup is fail-safe: any unexpected exception from a source is logged
    and treated as miss, so a misbehaving feed cannot panic-block payments.

    Thread-safe for the cache (lock-guarded). Sources themselves are assumed
    to be thread-safe by their own contract.
    """

    def __init__(
        self,
        sources: list[DrainerSource],
        *,
        cache_ttl_seconds: float = 300.0,
        cache_max_entries: int = 10_000,
    ) -> None:
        if not sources:
            raise ValueError("DrainerLookup requires at least one source")
        self.sources = sources
        self.cache_ttl = cache_ttl_seconds
        self.cache_max = cache_max_entries
        self._cache: dict[tuple[DrainerKind, str, str], tuple[Optional[DrainerEntry], float]] = {}
        self._cache_lock = threading.Lock()

    def consult(
        self,
        kind: DrainerKind,
        value: str,
        network: Optional[str] = None,
    ) -> Optional[DrainerMatch]:
        """Look up ``(kind, value, network)``. Returns ``None`` on miss/error."""
        if not value:
            return None

        cache_key = (kind, value.lower(), network or "")
        now = time.monotonic()

        with self._cache_lock:
            cached = self._cache.get(cache_key)
        if cached is not None:
            entry, ts = cached
            if now - ts < self.cache_ttl:
                if entry is None:
                    return None
                return DrainerMatch(entry=entry, matched_value=value, matched_at=time.time())

        # Miss or stale — query sources in order.
        for source in self.sources:
            try:
                entry = source.lookup(kind, value, network=network)
            except Exception as exc:  # pragma: no cover — fail-safe path
                logger.warning(
                    "DrainerSource %s raised on lookup(%s, %s): %s",
                    type(source).__name__, kind.value, value, exc,
                )
                continue
            if entry is not None:
                self._remember(cache_key, entry, now)
                return DrainerMatch(entry=entry, matched_value=value, matched_at=time.time())

        # Negative cache too — avoids hammering Supabase for every miss.
        self._remember(cache_key, None, now)
        return None

    def match_endpoint_patterns(
        self,
        endpoint: str,
        *,
        network: Optional[str] = None,
    ) -> Optional[DrainerMatch]:
        """Scan all pattern entries for a regex hit against ``endpoint``.

        Returns the highest-severity match if any. Pattern entries are
        typically a small set (hundreds at most) so a linear scan is fine.
        """
        if not endpoint:
            return None

        best: Optional[DrainerMatch] = None
        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}

        for source in self.sources:
            try:
                patterns = list(source.iter_patterns(network=network))
            except Exception as exc:  # pragma: no cover — fail-safe path
                logger.warning(
                    "DrainerSource %s raised on iter_patterns: %s",
                    type(source).__name__, exc,
                )
                continue
            for entry in patterns:
                compiled = entry._compiled_pattern
                if compiled is None:
                    # In case a SupabaseDrainerSource row arrived without
                    # the compiled cached (shouldn't happen via _row_to_entry).
                    try:
                        compiled = re.compile(entry.value, re.IGNORECASE)
                    except re.error:
                        continue
                if not compiled.search(endpoint):
                    continue
                candidate = DrainerMatch(
                    entry=entry, matched_value=endpoint, matched_at=time.time(),
                )
                if best is None or (
                    severity_order.get(candidate.severity, 0)
                    > severity_order.get(best.severity, 0)
                ):
                    best = candidate

        return best

    def _remember(
        self,
        key: tuple[DrainerKind, str, str],
        entry: Optional[DrainerEntry],
        now: float,
    ) -> None:
        with self._cache_lock:
            if len(self._cache) >= self.cache_max:
                # Drop oldest by simple FIFO sweep. Not LRU but good enough
                # for the access pattern (most lookups hit warm keys).
                drop_count = max(1, self.cache_max // 10)
                for k in list(self._cache.keys())[:drop_count]:
                    self._cache.pop(k, None)
            self._cache[key] = (entry, now)

    def clear_cache(self) -> None:
        """Reset all cached lookups. Useful for tests and feed-refresh hooks."""
        with self._cache_lock:
            self._cache.clear()


__all__ = [
    "DrainerKind",
    "DrainerSeverity",
    "DrainerEntry",
    "DrainerMatch",
    "DrainerSource",
    "InMemoryDrainerSource",
    "SupabaseDrainerSource",
    "DrainerLookup",
]
