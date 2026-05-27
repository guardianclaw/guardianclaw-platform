"""Ingester for drainer_intel public threat feeds.

Pulls open intel from public sources (currently ScamSniffer), normalizes into
the ``drainer_intel`` schema, and upserts via Supabase REST. Records each run
in ``drainer_intel_sync_log`` so the dashboard can show feed freshness.

Designed to run:
    1. Locally (`py scripts/ingest_drainer_feeds.py --feed scamsniffer`)
    2. Modal scheduled function (see packages/runtime/ingest_drainer_modal.py)
    3. GitHub Action on a cron (see .github/workflows/ingest-drainer.yml)

Environment variables:
    SUPABASE_URL              — required, https://<ref>.supabase.co
    SUPABASE_SERVICE_KEY      — required, service_role key (bypasses RLS)
    DRAINER_FEED_FETCH_TIMEOUT — optional, default 30 (seconds)

Exit code:
    0 — all requested feeds completed
    1 — at least one feed failed (other feeds still attempted)

Honesty notes:
    - This is intelligence ingestion, not validation. Entries from public feeds
      are accepted as-is; we do NOT confirm them on-chain. False positives are
      possible. Severity defaults reflect each feed's curation quality, not our
      own confidence.
    - We deliberately keep ScamSniffer entries marked source='scamsniffer'
      (not 'guardianclaw') so downstream reviewers can audit attribution and
      revoke a class of indicators in bulk if a feed's quality regresses.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from dataclasses import dataclass, field
from typing import Iterable, Iterator

try:
    import httpx
except ImportError:
    sys.exit("scripts/ingest_drainer_feeds.py requires httpx — pip install httpx")

logger = logging.getLogger("ingest_drainer_feeds")


# ============================================================================
# Schema types (small subset, kept independent of the SDK to avoid bootstrap
# coupling — this script may run from a Modal image that doesn't import the
# SDK).
# ============================================================================


@dataclass
class RawEntry:
    """Raw indicator row to be upserted."""

    kind: str  # 'address' | 'endpoint' | 'pattern'
    value: str
    severity: str = "high"
    source: str = "unknown"
    source_ref: str | None = None
    network: str | None = None
    metadata: dict = field(default_factory=dict)
    notes: str | None = None

    def to_supabase_row(self) -> dict:
        row = {
            "kind": self.kind,
            "value": self.value,
            "severity": self.severity,
            "source": self.source,
            "active": True,
            "last_seen_at": "now()",
            "metadata": self.metadata,
        }
        if self.source_ref is not None:
            row["source_ref"] = self.source_ref
        if self.network is not None:
            row["network"] = self.network
        if self.notes is not None:
            row["notes"] = self.notes
        return row


@dataclass
class IngestResult:
    feed: str
    started_at: float
    finished_at: float | None = None
    rows_upserted: int = 0
    rows_skipped: int = 0
    error: str | None = None

    @property
    def duration_seconds(self) -> float | None:
        if self.finished_at is None:
            return None
        return self.finished_at - self.started_at

    @property
    def succeeded(self) -> bool:
        return self.error is None and self.finished_at is not None


# ============================================================================
# Feed adapters
# ============================================================================


class BaseFeed:
    name: str = "base"

    def fetch_entries(self, *, timeout: float) -> Iterator[RawEntry]:
        raise NotImplementedError


class ScamSnifferFeed(BaseFeed):
    """ScamSniffer open-source blacklist (https://github.com/scamsniffer/scam-database).

    Pulls two raw JSONs:
        - blacklist/address.json — array of EVM-style addresses
        - blacklist/domains.json — array of domain strings

    Each list is community-curated; no per-entry severity metadata, so we
    assign 'high' as default. Operators can override severity downstream by
    inserting manual entries for the same value (the unique index dedupes).
    """

    name = "scamsniffer"

    ADDRESS_URL = (
        "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json"
    )
    DOMAIN_URL = (
        "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json"
    )

    def fetch_entries(self, *, timeout: float) -> Iterator[RawEntry]:
        # Addresses are EVM-format (0x...); ScamSniffer covers Ethereum + L2.
        try:
            resp = httpx.get(self.ADDRESS_URL, timeout=timeout)
            resp.raise_for_status()
            addresses = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise RuntimeError(f"scamsniffer addresses fetch failed: {exc}") from exc

        for addr in addresses:
            if not isinstance(addr, str) or not addr:
                continue
            yield RawEntry(
                kind="address",
                # ScamSniffer addresses are EVM — store lower-cased.
                value=addr.lower(),
                severity="high",
                source=self.name,
                source_ref=self.ADDRESS_URL,
                # ScamSniffer addresses span EVM chains; leave network=None
                # so the indicator applies regardless of chain. Operators
                # who want chain-specific lookup can add entries via manual.
                network=None,
            )

        # Domains → 'endpoint' kind; we'll match against the netloc at
        # validation time (CredibilityGateValidator handles parsing).
        try:
            resp = httpx.get(self.DOMAIN_URL, timeout=timeout)
            resp.raise_for_status()
            domains = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise RuntimeError(f"scamsniffer domains fetch failed: {exc}") from exc

        for domain in domains:
            if not isinstance(domain, str) or not domain:
                continue
            yield RawEntry(
                kind="endpoint",
                value=domain.lower().strip(),
                severity="high",
                source=self.name,
                source_ref=self.DOMAIN_URL,
                network=None,
            )


FEED_REGISTRY: dict[str, type[BaseFeed]] = {
    ScamSnifferFeed.name: ScamSnifferFeed,
}


# ============================================================================
# Supabase upsert
# ============================================================================


class SupabaseUpserter:
    def __init__(self, *, url: str, service_key: str, table: str = "drainer_intel"):
        self.url = url.rstrip("/")
        self.service_key = service_key
        self.table = table

    def _headers(self) -> dict:
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            # Upsert semantics — match on the unique index columns.
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }

    def upsert(self, rows: list[dict], *, batch_size: int = 500) -> int:
        if not rows:
            return 0
        total = 0
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            # on_conflict matches the unique index in the migration.
            resp = httpx.post(
                f"{self.url}/rest/v1/{self.table}",
                params={"on_conflict": "kind,value_normalized,network"},
                headers=self._headers(),
                json=batch,
                timeout=60.0,
            )
            resp.raise_for_status()
            total += len(batch)
        return total

    def log_sync(self, result: IngestResult) -> None:
        payload = {
            "source": result.feed,
            "rows_upserted": result.rows_upserted,
            "rows_deactivated": 0,  # TODO Sprint 4: deactivate stale entries
            "error": result.error,
            "finished_at": "now()",
            "metadata": {
                "duration_seconds": result.duration_seconds,
                "rows_skipped": result.rows_skipped,
            },
        }
        resp = httpx.post(
            f"{self.url}/rest/v1/drainer_intel_sync_log",
            headers=self._headers(),
            json=payload,
            timeout=30.0,
        )
        resp.raise_for_status()


# ============================================================================
# Runner
# ============================================================================


def ingest_feed(
    feed: BaseFeed,
    upserter: SupabaseUpserter,
    *,
    fetch_timeout: float,
) -> IngestResult:
    result = IngestResult(feed=feed.name, started_at=time.time())
    rows: list[dict] = []

    try:
        for entry in feed.fetch_entries(timeout=fetch_timeout):
            rows.append(entry.to_supabase_row())
    except Exception as exc:
        result.error = str(exc)
        result.finished_at = time.time()
        logger.error("Feed %s fetch failed: %s", feed.name, exc)
        return result

    try:
        result.rows_upserted = upserter.upsert(rows)
    except Exception as exc:
        result.error = str(exc)
        result.finished_at = time.time()
        logger.error("Feed %s upsert failed: %s", feed.name, exc)
        return result

    result.finished_at = time.time()
    logger.info(
        "Feed %s ingested: %d rows in %.1fs",
        feed.name, result.rows_upserted, result.duration_seconds or 0.0,
    )
    return result


def run(feeds: Iterable[str], *, fetch_timeout: float) -> int:
    """Ingest each requested feed. Returns process exit code."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

    upserter = SupabaseUpserter(url=url, service_key=key)
    exit_code = 0

    for feed_name in feeds:
        feed_cls = FEED_REGISTRY.get(feed_name)
        if feed_cls is None:
            logger.error("Unknown feed: %s (available: %s)",
                         feed_name, ", ".join(FEED_REGISTRY.keys()))
            exit_code = 1
            continue

        result = ingest_feed(feed_cls(), upserter, fetch_timeout=fetch_timeout)

        # Always log the sync attempt — including failures — so the dashboard
        # can flag stalled feeds. Logging failure itself shouldn't take down
        # the whole run.
        try:
            upserter.log_sync(result)
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning("Failed to record sync log for %s: %s", feed_name, exc)

        if not result.succeeded:
            exit_code = 1

    return exit_code


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--feed",
        action="append",
        choices=sorted(FEED_REGISTRY.keys()),
        help="Feed to ingest. Repeat to run multiple. Defaults to all known feeds.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=float(os.environ.get("DRAINER_FEED_FETCH_TIMEOUT", "30")),
        help="HTTP fetch timeout per feed request (seconds).",
    )
    parser.add_argument(
        "--log-level",
        default=os.environ.get("LOG_LEVEL", "INFO"),
        help="Python logging level (DEBUG, INFO, WARNING, ERROR).",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=args.log_level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    feeds = args.feed or list(FEED_REGISTRY.keys())
    return run(feeds, fetch_timeout=args.timeout)


if __name__ == "__main__":
    sys.exit(main())
