"""Integration hooks for x402 SDK clients.

This module provides hooks that integrate GuardianClaw validation
with the x402 SDK's httpx and requests clients.

Usage with httpx:
    >>> from guardianclaw.integrations.coinbase.x402 import claw_x402_hooks
    >>> import httpx
    >>>
    >>> client = httpx.AsyncClient()
    >>> client.event_hooks = claw_x402_hooks(account, middleware)
    >>> response = await client.get("https://api.example.com/paid")

Usage with requests:
    >>> from guardianclaw.integrations.coinbase.x402 import claw_x402_adapter
    >>> import requests
    >>>
    >>> session = requests.Session()
    >>> adapter = claw_x402_adapter(account, middleware)
    >>> session.mount("https://", adapter)
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable, TypeVar

from .config import GuardianClawX402Config
from .middleware import (
    PaymentBlockedError,
    PaymentConfirmationRequired,
    PaymentRejectedError,
    GuardianClawX402Middleware,
)
from .types import PaymentDecision, PaymentRequirementsModel

logger = logging.getLogger(__name__)

# Type for eth_account.Account
AccountT = TypeVar("AccountT")


def parse_payment_required_response(
    response_data: dict[str, Any] | str,
) -> list[PaymentRequirementsModel]:
    """Parse x402 payment required response.

    Args:
        response_data: The 402 response body (dict or JSON string)

    Returns:
        List of PaymentRequirementsModel from the "accepts" field
    """
    if isinstance(response_data, str):
        response_data = json.loads(response_data)

    accepts = response_data.get("accepts", [])
    return [PaymentRequirementsModel(**req) for req in accepts]


def select_payment_option(
    options: list[PaymentRequirementsModel],
    middleware: GuardianClawX402Middleware,
    wallet_address: str,
) -> PaymentRequirementsModel | None:
    """Select the safest payment option from available options.

    This function evaluates all payment options through GuardianClaw
    and returns the safest one that passes validation.

    Args:
        options: List of payment options from x402 response
        middleware: The GuardianClaw middleware instance
        wallet_address: The wallet address making the payment

    Returns:
        The selected PaymentRequirementsModel, or None if all blocked
    """
    safe_options: list[tuple[PaymentRequirementsModel, float]] = []

    for option in options:
        try:
            result = middleware.validate_payment(
                endpoint=option.resource,
                payment_requirements=option,
                wallet_address=wallet_address,
            )

            if result.decision in [PaymentDecision.APPROVE, PaymentDecision.REQUIRE_CONFIRMATION]:
                # Calculate a safety score (lower is safer)
                risk_score = {
                    "safe": 0.0,
                    "caution": 0.25,
                    "high": 0.5,
                    "critical": 0.75,
                    "blocked": 1.0,
                }.get(result.risk_level.value, 1.0)

                amount = option.get_amount_float()
                safe_options.append((option, risk_score + (amount / 1000)))

        except (PaymentBlockedError, PaymentRejectedError):
            continue  # Skip blocked options

    if not safe_options:
        return None

    # Return option with lowest combined score
    safe_options.sort(key=lambda x: x[1])
    return safe_options[0][0]


class GuardianClawHttpxHooks:
    """Event hooks for httpx client with GuardianClaw validation.

    This class wraps the x402 SDK hooks to add GuardianClaw validation
    before payments are executed.

    Example:
        >>> hooks = GuardianClawHttpxHooks(account, middleware)
        >>> client = httpx.AsyncClient()
        >>> client.event_hooks = hooks.get_hooks()
    """

    def __init__(
        self,
        account: AccountT,
        middleware: GuardianClawX402Middleware | None = None,
        max_amount: float | None = None,
        auto_confirm: bool = False,
    ) -> None:
        """Initialize hooks.

        Args:
            account: eth_account.Account for signing payments
            middleware: GuardianClaw middleware (creates default if None)
            max_amount: Maximum payment amount to auto-approve
            auto_confirm: If True, auto-confirm payments requiring confirmation
        """
        self.account = account
        self.middleware = middleware or GuardianClawX402Middleware()
        self.max_amount = max_amount
        self.auto_confirm = auto_confirm

        # Try to get wallet address from account
        try:
            self.wallet_address = account.address
        except AttributeError:
            self.wallet_address = "unknown"

        # State for tracking current request
        self._current_endpoint: str | None = None
        self._payment_executed: bool = False

    async def on_request(self, request: Any) -> None:
        """Request hook - tracks the current endpoint.

        Args:
            request: The httpx Request object
        """
        self._current_endpoint = str(request.url)
        self._payment_executed = False

    async def on_response(self, response: Any) -> None:
        """Response hook - validates 402 responses before payment.

        Args:
            response: The httpx Response object

        Raises:
            PaymentBlockedError: If payment is blocked by GuardianClaw
            PaymentRejectedError: If payment is rejected
            PaymentConfirmationRequired: If confirmation needed and auto_confirm=False
        """
        if response.status_code != 402:
            return

        if self._payment_executed:
            return  # Avoid infinite loop

        endpoint = self._current_endpoint or str(response.url)

        try:
            # Parse payment requirements
            content = await response.aread()
            response_data = json.loads(content)

            payment_options = parse_payment_required_response(response_data)

            if not payment_options:
                logger.warning(f"No payment options in 402 response from {endpoint}")
                return

            # Select best option using GuardianClaw
            selected = select_payment_option(
                options=payment_options,
                middleware=self.middleware,
                wallet_address=self.wallet_address,
            )

            if not selected:
                raise PaymentBlockedError(
                    "All payment options blocked by GuardianClaw",
                    result=self.middleware.validate_payment(
                        endpoint=endpoint,
                        payment_requirements=payment_options[0],
                        wallet_address=self.wallet_address,
                    ),
                )

            # Validate selected option
            result = self.middleware.validate_payment(
                endpoint=endpoint,
                payment_requirements=selected,
                wallet_address=self.wallet_address,
            )

            # Check max_amount
            amount = selected.get_amount_float()
            if self.max_amount and amount > self.max_amount:
                raise PaymentRejectedError(
                    f"Amount ${amount:.2f} exceeds max_amount ${self.max_amount:.2f}",
                    result=result,
                )

            # Handle confirmation requirement
            if result.requires_confirmation and not self.auto_confirm:
                raise PaymentConfirmationRequired(
                    f"Payment of ${amount:.2f} requires confirmation",
                    result=result,
                )

            # Payment approved - mark as executed for after_payment_hook
            self._payment_executed = True

            logger.info(
                f"GuardianClaw approved x402 payment: ${amount:.2f} to {endpoint}"
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse 402 response: {e}")
        except (PaymentBlockedError, PaymentRejectedError, PaymentConfirmationRequired):
            raise
        except Exception as e:
            logger.error(f"Error in GuardianClaw x402 hook: {e}")

    def get_hooks(self) -> dict[str, list[Callable]]:
        """Get httpx event hooks dictionary.

        Returns:
            Dictionary with request and response hook lists
        """
        return {
            "request": [self.on_request],
            "response": [self.on_response],
        }


def claw_x402_hooks(
    account: AccountT,
    middleware: GuardianClawX402Middleware | None = None,
    max_amount: float | None = None,
    auto_confirm: bool = False,
) -> dict[str, list[Callable]]:
    """Create httpx event hooks with GuardianClaw validation.

    This is a convenience function that creates and returns
    the hooks dictionary ready for use with httpx.

    Args:
        account: eth_account.Account for signing
        middleware: GuardianClaw middleware (optional)
        max_amount: Maximum amount to auto-approve
        auto_confirm: Auto-confirm payments requiring confirmation

    Returns:
        Dictionary of httpx event hooks

    Example:
        >>> import httpx
        >>> from eth_account import Account
        >>> from guardianclaw.integrations.coinbase.x402 import claw_x402_hooks
        >>>
        >>> account = Account.from_key("0x...")
        >>> async with httpx.AsyncClient() as client:
        ...     client.event_hooks = claw_x402_hooks(account)
        ...     response = await client.get("https://api.example.com/paid")
    """
    hooks = GuardianClawHttpxHooks(
        account=account,
        middleware=middleware,
        max_amount=max_amount,
        auto_confirm=auto_confirm,
    )
    return hooks.get_hooks()


def create_claw_x402_client(
    account: AccountT,
    middleware: GuardianClawX402Middleware | None = None,
    max_amount: float | None = None,
    auto_confirm: bool = False,
    **httpx_kwargs: Any,
) -> Any:
    """Create an httpx AsyncClient with GuardianClaw x402 hooks.

    This is a convenience function that creates a fully configured
    httpx client ready for x402 payments with GuardianClaw validation.

    Args:
        account: eth_account.Account for signing
        middleware: GuardianClaw middleware (optional)
        max_amount: Maximum amount to auto-approve
        auto_confirm: Auto-confirm payments requiring confirmation
        **httpx_kwargs: Additional arguments for httpx.AsyncClient

    Returns:
        Configured httpx.AsyncClient

    Example:
        >>> from guardianclaw.integrations.coinbase.x402 import create_claw_x402_client
        >>>
        >>> async with create_claw_x402_client(account) as client:
        ...     response = await client.get("https://api.example.com/paid")
    """
    try:
        import httpx
    except ImportError:
        raise ImportError("httpx is required. Install with: pip install httpx")

    hooks = claw_x402_hooks(
        account=account,
        middleware=middleware,
        max_amount=max_amount,
        auto_confirm=auto_confirm,
    )

    client = httpx.AsyncClient(**httpx_kwargs)
    client.event_hooks = hooks

    return client


class GuardianClawRequestsAdapter:
    """HTTP adapter for requests library with GuardianClaw validation.

    This adapter wraps requests to add GuardianClaw validation
    for x402 payments.

    Example:
        >>> adapter = GuardianClawRequestsAdapter(account, middleware)
        >>> session = requests.Session()
        >>> session.mount("https://", adapter.get_adapter())
    """

    def __init__(
        self,
        account: AccountT,
        middleware: GuardianClawX402Middleware | None = None,
        max_amount: float | None = None,
        auto_confirm: bool = False,
    ) -> None:
        """Initialize adapter.

        Args:
            account: eth_account.Account for signing
            middleware: GuardianClaw middleware (optional)
            max_amount: Maximum amount to auto-approve
            auto_confirm: Auto-confirm payments
        """
        self.account = account
        self.middleware = middleware or GuardianClawX402Middleware()
        self.max_amount = max_amount
        self.auto_confirm = auto_confirm

        try:
            self.wallet_address = account.address
        except AttributeError:
            self.wallet_address = "unknown"

    def validate_before_payment(
        self,
        url: str,
        response_data: dict[str, Any],
    ) -> PaymentRequirementsModel:
        """Validate payment before execution.

        Args:
            url: The request URL
            response_data: The 402 response data

        Returns:
            Selected PaymentRequirementsModel

        Raises:
            PaymentBlockedError: If blocked
            PaymentRejectedError: If rejected
            PaymentConfirmationRequired: If needs confirmation
        """
        payment_options = parse_payment_required_response(response_data)

        if not payment_options:
            raise ValueError("No payment options in response")

        selected = select_payment_option(
            options=payment_options,
            middleware=self.middleware,
            wallet_address=self.wallet_address,
        )

        if not selected:
            raise PaymentBlockedError(
                "All payment options blocked",
                result=self.middleware.validate_payment(
                    endpoint=url,
                    payment_requirements=payment_options[0],
                    wallet_address=self.wallet_address,
                ),
            )

        result = self.middleware.validate_payment(
            endpoint=url,
            payment_requirements=selected,
            wallet_address=self.wallet_address,
        )

        amount = selected.get_amount_float()
        if self.max_amount and amount > self.max_amount:
            raise PaymentRejectedError(
                f"Amount exceeds limit: ${amount:.2f} > ${self.max_amount:.2f}",
                result=result,
            )

        if result.requires_confirmation and not self.auto_confirm:
            raise PaymentConfirmationRequired(
                f"Payment of ${amount:.2f} requires confirmation",
                result=result,
            )

        return selected


def claw_x402_adapter(
    account: AccountT,
    middleware: GuardianClawX402Middleware | None = None,
    max_amount: float | None = None,
    auto_confirm: bool = False,
) -> GuardianClawRequestsAdapter:
    """Create a requests adapter with GuardianClaw validation.

    Args:
        account: eth_account.Account for signing
        middleware: GuardianClaw middleware (optional)
        max_amount: Maximum amount to auto-approve
        auto_confirm: Auto-confirm payments

    Returns:
        GuardianClawRequestsAdapter instance
    """
    return GuardianClawRequestsAdapter(
        account=account,
        middleware=middleware,
        max_amount=max_amount,
        auto_confirm=auto_confirm,
    )
