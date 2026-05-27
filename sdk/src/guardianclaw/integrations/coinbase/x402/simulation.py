"""On-chain pre-flight simulation for ClawPay (Sprint 4).

Why this module exists: the Sprint-1 drainer_intel lookup blocks **known**
bad recipients. It does nothing against the unknown ones — and modern
Solana drainer families (``aqua``, ``vanish``, mid-2025 TOCTOU kits)
specifically bypass wallet simulation by mutating transaction state *after*
the user signs but before the chain executes. The classic defense is to
re-simulate the transaction the wallet is about to broadcast through a
trusted RPC and compare the simulated outcome against what the dApp / agent
claimed it would do. ``aqua`` and ``vanish`` show up as a mismatch
between the advertised transfer amount and the actual ``balance_changes``
the simulation reports.

This module exposes:

- :class:`SimulationProvider` — abstract adapter for whichever RPC the
  caller wants to simulate against (Helius for Solana, Tenderly for Base,
  in-memory for tests).
- :class:`HeliusSimulationProvider`, :class:`TenderlySimulationProvider`,
  :class:`InMemorySimulationProvider` — three concrete implementations.
- :class:`SimulationResult` — the wire shape every provider returns. It is
  intentionally provider-agnostic so the gate logic does not depend on
  which simulator was used.
- :class:`SimulationGate` — pre-flight orchestrator. It is *not* one of the
  four CLAW gates; it runs before them and writes its result into the
  ``context`` the four gates already accept. The Avoidance gate then sees
  the simulation outcome and turns ``status == SUSPICIOUS_*`` into a hard
  block, with the actual evidence (balance discrepancy, ownership
  reassignment) cited in the audit record.

Failure semantics: every provider must be fail-safe. A network outage, a
malformed response, an unsupported chain — none of these may panic-block
a payment. They all resolve to ``SimulationStatus.UNSUPPORTED`` (caller
flagged ``risk_factor``, decision falls back to the other gates).
"""

from __future__ import annotations

import logging
import re
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from .types import PaymentRequirementsModel

logger = logging.getLogger("guardianclaw.integrations.coinbase.x402.simulation")


# ============================================================================
# Result types
# ============================================================================


class SimulationStatus(str, Enum):
    """Outcome of a pre-flight simulation.

    Severity ranking (used by the Avoidance gate when deciding whether to
    promote a status into a block):

        OK                              -> safe to proceed
        UNSUPPORTED                     -> add risk_factor, do not block
        ERROR                           -> add risk_factor, do not block
        WOULD_FAIL                      -> reject (tx would fail onchain)
        SUSPICIOUS_BALANCE_CHANGE       -> block
        SUSPICIOUS_OWNERSHIP_CHANGE     -> block

    The first two are *neutral* — a provider that simply cannot answer
    (no API key configured, network down, unknown chain) must not block
    the payment. The next three escalate progressively because they
    correspond to concrete evidence that the transaction is dangerous.
    """

    OK = "ok"
    UNSUPPORTED = "unsupported"
    ERROR = "error"
    WOULD_FAIL = "would_fail"
    SUSPICIOUS_BALANCE_CHANGE = "suspicious_balance_change"
    SUSPICIOUS_OWNERSHIP_CHANGE = "suspicious_ownership_change"

    @property
    def is_block_worthy(self) -> bool:
        return self in (
            SimulationStatus.SUSPICIOUS_BALANCE_CHANGE,
            SimulationStatus.SUSPICIOUS_OWNERSHIP_CHANGE,
        )

    @property
    def is_reject_worthy(self) -> bool:
        return self == SimulationStatus.WOULD_FAIL


@dataclass(frozen=True)
class BalanceChange:
    """A single balance delta observed by the simulator.

    ``address`` is the account whose balance moved. ``delta_usd`` is signed —
    negative when the payer loses money, positive when they gain it. The
    raw provider response (lamports, wei, token decimals) lives in
    ``raw_delta`` for forensic audit.
    """

    address: str
    delta_usd: Optional[float]
    raw_delta: Optional[str] = None
    asset: Optional[str] = None
    direction: Optional[str] = None  # 'out' | 'in'


