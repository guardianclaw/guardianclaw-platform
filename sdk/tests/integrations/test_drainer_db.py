"""Tests for the drainer_db lookup layer.

Covers the in-memory source (default for tests and offline mode), the
DrainerLookup cache + composition, and the SupabaseDrainerSource via mocked
httpx.

Run with: pytest tests/integrations/test_drainer_db.py -v
"""

import re
from unittest.mock import MagicMock, patch

import pytest

from guardianclaw.integrations.coinbase.x402.drainer_db import (
    DrainerEntry,
    DrainerKind,
    DrainerLookup,
    DrainerMatch,
    DrainerSource,
    InMemoryDrainerSource,
    SupabaseDrainerSource,
)


# ============================================================================
# DrainerEntry
# ============================================================================


class TestDrainerEntry:
    def test_pattern_compiles_regex(self):
        entry = DrainerEntry.pattern(r"phish-[a-z]+\.com")
        assert entry.kind == DrainerKind.PATTERN
        assert entry._compiled_pattern is not None
        assert entry._compiled_pattern.search("phish-evil.com") is not None

    def test_pattern_invalid_regex_raises(self):
        with pytest.raises(ValueError, match="Invalid drainer pattern"):
            DrainerEntry.pattern(r"[unclosed")

    def test_pattern_carries_metadata(self):
        entry = DrainerEntry.pattern(
            r"drain", severity="critical", source="scamsniffer",
            source_ref="ref-123", network="base",
            metadata={"family": "aqua"},
        )
        assert entry.severity == "critical"
        assert entry.source == "scamsniffer"
        assert entry.source_ref == "ref-123"
        assert entry.network == "base"
        assert entry.metadata == {"family": "aqua"}

    def test_default_severity_is_high(self):
        entry = DrainerEntry(kind=DrainerKind.ADDRESS, value="0xdead")
        assert entry.severity == "high"


# ============================================================================
# InMemoryDrainerSource
# ============================================================================


class TestInMemoryDrainerSource:
    def test_exact_address_hit(self):
        source = InMemoryDrainerSource([
            DrainerEntry(
                kind=DrainerKind.ADDRESS,
                value="0xdeadbeef",
                severity="critical",
                source="manual",
            ),
        ])
        hit = source.lookup(DrainerKind.ADDRESS, "0xdeadbeef")
        assert hit is not None
        assert hit.severity == "critical"

    def test_case_insensitive_address(self):
        source = InMemoryDrainerSource([
            DrainerEntry(kind=DrainerKind.ADDRESS, value="0xDeadBeef"),
        ])
        # Query with different case — should still hit.
        hit = source.lookup(DrainerKind.ADDRESS, "0xDEADBEEF")
        assert hit is not None

    def test_miss_returns_none(self):
        source = InMemoryDrainerSource([])
        assert source.lookup(DrainerKind.ADDRESS, "0xunknown") is None

    def test_network_specific_takes_priority(self):
        base_specific = DrainerEntry(
            kind=DrainerKind.ADDRESS,
            value="0xabc",
            severity="critical",
            network="base",
        )
        all_networks = DrainerEntry(
            kind=DrainerKind.ADDRESS,
            value="0xabc",
            severity="medium",
            network=None,
        )
        source = InMemoryDrainerSource([all_networks, base_specific])

        # Query without network — falls back to network-agnostic.
        general_hit = source.lookup(DrainerKind.ADDRESS, "0xabc")
        assert general_hit is not None
        assert general_hit.severity == "medium"

        # Query with network=base — prefers network-specific.
        base_hit = source.lookup(DrainerKind.ADDRESS, "0xabc", network="base")
        assert base_hit is not None
        assert base_hit.severity == "critical"

    def test_pattern_not_returned_by_lookup(self):
        source = InMemoryDrainerSource([
            DrainerEntry.pattern(r"phish"),
        ])
        # Patterns require iter_patterns; lookup by exact value should miss.
        assert source.lookup(DrainerKind.PATTERN, "phish") is None

    def test_iter_patterns_filters_by_network(self):
        source = InMemoryDrainerSource([
            DrainerEntry.pattern(r"phish-all", network=None),
            DrainerEntry.pattern(r"phish-base", network="base"),
            DrainerEntry.pattern(r"phish-sol", network="solana-mainnet"),
        ])
        # No network filter → all patterns.
        all_patterns = list(source.iter_patterns())
        assert len(all_patterns) == 3

        # Filter to base → only the network-agnostic + base ones.
        base_patterns = list(source.iter_patterns(network="base"))
        assert len(base_patterns) == 2
        assert all(
            p.network is None or p.network == "base" for p in base_patterns
        )


