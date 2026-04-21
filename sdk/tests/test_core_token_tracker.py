"""Tests for ``guardianclaw.core.token_tracker`` — observability-only token
usage accumulator. Covers ``ComponentUsage``, ``TokenTracker``, the module-level
global helpers, and the OpenAI/Anthropic wrapper functions."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from guardianclaw.core import token_tracker as tt_mod
from guardianclaw.core.token_tracker import (
    ComponentUsage,
    TokenTracker,
    call_anthropic_with_tracking,
    call_openai_with_tracking,
    get_tracker,
    reset_tracker,
    track_central_ai_call,
)


class TestComponentUsage:
    def test_add_accumulates_prompt_completion_total_calls_and_cost(self):
        comp = ComponentUsage(name="x")
        comp.add(prompt=100, completion=50, cost=0.01)
        comp.add(prompt=200, completion=20, cost=0.02)
        assert comp.tokens_prompt == 300
        assert comp.tokens_completion == 70
        assert comp.tokens_total == 370
        assert comp.calls == 2
        assert comp.cost_usd == pytest.approx(0.03)

    def test_to_dict_computes_avg_and_rounds_cost(self):
        comp = ComponentUsage(name="x")
        comp.add(prompt=100, completion=100, cost=0.0000001234567)
        d = comp.to_dict()
        assert d["name"] == "x"
        assert d["tokens_total"] == 200
        assert d["avg_tokens_per_call"] == 200
        assert d["cost_usd"] == round(0.0000001234567, 6)

    def test_to_dict_zero_calls_yields_zero_avg(self):
        comp = ComponentUsage(name="empty")
        d = comp.to_dict()
        assert d["avg_tokens_per_call"] == 0


class TestTokenTrackerTracking:
    def test_track_central_ai_estimates_cost_with_known_model(self):
        t = TokenTracker()
        t.track_central_ai(prompt=500, completion=500, model="gpt-4o-mini")
        comp = t._components["central_ai"]
        # (1000 / 1000) * 0.00015 == 0.00015
        assert comp.cost_usd == pytest.approx(0.00015)
        assert comp.calls == 1

    def test_track_central_ai_unknown_model_uses_default(self):
        t = TokenTracker()
        t.track_central_ai(prompt=1000, completion=0, model="unknown-model")
        # default fallback cost_per_1k is 0.001
        assert t._components["central_ai"].cost_usd == pytest.approx(0.001)

    def test_track_central_ai_explicit_cost_bypasses_estimate(self):
        t = TokenTracker()
        t.track_central_ai(prompt=1, completion=1, model="gpt-4o-mini", cost=0.5)
        assert t._components["central_ai"].cost_usd == pytest.approx(0.5)

    def test_track_l4_claw_records_into_l4_bucket(self):
        t = TokenTracker()
        t.track_l4_claw(prompt=200, completion=100, model="claude-3-haiku")
        assert t._components["l4_claw"].tokens_total == 300
        assert t._components["central_ai"].tokens_total == 0

    def test_track_l4_claw_explicit_cost(self):
        t = TokenTracker()
        t.track_l4_claw(prompt=10, completion=10, cost=0.01)
        assert t._components["l4_claw"].cost_usd == pytest.approx(0.01)

    def test_track_embeddings_l1_stores_tokens_as_prompt_only(self):
        t = TokenTracker()
        t.track_embeddings_l1(tokens=1000, model="text-embedding-3-small")
        comp = t._components["embeddings_l1"]
        assert comp.tokens_prompt == 1000
        assert comp.tokens_completion == 0
        assert comp.cost_usd == pytest.approx((1000 / 1000) * 0.00002)

    def test_track_embeddings_l1_explicit_cost(self):
        t = TokenTracker()
        t.track_embeddings_l1(tokens=500, cost=0.005)
        assert t._components["embeddings_l1"].cost_usd == pytest.approx(0.005)

    def test_track_embeddings_l3_stores_in_l3_bucket(self):
        t = TokenTracker()
        t.track_embeddings_l3(tokens=300, model="text-embedding-3-large")
        assert t._components["embeddings_l3"].tokens_prompt == 300
        assert t._components["embeddings_l1"].tokens_prompt == 0

    def test_track_embeddings_l3_explicit_cost(self):
        t = TokenTracker()
        t.track_embeddings_l3(tokens=100, cost=0.002)
        assert t._components["embeddings_l3"].cost_usd == pytest.approx(0.002)


class TestTokenTrackerStats:
    def test_get_stats_aggregates_across_components(self):
        t = TokenTracker()
        t.track_central_ai(prompt=1000, completion=500, cost=0.01)
        t.track_l4_claw(prompt=200, completion=100, cost=0.001)
        t.track_embeddings_l1(tokens=50, cost=0.0001)
        t.track_embeddings_l3(tokens=50, cost=0.0001)

        stats = t.get_stats()
        total = stats["total"]
        assert total["tokens_prompt"] == 1000 + 200 + 50 + 50
        assert total["tokens_completion"] == 500 + 100
        assert total["tokens_total"] == 1900
        assert total["calls"] == 4
        assert total["cost_usd"] == pytest.approx(0.01 + 0.001 + 0.0001 + 0.0001)
        assert total["elapsed_seconds"] >= 0

        dist = stats["distribution"]
        # distribution percentages should sum to ~100
        total_pct = sum(d["tokens_pct"] for d in dist.values())
        assert total_pct == pytest.approx(100.0, abs=0.5)

    def test_get_stats_empty_state_distribution_is_zeroed(self):
        t = TokenTracker()
        stats = t.get_stats()
        assert stats["total"]["tokens_total"] == 0
        for key in ("central_ai", "l4_claw", "embeddings_l1", "embeddings_l3"):
            assert stats["distribution"][key] == {"tokens_pct": 0, "cost_pct": 0}

    def test_get_stats_zero_cost_distribution_cost_pct_is_zero(self):
        t = TokenTracker()
        # tokens > 0 but cost == 0 → tokens_pct computed, cost_pct falls back to 0
        t.track_central_ai(prompt=100, completion=100, cost=0.0)
        stats = t.get_stats()
        assert stats["distribution"]["central_ai"]["tokens_pct"] > 0
        assert stats["distribution"]["central_ai"]["cost_pct"] == 0

    def test_get_summary_contains_component_breakdown(self):
        t = TokenTracker()
        t.track_central_ai(prompt=1000, completion=500, cost=0.01)
        summary = t.get_summary()
        assert "TOKEN USAGE SUMMARY" in summary
        assert "Central AI (with Seed)" in summary
        assert "BREAKDOWN BY COMPONENT" in summary

    def test_get_summary_empty_has_no_component_rows(self):
        t = TokenTracker()
        summary = t.get_summary()
        assert "TOKEN USAGE SUMMARY" in summary
        # With zero calls, component rows are suppressed
        assert "Central AI (with Seed)" not in summary

    def test_reset_clears_all_counters_and_restarts_timer(self):
        t = TokenTracker()
        t.track_central_ai(prompt=1000, completion=500, cost=0.01)
        t.track_l4_claw(prompt=100, completion=100, cost=0.001)
        old_start = t._start_time
        t.reset()
        for comp in t._components.values():
            assert comp.tokens_total == 0
            assert comp.calls == 0
            assert comp.cost_usd == 0.0
        assert t._start_time >= old_start


class TestGlobalTracker:
    def setup_method(self):
        # Ensure a clean global state between tests
        tt_mod._global_tracker = None

    def teardown_method(self):
        tt_mod._global_tracker = None

    def test_get_tracker_is_singleton(self):
        a = get_tracker()
        b = get_tracker()
        assert a is b

    def test_reset_tracker_is_noop_when_uninitialized(self):
        # Should not raise when global tracker hasn't been created yet
        reset_tracker()
        assert tt_mod._global_tracker is None

    def test_reset_tracker_clears_initialized_global(self):
        tracker = get_tracker()
        tracker.track_central_ai(prompt=100, completion=100, cost=0.01)
        reset_tracker()
        assert tracker.get_stats()["total"]["tokens_total"] == 0

    def test_track_central_ai_call_routes_through_global(self):
        track_central_ai_call(prompt_tokens=100, completion_tokens=50, model="gpt-4o-mini")
        stats = get_tracker().get_stats()
        assert stats["components"]["central_ai"]["tokens_total"] == 150
        assert stats["components"]["central_ai"]["calls"] == 1


class TestOpenAIWrapper:
    def setup_method(self):
        tt_mod._global_tracker = None

    def teardown_method(self):
        tt_mod._global_tracker = None

    def test_wrapper_invokes_create_and_tracks_usage(self):
        usage = SimpleNamespace(prompt_tokens=123, completion_tokens=45)
        fake_response = SimpleNamespace(usage=usage)
        client = MagicMock()
        client.chat.completions.create.return_value = fake_response

        resp = call_openai_with_tracking(
            client, model="gpt-4o-mini", messages=[{"role": "user", "content": "hi"}]
        )

        assert resp is fake_response
        client.chat.completions.create.assert_called_once_with(
            model="gpt-4o-mini", messages=[{"role": "user", "content": "hi"}]
        )
        stats = get_tracker().get_stats()
        assert stats["components"]["central_ai"]["tokens_total"] == 123 + 45

    def test_wrapper_handles_none_usage_fields(self):
        # usage present but fields None → tracked as 0 tokens
        usage = SimpleNamespace(prompt_tokens=None, completion_tokens=None)
        client = MagicMock()
        client.chat.completions.create.return_value = SimpleNamespace(usage=usage)

        call_openai_with_tracking(client, model="gpt-4o-mini", messages=[])
        stats = get_tracker().get_stats()
        assert stats["components"]["central_ai"]["calls"] == 1
        assert stats["components"]["central_ai"]["tokens_total"] == 0

    def test_wrapper_skips_tracking_when_usage_missing(self):
        client = MagicMock()
        client.chat.completions.create.return_value = SimpleNamespace(usage=None)
        call_openai_with_tracking(client, model="gpt-4o-mini", messages=[])
        stats = get_tracker().get_stats()
        assert stats["components"]["central_ai"]["calls"] == 0


class TestAnthropicWrapper:
    def setup_method(self):
        tt_mod._global_tracker = None

    def teardown_method(self):
        tt_mod._global_tracker = None

    def test_wrapper_invokes_create_with_system_and_tracks_usage(self):
        usage = SimpleNamespace(input_tokens=200, output_tokens=80)
        fake_response = SimpleNamespace(usage=usage)
        client = MagicMock()
        client.messages.create.return_value = fake_response

        resp = call_anthropic_with_tracking(
            client,
            model="claude-3-haiku",
            messages=[{"role": "user", "content": "hi"}],
            system="be safe",
            max_tokens=256,
        )

        assert resp is fake_response
        client.messages.create.assert_called_once_with(
            model="claude-3-haiku",
            messages=[{"role": "user", "content": "hi"}],
            system="be safe",
            max_tokens=256,
        )
        stats = get_tracker().get_stats()
        assert stats["components"]["central_ai"]["tokens_total"] == 200 + 80

    def test_wrapper_no_usage_attribute_skips_tracking(self):
        client = MagicMock()
        # No ``usage`` attribute at all
        client.messages.create.return_value = SimpleNamespace()
        call_anthropic_with_tracking(client, model="claude-3-haiku", messages=[])
        stats = get_tracker().get_stats()
        assert stats["components"]["central_ai"]["calls"] == 0

    def test_wrapper_missing_input_output_fields_default_zero(self):
        # ``getattr`` fallback path: usage present but without expected fields
        usage = SimpleNamespace()  # no input_tokens / output_tokens
        client = MagicMock()
        client.messages.create.return_value = SimpleNamespace(usage=usage)
        call_anthropic_with_tracking(client, model="claude-3-haiku", messages=[])
        stats = get_tracker().get_stats()
        assert stats["components"]["central_ai"]["calls"] == 1
        assert stats["components"]["central_ai"]["tokens_total"] == 0