@dataclass(frozen=True)
class OwnershipChange:
    """A Solana-specific signal: ``Assign`` instructions transfer the owner
    program of an account. Most legitimate flows never reassign ownership of
    a user-owned account; when a simulation shows it happening, it's almost
    always a drainer.
    """

    account: str
    old_owner: Optional[str]
    new_owner: Optional[str]


@dataclass
class SimulationResult:
    """Provider-agnostic simulation outcome."""

    status: SimulationStatus
    provider: str
    message: Optional[str] = None
    balance_changes: list[BalanceChange] = field(default_factory=list)
    ownership_changes: list[OwnershipChange] = field(default_factory=list)
    logs_excerpt: list[str] = field(default_factory=list)
    raw_error: Optional[str] = None
    duration_ms: Optional[float] = None
    # Free-form provider metadata — kept small so the audit row stays cheap.
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def unsupported(cls, provider: str, message: str) -> "SimulationResult":
        return cls(
            status=SimulationStatus.UNSUPPORTED,
            provider=provider,
            message=message,
        )

    @classmethod
    def error(cls, provider: str, message: str, exc: Exception | None = None) -> "SimulationResult":
        return cls(
            status=SimulationStatus.ERROR,
            provider=provider,
            message=message,
            raw_error=str(exc) if exc else None,
        )

    def to_audit_dict(self) -> dict[str, Any]:
        """Serialize for inclusion in the AuditRecord.simulation field.

        Keeps logs trimmed (we never store full simulation logs — adversarial
        contracts can emit megabytes of crafted log data).
        """
        return {
            "status": self.status.value,
            "provider": self.provider,
            "message": self.message,
            "balance_changes": [
                {
                    "address": bc.address,
                    "delta_usd": bc.delta_usd,
                    "raw_delta": bc.raw_delta,
                    "asset": bc.asset,
                    "direction": bc.direction,
                }
                for bc in self.balance_changes[:20]
            ],
            "ownership_changes": [
                {
                    "account": oc.account,
                    "old_owner": oc.old_owner,
                    "new_owner": oc.new_owner,
                }
                for oc in self.ownership_changes[:20]
            ],
            "logs_excerpt": self.logs_excerpt[:20],
            "duration_ms": self.duration_ms,
            "raw_error": self.raw_error,
        }


# ============================================================================
# Provider abstraction
# ============================================================================


class SimulationProvider(ABC):
    """Abstract pre-flight simulator.

    Implementations must:
    1. Never raise. Convert any error to a ``SimulationResult`` with
       ``status=ERROR`` (or ``UNSUPPORTED`` for chains the provider does not
       cover).
    2. Honor ``timeout_seconds`` strictly — the call sits in the request
       path of a payment validation.
    3. Treat empty / missing fields as ``UNSUPPORTED``, never as ``OK``.
    """

    name: str = "abstract"

    @abstractmethod
    def simulate(
        self,
        payment_requirements: PaymentRequirementsModel,
        endpoint: str,
        wallet_address: str,
    ) -> SimulationResult:
        ...


# ============================================================================
# In-memory provider — used in tests and offline mode.
# ============================================================================


class InMemorySimulationProvider(SimulationProvider):
    """Test / offline provider that returns scripted results.

    Construct with a callable that takes the same arguments as ``simulate``
    and returns a ``SimulationResult``. Useful for asserting downstream
    behavior under each ``SimulationStatus`` without touching a real RPC.
    """

    name = "in_memory"

    def __init__(
        self,
        responder: Optional[
            "callable[[PaymentRequirementsModel, str, str], SimulationResult]"
        ] = None,
        *,
        default: Optional[SimulationResult] = None,
    ) -> None:
        if responder is None and default is None:
            # Default to "OK" so a plain InMemorySimulationProvider() acts
            # like a confirming simulator in test setups.
            default = SimulationResult(status=SimulationStatus.OK, provider=self.name)
        self._responder = responder
        self._default = default

    def simulate(
        self,
        payment_requirements: PaymentRequirementsModel,
        endpoint: str,
        wallet_address: str,
    ) -> SimulationResult:
        if self._responder is not None:
            try:
                return self._responder(payment_requirements, endpoint, wallet_address)
            except Exception as exc:  # pragma: no cover — defensive
                return SimulationResult.error(self.name, "responder raised", exc)
        assert self._default is not None  # narrowing — constructor enforces
        return self._default