# ============================================================================
# DrainerLookup
# ============================================================================


class TestDrainerLookup:
    def test_requires_at_least_one_source(self):
        with pytest.raises(ValueError, match="at least one source"):
            DrainerLookup(sources=[])

    def test_hit_returns_match(self):
        source = InMemoryDrainerSource([
            DrainerEntry(kind=DrainerKind.ADDRESS, value="0xbad", severity="critical"),
        ])
        lookup = DrainerLookup(sources=[source])
        match = lookup.consult(DrainerKind.ADDRESS, "0xbad")
        assert isinstance(match, DrainerMatch)
        assert match.severity == "critical"
        assert match.matched_value == "0xbad"

    def test_miss_returns_none(self):
        source = InMemoryDrainerSource([])
        lookup = DrainerLookup(sources=[source])
        assert lookup.consult(DrainerKind.ADDRESS, "0xnothing") is None

    def test_empty_value_returns_none(self):
        source = InMemoryDrainerSource([
            DrainerEntry(kind=DrainerKind.ADDRESS, value=""),
        ])
        lookup = DrainerLookup(sources=[source])
        assert lookup.consult(DrainerKind.ADDRESS, "") is None

    def test_source_exception_swallowed_as_miss(self):
        """Fail-safe: a misbehaving source must not crash payment validation."""
        broken = MagicMock(spec=DrainerSource)
        broken.lookup.side_effect = RuntimeError("DB down")
        broken.iter_patterns.return_value = []

        backup = InMemoryDrainerSource([
            DrainerEntry(kind=DrainerKind.ADDRESS, value="0xbad"),
        ])
        lookup = DrainerLookup(sources=[broken, backup])

        # Broken source raises, lookup continues to backup, finds the entry.
        match = lookup.consult(DrainerKind.ADDRESS, "0xbad")
        assert match is not None

    def test_cache_hit_avoids_second_source_call(self):
        source = MagicMock(spec=DrainerSource)
        entry = DrainerEntry(kind=DrainerKind.ADDRESS, value="0xbad")
        source.lookup.return_value = entry
        source.iter_patterns.return_value = []

        lookup = DrainerLookup(sources=[source])
        # First call hits source.
        m1 = lookup.consult(DrainerKind.ADDRESS, "0xbad")
        # Second call should be served from cache.
        m2 = lookup.consult(DrainerKind.ADDRESS, "0xbad")
        assert m1 is not None
        assert m2 is not None
        assert source.lookup.call_count == 1

    def test_cache_negative_hits_also_cached(self):
        source = MagicMock(spec=DrainerSource)
        source.lookup.return_value = None
        source.iter_patterns.return_value = []

        lookup = DrainerLookup(sources=[source])
        lookup.consult(DrainerKind.ADDRESS, "0xunknown")
        lookup.consult(DrainerKind.ADDRESS, "0xunknown")
        # Negative result cached; source only consulted once.
        assert source.lookup.call_count == 1

    def test_clear_cache(self):
        source = MagicMock(spec=DrainerSource)
        source.lookup.return_value = DrainerEntry(
            kind=DrainerKind.ADDRESS, value="0xbad",
        )
        source.iter_patterns.return_value = []

        lookup = DrainerLookup(sources=[source])
        lookup.consult(DrainerKind.ADDRESS, "0xbad")
        lookup.clear_cache()
        lookup.consult(DrainerKind.ADDRESS, "0xbad")
        assert source.lookup.call_count == 2

    def test_match_endpoint_patterns_finds_hit(self):
        source = InMemoryDrainerSource([
            DrainerEntry.pattern(r"phish-\w+\.com", severity="critical"),
            DrainerEntry.pattern(r"legit\.com", severity="low"),
        ])
        lookup = DrainerLookup(sources=[source])
        match = lookup.match_endpoint_patterns("https://phish-evil.com/api")
        assert match is not None
        assert match.severity == "critical"

    def test_match_endpoint_patterns_picks_highest_severity(self):
        # Endpoint that matches two patterns of different severity.
        source = InMemoryDrainerSource([
            DrainerEntry.pattern(r"\.com", severity="low"),
            DrainerEntry.pattern(r"phish", severity="critical"),
        ])
        lookup = DrainerLookup(sources=[source])
        match = lookup.match_endpoint_patterns("https://phish.com/api")
        assert match is not None
        assert match.severity == "critical"

    def test_match_endpoint_patterns_miss(self):
        source = InMemoryDrainerSource([
            DrainerEntry.pattern(r"phish"),
        ])
        lookup = DrainerLookup(sources=[source])
        match = lookup.match_endpoint_patterns("https://safe.example.com")
        assert match is None


