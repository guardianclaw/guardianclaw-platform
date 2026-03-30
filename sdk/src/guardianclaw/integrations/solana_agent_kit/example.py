#!/usr/bin/env python3
"""
GuardianClaw + Solana Agent Kit Integration Examples

Demonstrates safety validation for Solana blockchain transactions.

Run directly:
    python -m guardianclaw.integrations.solana_agent_kit.example

Options:
    --all       Run all examples including edge cases
    --help      Show this help message

Requirements:
    pip install guardianclaw
"""

import sys


def example_validator():
    """Example 1: Using ClawValidator with custom limits."""
    print("\n" + "=" * 60)
    print("Example 1: ClawValidator")
    print("=" * 60)

    from guardianclaw.integrations.solana_agent_kit import (
        ClawValidator,
        AddressValidationMode,
    )

    # Create validator with custom limits
    validator = ClawValidator(
        seed_level="standard",
        max_transfer=50.0,  # Lower limit for demo
        confirm_above=10.0,
        address_validation=AddressValidationMode.WARN,
    )

    print(f"\nConfiguration:")
    print(f"  Max transfer: {validator.max_transfer} SOL")
    print(f"  Confirm above: {validator.confirm_above} SOL")
    print(f"  Address validation: {validator.address_validation.value}")

    # Test 1: Normal transaction
    print("\n--- Test: Normal transfer ---")
    result = validator.check(
        action="transfer",
        amount=5.0,
        recipient="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        worth="Payment for development services",
    )
    print(f"  Safe: {result.should_proceed}")
    print(f"  Risk: {result.risk_level.name}")

    # Test 2: High-value transaction
    print("\n--- Test: High-value transfer ---")
    result = validator.check(
        action="transfer",
        amount=25.0,
        recipient="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        worth="Large payment for quarterly services",
    )
    print(f"  Safe: {result.should_proceed}")
    print(f"  Requires confirmation: {result.requires_confirmation}")

    # Test 3: Exceeds limit
    print("\n--- Test: Exceeds transfer limit ---")
    result = validator.check(
        action="transfer",
        amount=100.0,
        recipient="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    )
    print(f"  Safe: {result.should_proceed}")
    print(f"  Concerns: {result.concerns}")


def example_address_validation():
    """Example 2: Address validation modes."""
    print("\n" + "=" * 60)
    print("Example 2: Address Validation")
    print("=" * 60)

    from guardianclaw.integrations.solana_agent_kit import (
        ClawValidator,
        AddressValidationMode,
        is_valid_solana_address,
    )

    # Valid Solana address
    valid_address = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    invalid_address = "not-a-valid-address"

    print(f"\nAddress validation function:")
    print(f"  '{valid_address[:20]}...' valid: {is_valid_solana_address(valid_address)}")
    print(f"  '{invalid_address}' valid: {is_valid_solana_address(invalid_address)}")

    # STRICT mode - rejects invalid addresses
    print("\n--- STRICT mode ---")
    validator_strict = ClawValidator(
        address_validation=AddressValidationMode.STRICT
    )
    result = validator_strict.check(
        action="transfer",
        amount=1.0,
        recipient=invalid_address,
        worth="Test transfer",
    )
    print(f"  Invalid address blocked: {not result.should_proceed}")
    if result.concerns:
        print(f"  Concern: {result.concerns[0]}")

    # WARN mode - allows but warns
    print("\n--- WARN mode (default) ---")
    validator_warn = ClawValidator(
        address_validation=AddressValidationMode.WARN
    )
    result = validator_warn.check(
        action="transfer",
        amount=1.0,
        recipient=invalid_address,
        worth="Test transfer",
    )
    print(f"  Transaction proceeds: {result.should_proceed}")
    if result.recommendations:
        print(f"  Recommendation: {result.recommendations[0]}")


def example_safe_transaction():
    """Example 3: Using the safe_transaction convenience function."""
    print("\n" + "=" * 60)
    print("Example 3: safe_transaction Function")
    print("=" * 60)

    from guardianclaw.integrations.solana_agent_kit import safe_transaction

    # Quick validation
    print("\n--- Quick validation ---")
    result = safe_transaction(
        "transfer",
        amount=5.0,
        recipient="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        worth="Quick payment",
    )
    print(f"  Result: {'SAFE' if result.should_proceed else 'BLOCKED'}")
    print(f"  Risk level: {result.risk_level.name}")

    # With params dict
    print("\n--- Using params dict ---")
    result = safe_transaction(
        "swap",
        params={
            "amount": 10.0,
            "worth": "Token swap for liquidity",
        }
    )
    print(f"  Result: {'SAFE' if result.should_proceed else 'BLOCKED'}")


def example_worth_gate():
    """Example 4: Worth Gate validation."""
    print("\n" + "=" * 60)
    print("Example 4: Worth Gate")
    print("=" * 60)

    from guardianclaw.integrations.solana_agent_kit import ClawValidator

    validator = ClawValidator()

    # Without worth
    print("\n--- Transfer without purpose ---")
    result = validator.check(
        action="transfer",
        amount=5.0,
        recipient="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    )
    print(f"  Has concerns: {len(result.concerns) > 0}")
    if result.concerns:
        print(f"  Concern: {result.concerns[0][:60]}...")

    # With proper worth
    print("\n--- Transfer with purpose ---")
    result = validator.check(
        action="transfer",
        amount=5.0,
        recipient="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        worth="Monthly payment for hosting services",
    )
    print(f"  Has worth concerns: {'worth' in str(result.concerns).lower()}")
    print(f"  Risk level: {result.risk_level.name}")

    # With brief worth (too short)
    print("\n--- Transfer with brief worth ---")
    result = validator.check(
        action="transfer",
        amount=5.0,
        recipient="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        worth="pay",
    )
    print(f"  Concern about brief worth: {'brief' in str(result.concerns).lower()}")


def example_middleware():
    """Example 5: Using GuardianClawSafetyMiddleware to wrap functions."""
    print("\n" + "=" * 60)
    print("Example 5: Safety Middleware")
    print("=" * 60)

    from guardianclaw.integrations.solana_agent_kit import (
        GuardianClawSafetyMiddleware,
        ClawValidator,
        TransactionBlockedError,
    )

    # Create middleware with custom validator
    validator = ClawValidator(max_transfer=10.0)
    middleware = GuardianClawSafetyMiddleware(validator=validator)

    # Define a transfer function
    def my_transfer(amount: float, recipient: str) -> str:
        return f"Transferred {amount} SOL to {recipient[:16]}..."

    # Wrap with safety validation
    safe_transfer = middleware.wrap(my_transfer, "transfer")

    # Test safe transfer
    print("\n--- Safe transfer (5 SOL) ---")
    try:
        result = safe_transfer(5.0, "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")
        print(f"  Result: {result}")
    except TransactionBlockedError as e:
        print(f"  Blocked: {e}")

    # Test blocked transfer
    print("\n--- Blocked transfer (50 SOL, exceeds limit) ---")
    try:
        result = safe_transfer(50.0, "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")
        print(f"  Result: {result}")
    except TransactionBlockedError as e:
        print(f"  Blocked: {e}")


def example_actions():
    """Example 6: Creating validation actions for workflows."""
    print("\n" + "=" * 60)
    print("Example 6: GuardianClaw Actions")
    print("=" * 60)

    from guardianclaw.integrations.solana_agent_kit import create_claw_actions

    actions = create_claw_actions()

    print("\nAvailable actions:")
    for name in actions.keys():
        print(f"  - {name}")

    # Use validate_transfer
    print("\n--- validate_transfer ---")
    result = actions["validate_transfer"](5.0, "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")
    print(f"  Result: {result}")

    # Use validate_swap
    print("\n--- validate_swap ---")
    result = actions["validate_swap"](10.0, "SOL", "USDC")
    print(f"  Result: {result}")

    # Use validate_action for any action
    print("\n--- validate_action (stake) ---")
    result = actions["validate_action"](
        "stake",
        amount=100.0,
        worth="Staking for validator rewards",
    )
    print(f"  Result: {result}")


def example_statistics():
    """Example 7: Validation statistics."""
    print("\n" + "=" * 60)
    print("Example 7: Statistics")
    print("=" * 60)

    from guardianclaw.integrations.solana_agent_kit import ClawValidator

    validator = ClawValidator(max_transfer=50.0)

    # Run several validations
    test_cases = [
        {"action": "transfer", "amount": 5.0, "worth": "Payment 1"},
        {"action": "transfer", "amount": 10.0, "worth": "Payment 2"},
        {"action": "transfer", "amount": 100.0},  # Exceeds limit
        {"action": "swap", "amount": 25.0, "worth": "Token swap"},
        {"action": "transfer", "amount": 75.0},  # Exceeds limit
    ]

    print("\nRunning test validations...")
    for tc in test_cases:
        result = validator.check(
            action=tc["action"],
            amount=tc["amount"],
            recipient="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
            worth=tc.get("worth", ""),
        )
        status = "SAFE" if result.should_proceed else "BLOCKED"
        print(f"  {tc['action']} {tc['amount']} SOL: {status}")

    # Get statistics
    stats = validator.get_stats()
    print(f"\nStatistics:")
    print(f"  Total validations: {stats['total']}")
    print(f"  Approved: {stats['approved']}")
    print(f"  Blocked: {stats['blocked']}")
    print(f"  Block rate: {stats['block_rate']:.1%}")


def main():
    """Run examples."""
    print("=" * 60)
    print("GuardianClaw + Solana Agent Kit Integration")
    print("=" * 60)
    print("\nDemonstrating safety validation for Solana transactions.")
    print("Documentation: https://github.com/guardian-claw/guardianclaw/tree/main/src/guardianclaw/integrations/solana_agent_kit")

    # Check for help
    if "--help" in sys.argv or "-h" in sys.argv:
        print(__doc__)
        return

    # Run examples
    example_validator()
    example_address_validation()
    example_safe_transaction()
    example_worth_gate()
    example_middleware()
    example_actions()

    # Extended examples
    if "--all" in sys.argv:
        example_statistics()

    print("\n" + "=" * 60)
    print("All examples completed successfully!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