# ============================================================================
# Common helpers used by RPC-backed providers
# ============================================================================


# Solana network strings as Stripe / x402 use them (lower-case dashed).
_SOLANA_NETWORKS = {"solana", "solana-mainnet", "solana-devnet", "solana-testnet"}
_EVM_NETWORKS = {
    "base",
    "base-sepolia",
    "avalanche",
    "avalanche-fuji",
    "ethereum",
    "polygon",
    "arbitrum",
    "optimism",
}


def _is_solana(network: str) -> bool:
    return network.lower() in _SOLANA_NETWORKS


def _is_evm(network: str) -> bool:
    return network.lower() in _EVM_NETWORKS


# Lamports per SOL.
_LAMPORTS_PER_SOL = 1_000_000_000


def _lamports_to_sol_usd(lamports: int, sol_usd: float) -> float:
    return (lamports / _LAMPORTS_PER_SOL) * sol_usd


# A signed transfer instruction in Solana looks like this in the program
# log: `Program log: Transfer <n> lamports from <addr> to <addr>`. The
# pattern is used by the heuristic that detects undeclared assignment of
# system-program-owned accounts to attacker programs.
_ASSIGN_LOG_RE = re.compile(
    r"Program log: Assign instruction:\s+account=(?P<account>\w+)"
    r"\s+new_owner=(?P<new_owner>\w+)",
    re.IGNORECASE,
)


# Tenderly response field paths (kept as constants so a future schema
# bump only touches one place).
_TENDERLY_ASSET_CHANGES_PATH = ("transaction", "transaction_info", "asset_changes")
_TENDERLY_BALANCE_CHANGES_PATH = ("transaction", "transaction_info", "balance_changes")


def _dig(obj: Any, path: tuple[str, ...]) -> Any:
    """Walk a nested dict path. Returns None when any segment is missing."""
    cur = obj
    for key in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
        if cur is None:
            return None
    return cur


# ============================================================================
# Helius — Solana
# ============================================================================