# ============================================================================
# SupabaseDrainerSource (with mocked httpx)
# ============================================================================


class TestSupabaseDrainerSource:
    @pytest.fixture
    def source(self):
        return SupabaseDrainerSource(
            supabase_url="https://example.supabase.co",
            api_key="test-key",
        )

    def test_lookup_hit(self, source):
        fake_resp = MagicMock()
        fake_resp.json.return_value = [
            {
                "id": "abc",
                "kind": "address",
                "value": "0xbad",
                "severity": "critical",
                "source": "scamsniffer",
                "source_ref": "https://scamsniffer.io/abc",
                "network": "base",
                "metadata": {},
                "notes": None,
            }
        ]
        fake_resp.raise_for_status.return_value = None

        with patch("httpx.get", return_value=fake_resp) as mock_get:
            entry = source.lookup(DrainerKind.ADDRESS, "0xBAD", network="base")
            assert entry is not None
            assert entry.severity == "critical"
            assert entry.source == "scamsniffer"
            assert mock_get.called

    def test_lookup_miss(self, source):
        fake_resp = MagicMock()
        fake_resp.json.return_value = []
        fake_resp.raise_for_status.return_value = None

        with patch("httpx.get", return_value=fake_resp):
            entry = source.lookup(DrainerKind.ADDRESS, "0xunknown")
            assert entry is None

    def test_lookup_http_error_returns_none(self, source):
        """Network failure must not raise — return None and let lookup move on."""
        import httpx
        with patch(
            "httpx.get",
            side_effect=httpx.RequestError("timeout", request=MagicMock()),
        ):
            entry = source.lookup(DrainerKind.ADDRESS, "0xanything")
            assert entry is None

    def test_pattern_lookup_short_circuits(self, source):
        """SupabaseDrainerSource.lookup(PATTERN, ...) returns None without HTTP."""
        with patch("httpx.get") as mock_get:
            entry = source.lookup(DrainerKind.PATTERN, r"phish")
            assert entry is None
            mock_get.assert_not_called()

    def test_iter_patterns_caches(self, source):
        fake_resp = MagicMock()
        fake_resp.json.return_value = [
            {
                "id": "p1",
                "kind": "pattern",
                "value": r"phish-\w+",
                "severity": "high",
                "source": "manual",
                "source_ref": None,
                "network": None,
                "metadata": {},
                "notes": None,
            }
        ]
        fake_resp.raise_for_status.return_value = None

        with patch("httpx.get", return_value=fake_resp) as mock_get:
            first = list(source.iter_patterns())
            second = list(source.iter_patterns())
            assert len(first) == 1
            assert len(second) == 1
            # Pattern cache prevents a second HTTP call within TTL.
            assert mock_get.call_count == 1

    def test_iter_patterns_skips_invalid_regex(self, source):
        fake_resp = MagicMock()
        fake_resp.json.return_value = [
            {
                "id": "bad-regex",
                "kind": "pattern",
                "value": r"[unclosed",
                "severity": "high",
                "source": "manual",
                "source_ref": None,
                "network": None,
                "metadata": {},
                "notes": None,
            },
            {
                "id": "good-regex",
                "kind": "pattern",
                "value": r"phish",
                "severity": "high",
                "source": "manual",
                "source_ref": None,
                "network": None,
                "metadata": {},
                "notes": None,
            },
        ]
        fake_resp.raise_for_status.return_value = None

        with patch("httpx.get", return_value=fake_resp):
            patterns = list(source.iter_patterns())
            assert len(patterns) == 1
            assert patterns[0].value == "phish"


# ============================================================================
# DrainerMatch
# ============================================================================


class TestDrainerMatch:
    def test_to_audit_dict(self):
        entry = DrainerEntry(
            kind=DrainerKind.ADDRESS,
            value="0xbad",
            severity="critical",
            source="manual",
            source_ref="https://example.com/abc",
            network="base",
            notes="known scammer",
        )
        match = DrainerMatch(entry=entry, matched_value="0xBAD", matched_at=12345.0)
        audit = match.to_audit_dict()
        assert audit["kind"] == "address"
        assert audit["value"] == "0xBAD"  # Preserves caller's casing for audit log.
        assert audit["severity"] == "critical"
        assert audit["source"] == "manual"
        assert audit["source_ref"] == "https://example.com/abc"
        assert audit["network"] == "base"
        assert audit["notes"] == "known scammer"