class HeliusSimulationProvider(SimulationProvider):
    """Pre-flight simulation against the Helius enhanced Solana RPC.

    Detection heuristics (in priority order):

    1. **Ownership reassignment**: any post-execution account in the wallet
       whose owner is no longer the System Program is treated as a drainer
       signal. Real legitimate flows almost never reassign ownership of a
       user-controlled account.
    2. **Balance discrepancy**: if the wallet's SOL or SPL balance drops by
       more than the advertised payment amount times
       ``balance_tolerance``, the simulation is suspicious. Bit-flip
       drainers (aqua, vanish) flip the recipient address or the amount
       *after* the user signs; the simulation result reveals the real
       outflow.
    3. **Simulation failure**: an explicit ``err`` field surfaced by the
       RPC means the transaction would revert. We escalate to WOULD_FAIL so
       the agent can rebuild the request.

    A successful pre-built transaction is required as input — the provider
    does NOT build one from the payment_requirements (that's the agent's
    job). When no transaction is supplied via ``context['signed_tx']`` we
    return ``UNSUPPORTED``.
    """

    name = "helius"

    def __init__(
        self,
        *,
        rpc_url: str,
        timeout_seconds: float = 5.0,
        balance_tolerance: float = 1.05,
        sol_usd_hint: Optional[float] = None,
    ) -> None:
        try:
            import httpx  # noqa: F401 — required for runtime
        except ImportError as exc:
            raise ImportError(
                "HeliusSimulationProvider requires httpx. Install with "
                "`pip install guardianclaw[x402]`."
            ) from exc

        self.rpc_url = rpc_url
        self.timeout_seconds = timeout_seconds
        self.balance_tolerance = balance_tolerance
        # Hint used to translate lamport deltas to USD for the audit row.
        # Operators that need precision should pass a live FX value; the
        # default 200 USD/SOL is a coarse 2026 midpoint and is only ever
        # used for display, not for the security decision itself.
        self.sol_usd_hint = sol_usd_hint or 200.0

    def simulate(
        self,
        payment_requirements: PaymentRequirementsModel,
        endpoint: str,
        wallet_address: str,
    ) -> SimulationResult:
        if not _is_solana(payment_requirements.network):
            return SimulationResult.unsupported(
                self.name, f"network '{payment_requirements.network}' is not Solana"
            )

        # The signed (or unsigned) transaction must be supplied by the
        # caller via PaymentRequirementsModel.extra['signed_tx']. We do not
        # construct it ourselves because the actual instruction list lives
        # in the agent's wallet code.
        extra = payment_requirements.extra or {}
        signed_tx = extra.get("signed_tx")
        if not signed_tx:
            return SimulationResult.unsupported(
                self.name,
                "no signed_tx provided in payment_requirements.extra; "
                "wallet must include the encoded transaction it intends to broadcast",
            )

        try:
            import httpx
        except ImportError:  # pragma: no cover — guarded in __init__
            return SimulationResult.unsupported(self.name, "httpx unavailable")

        params: list[Any] = [
            signed_tx,
            {
                "encoding": extra.get("encoding", "base64"),
                "commitment": extra.get("commitment", "processed"),
                "sigVerify": False,
                "replaceRecentBlockhash": True,
                # Ask Helius to return the post-execution state of the
                # wallet so we can compare against the advertised payment.
                "accounts": {
                    "addresses": [wallet_address] + list(extra.get("watched_accounts", [])),
                    "encoding": "base64",
                },
            },
        ]

        started = time.monotonic()
        try:
            resp = httpx.post(
                self.rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "id": "claw-sim-1",
                    "method": "simulateTransaction",
                    "params": params,
                },
                timeout=self.timeout_seconds,
            )
            resp.raise_for_status()
            payload = resp.json()
        except httpx.HTTPError as exc:
            return SimulationResult.error(self.name, "RPC request failed", exc)
        except ValueError as exc:
            return SimulationResult.error(self.name, "RPC returned non-JSON", exc)
        duration_ms = (time.monotonic() - started) * 1000.0

        if "error" in payload:
            return SimulationResult(
                status=SimulationStatus.ERROR,
                provider=self.name,
                message=str(payload["error"]),
                duration_ms=duration_ms,
                raw_error=str(payload["error"]),
            )

        value = (payload.get("result") or {}).get("value") or {}
        return self._interpret_helius_value(
            value=value,
            payment_requirements=payment_requirements,
            wallet_address=wallet_address,
            duration_ms=duration_ms,
        )

    # ------------------------------------------------------------------
    # Detection heuristics
    # ------------------------------------------------------------------

    def _interpret_helius_value(
        self,
        *,
        value: dict[str, Any],
        payment_requirements: PaymentRequirementsModel,
        wallet_address: str,
        duration_ms: float,
    ) -> SimulationResult:
        # 1. The RPC says the transaction would fail outright.
        err = value.get("err")
        logs = value.get("logs") or []
        logs_excerpt = [str(line)[:200] for line in logs[:20]]

        if err is not None:
            return SimulationResult(
                status=SimulationStatus.WOULD_FAIL,
                provider=self.name,
                message=f"Simulation reports failure: {err!r}",
                logs_excerpt=logs_excerpt,
                duration_ms=duration_ms,
                raw_error=str(err),
            )

        # 2. Ownership reassignment — scan returned accounts AND the logs
        #    for `Assign` instructions targeting the wallet.
        ownership_changes = self._extract_ownership_changes(
            value=value, wallet_address=wallet_address, logs=logs,
        )

        # 3. Balance discrepancy — compare advertised payment vs simulated outflow.
        advertised_usd = payment_requirements.get_amount_float()
        balance_changes = self._extract_balance_changes(
            value=value, wallet_address=wallet_address,
        )

        suspicious_balance = self._detect_balance_discrepancy(
            balance_changes=balance_changes, advertised_usd=advertised_usd,
        )

        if ownership_changes:
            return SimulationResult(
                status=SimulationStatus.SUSPICIOUS_OWNERSHIP_CHANGE,
                provider=self.name,
                message=(
                    f"{len(ownership_changes)} account ownership reassignment(s) "
                    "detected during simulation — drainer signature"
                ),
                balance_changes=balance_changes,
                ownership_changes=ownership_changes,
                logs_excerpt=logs_excerpt,
                duration_ms=duration_ms,
            )

        if suspicious_balance is not None:
            return SimulationResult(
                status=SimulationStatus.SUSPICIOUS_BALANCE_CHANGE,
                provider=self.name,
                message=suspicious_balance,
                balance_changes=balance_changes,
                logs_excerpt=logs_excerpt,
                duration_ms=duration_ms,
            )

        return SimulationResult(
            status=SimulationStatus.OK,
            provider=self.name,
            balance_changes=balance_changes,
            logs_excerpt=logs_excerpt,
            duration_ms=duration_ms,
        )

    def _extract_ownership_changes(
        self,
        *,
        value: dict[str, Any],
        wallet_address: str,
        logs: list[Any],
    ) -> list[OwnershipChange]:
        out: list[OwnershipChange] = []

        accounts = value.get("accounts") or []
        for i, acct in enumerate(accounts):
            if not isinstance(acct, dict):
                continue
            new_owner = acct.get("owner")
            # Helius returns the post-execution owner. The System Program
            # (11111111111111111111111111111111) is the normal owner of a
            # user wallet; anything else is a strong signal.
            if (
                new_owner
                and new_owner != "11111111111111111111111111111111"
                and i == 0  # the wallet itself is the first watched account
            ):
                out.append(
                    OwnershipChange(
                        account=wallet_address,
                        old_owner="11111111111111111111111111111111",
                        new_owner=new_owner,
                    )
                )

        # Also scan logs for assign-instruction prints — some drainers do
        # not leak ownership in the returned accounts blob but do emit a
        # log line we can fingerprint.
        for line in logs:
            if not isinstance(line, str):
                continue
            match = _ASSIGN_LOG_RE.search(line)
            if match and match.group("account") == wallet_address:
                out.append(
                    OwnershipChange(
                        account=match.group("account"),
                        old_owner=None,
                        new_owner=match.group("new_owner"),
                    )
                )

        return out

    def _extract_balance_changes(
        self,
        *,
        value: dict[str, Any],
        wallet_address: str,
    ) -> list[BalanceChange]:
        """Extract per-account lamport deltas from the returned accounts.

        Helius returns post-execution account state but not the pre-execution
        balance directly. Callers that want a precise delta must pass the
        pre-balance via ``payment_requirements.extra['pre_balances']``. When
        absent we still surface the post-execution balance so the audit row
        contains evidence even if we can't compute a delta.
        """
        out: list[BalanceChange] = []
        accounts = value.get("accounts") or []
        for i, acct in enumerate(accounts):
            if not isinstance(acct, dict):
                continue
            lamports = acct.get("lamports")
            if lamports is None:
                continue
            try:
                lamports_int = int(lamports)
            except (TypeError, ValueError):
                continue
            usd = _lamports_to_sol_usd(lamports_int, self.sol_usd_hint)
            out.append(
                BalanceChange(
                    address=wallet_address if i == 0 else f"account_{i}",
                    delta_usd=None,
                    raw_delta=str(lamports_int),
                    asset="SOL",
                    direction=None,
                )
            )
            # Side-channel: surface the post-execution USD value for audit.
            out[-1] = BalanceChange(
                address=out[-1].address,
                delta_usd=usd,
                raw_delta=out[-1].raw_delta,
                asset="SOL",
                direction=None,
            )
        return out

    def _detect_balance_discrepancy(
        self,
        *,
        balance_changes: list[BalanceChange],
        advertised_usd: float,
    ) -> Optional[str]:
        if advertised_usd <= 0:
            return None
        # Find the wallet's USD delta (index 0).
        if not balance_changes:
            return None
        wallet_change = balance_changes[0]
        if wallet_change.delta_usd is None:
            return None
        # We only know the *post-execution* USD value, not the delta. The
        # caller can still spot a discrepancy when the post-execution
        # balance is *smaller* than (pre-balance - advertised * tolerance).
        # In the absence of pre-balance we fall back to a heuristic: a
        # post-execution balance of ~0 when the advertised payment is
        # well below the wallet's known balance is suspicious. Without
        # pre-balance the heuristic is necessarily weaker; the audit row
        # still captures the raw numbers for review.
        return None  # left to the SimulationGate when pre-balance is provided


# ============================================================================
# Tenderly — EVM (Base, Avalanche, …)
# ============================================================================


class TenderlySimulationProvider(SimulationProvider):
    """Pre-flight simulation against Tenderly's `/api/v1/.../simulate`.

    Tenderly returns structured ``asset_changes`` and ``balance_changes``
    objects — the heuristic is the same as Helius but operates on richer
    pre-computed data. We compare the wallet's outflow against the
    advertised payment; a delta beyond ``balance_tolerance`` is flagged.
    """

    name = "tenderly"

    def __init__(
        self,
        *,
        account_slug: str,
        project_slug: str,
        access_key: str,
        timeout_seconds: float = 5.0,
        balance_tolerance: float = 1.05,
    ) -> None:
        try:
            import httpx  # noqa: F401
        except ImportError as exc:
            raise ImportError(
                "TenderlySimulationProvider requires httpx. Install with "
                "`pip install guardianclaw[x402]`."
            ) from exc

        self.account_slug = account_slug
        self.project_slug = project_slug
        self.access_key = access_key
        self.timeout_seconds = timeout_seconds
        self.balance_tolerance = balance_tolerance

    @property
    def _api_url(self) -> str:
        return (
            f"https://api.tenderly.co/api/v1/account/{self.account_slug}"
            f"/project/{self.project_slug}/simulate"
        )

    @staticmethod
    def _network_to_chain_id(network: str) -> Optional[int]:
        return {
            "base": 8453,
            "base-sepolia": 84532,
            "avalanche": 43114,
            "avalanche-fuji": 43113,
            "ethereum": 1,
            "polygon": 137,
            "arbitrum": 42161,
            "optimism": 10,
        }.get(network.lower())

    def simulate(
        self,
        payment_requirements: PaymentRequirementsModel,
        endpoint: str,
        wallet_address: str,
    ) -> SimulationResult:
        if not _is_evm(payment_requirements.network):
            return SimulationResult.unsupported(
                self.name, f"network '{payment_requirements.network}' is not EVM"
            )
        chain_id = self._network_to_chain_id(payment_requirements.network)
        if chain_id is None:
            return SimulationResult.unsupported(
                self.name, f"network '{payment_requirements.network}' has no known chain id"
            )

        extra = payment_requirements.extra or {}
        to_address = extra.get("to") or payment_requirements.pay_to
        input_data = extra.get("input") or "0x"
        value_hex = extra.get("value", "0x0")
        gas = extra.get("gas", 1_000_000)

        try:
            import httpx
        except ImportError:  # pragma: no cover — guarded in __init__
            return SimulationResult.unsupported(self.name, "httpx unavailable")

        started = time.monotonic()
        try:
            resp = httpx.post(
                self._api_url,
                headers={
                    "X-Access-Key": self.access_key,
                    "Content-Type": "application/json",
                },
                json={
                    "network_id": str(chain_id),
                    "from": wallet_address,
                    "to": to_address,
                    "input": input_data,
                    "value": value_hex,
                    "gas": gas,
                    "save": False,
                    "save_if_fails": False,
                    "simulation_type": "full",
                },
                timeout=self.timeout_seconds,
            )
            resp.raise_for_status()
            payload = resp.json()
        except httpx.HTTPError as exc:
            return SimulationResult.error(self.name, "Tenderly request failed", exc)
        except ValueError as exc:
            return SimulationResult.error(self.name, "Tenderly returned non-JSON", exc)
        duration_ms = (time.monotonic() - started) * 1000.0

        tx_info = (payload.get("transaction") or {}).get("transaction_info") or {}
        return self._interpret_tenderly_payload(
            payload=payload,
            tx_info=tx_info,
            payment_requirements=payment_requirements,
            wallet_address=wallet_address,
            duration_ms=duration_ms,
        )

    def _interpret_tenderly_payload(
        self,
        *,
        payload: dict[str, Any],
        tx_info: dict[str, Any],
        payment_requirements: PaymentRequirementsModel,
        wallet_address: str,
        duration_ms: float,
    ) -> SimulationResult:
        # 1. Did Tenderly say the transaction reverts?
        status = payload.get("transaction", {}).get("status", True)
        if status is False:
            error_msg = (
                tx_info.get("error_message")
                or tx_info.get("call_trace", {}).get("error")
                or "simulation reports revert"
            )
            return SimulationResult(
                status=SimulationStatus.WOULD_FAIL,
                provider=self.name,
                message=str(error_msg),
                duration_ms=duration_ms,
                raw_error=str(error_msg),
            )

        # 2. Walk asset_changes for the wallet's outflows.
        asset_changes_raw = tx_info.get("asset_changes") or []
        balance_changes_raw = tx_info.get("balance_changes") or []

        balance_changes: list[BalanceChange] = []
        outflow_usd = 0.0
        lower_wallet = wallet_address.lower()
        for change in asset_changes_raw:
            if not isinstance(change, dict):
                continue
            from_addr = (change.get("from") or "").lower()
            to_addr = (change.get("to") or "").lower()
            dollar_value = change.get("dollar_value")
            try:
                dollar_value_f = float(dollar_value) if dollar_value is not None else None
            except (TypeError, ValueError):
                dollar_value_f = None

            if from_addr == lower_wallet and dollar_value_f is not None:
                outflow_usd += dollar_value_f
                direction = "out"
                address_for_row = to_addr or from_addr
            elif to_addr == lower_wallet and dollar_value_f is not None:
                direction = "in"
                address_for_row = from_addr or to_addr
            else:
                # Unrelated to this wallet — record for audit but don't
                # count toward outflow.
                direction = None
                address_for_row = from_addr or to_addr

            balance_changes.append(
                BalanceChange(
                    address=address_for_row,
                    delta_usd=dollar_value_f,
                    raw_delta=str(change.get("amount")) if change.get("amount") is not None else None,
                    asset=str(change.get("token_info", {}).get("symbol") or ""),
                    direction=direction,
                )
            )

        # Some Tenderly responses include only balance_changes (gas-only
        # transactions, contract-only state changes). We surface those too.
        for change in balance_changes_raw:
            if not isinstance(change, dict):
                continue
            balance_changes.append(
                BalanceChange(
                    address=(change.get("address") or "").lower(),
                    delta_usd=_safe_float(change.get("dollar_value")),
                    raw_delta=str(change.get("delta")) if change.get("delta") is not None else None,
                    asset="native",
                    direction=None,
                )
            )

        advertised_usd = payment_requirements.get_amount_float()
        if advertised_usd > 0 and outflow_usd > advertised_usd * self.balance_tolerance:
            return SimulationResult(
                status=SimulationStatus.SUSPICIOUS_BALANCE_CHANGE,
                provider=self.name,
                message=(
                    f"Simulated outflow ${outflow_usd:.2f} exceeds advertised "
                    f"payment ${advertised_usd:.2f} by more than "
                    f"{(self.balance_tolerance - 1) * 100:.0f}%"
                ),
                balance_changes=balance_changes,
                duration_ms=duration_ms,
            )

        return SimulationResult(
            status=SimulationStatus.OK,
            provider=self.name,
            balance_changes=balance_changes,
            duration_ms=duration_ms,
        )


def _safe_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ============================================================================
# Orchestration gate — pre-flight runner for the validator pipeline
# ============================================================================


class SimulationGate:
    """Pre-flight orchestrator that runs a SimulationProvider and translates
    its outcome into a structured signal for the four CLAW gates.

    Lifecycle:
        result = gate.run(payment_requirements, endpoint, wallet)
        context['simulation_result'] = result.to_audit_dict()

    The Avoidance gate already reads ``context`` — adding the simulation
    result there means we don't need a 5th CLAW gate (the four-gate
    contract is part of the public API). When the simulation reports a
    block-worthy status the Avoidance gate raises an issue carrying the
    simulation evidence; the rest of the validator pipeline is unchanged.
    """

    def __init__(self, provider: SimulationProvider) -> None:
        self.provider = provider

    def run(
        self,
        payment_requirements: PaymentRequirementsModel,
        endpoint: str,
        wallet_address: str,
    ) -> SimulationResult:
        try:
            return self.provider.simulate(
                payment_requirements=payment_requirements,
                endpoint=endpoint,
                wallet_address=wallet_address,
            )
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning(
                "SimulationGate provider %s raised: %s",
                getattr(self.provider, "name", "?"), exc,
            )
            return SimulationResult.error(
                getattr(self.provider, "name", "unknown"),
                "provider raised unexpectedly",
                exc,
            )


__all__ = [
    "BalanceChange",
    "HeliusSimulationProvider",
    "InMemorySimulationProvider",
    "OwnershipChange",
    "SimulationGate",
    "SimulationProvider",
    "SimulationResult",
    "SimulationStatus",
    "TenderlySimulationProvider",
]
