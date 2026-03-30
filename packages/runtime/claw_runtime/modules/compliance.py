"""
Compliance Module - Regulatory compliance checks for AI agents.

Uses compliance checkers from guardianclaw SDK to ensure AI operations
comply with regulations like EU AI Act, OWASP LLM Top 10, etc.
"""

import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("claw_runtime.modules.compliance")


class ComplianceViolationError(Exception):
    """Raised when compliance check fails."""

    def __init__(self, framework: str, violations: List[str], severity: str):
        self.framework = framework
        self.violations = violations
        self.severity = severity
        super().__init__(f"Compliance violation ({framework}): {', '.join(violations)}")


class ComplianceModule:
    """
    Validates AI operations against regulatory frameworks.

    Supported frameworks:
    - EU AI Act (Regulation 2024/1689)
    - OWASP LLM Top 10 (2025)
    - OWASP Agentic Top 10 (2026)
    - CSA AI Controls Matrix
    """

    def __init__(self, config: Dict[str, Any] = None, llm_key: str = None):
        """
        Initialize the compliance module.

        Args:
            config: Module configuration
                - frameworks: List of frameworks to check against
                - fail_on_warning: Treat warnings as failures
            llm_key: API key for LLM-based checks
        """
        self.config = config or {}
        self.llm_key = llm_key

        # Which frameworks to enforce
        self.frameworks = self.config.get("frameworks", ["owasp_llm"])
        if isinstance(self.frameworks, str):
            self.frameworks = [self.frameworks]

        self.fail_on_warning = self.config.get("fail_on_warning", False)

        self._checkers = {}
        self._init_checkers()

        logger.info(f"ComplianceModule initialized: frameworks={self.frameworks}")

    def _init_checkers(self):
        """Initialize compliance checkers."""
        try:
            from guardianclaw.compliance import (
                EUAIActComplianceChecker,
                OWASPLLMChecker,
                OWASPAgenticChecker,
            )

            if "eu_ai_act" in self.frameworks:
                self._checkers["eu_ai_act"] = EUAIActComplianceChecker(
                    api_key=self.llm_key
                )

            if "owasp_llm" in self.frameworks:
                self._checkers["owasp_llm"] = OWASPLLMChecker(
                    api_key=self.llm_key
                )

            if "owasp_agentic" in self.frameworks:
                self._checkers["owasp_agentic"] = OWASPAgenticChecker()

        except ImportError:
            logger.warning("guardianclaw compliance module not available")
        except Exception as e:
            logger.error(f"Failed to initialize compliance checkers: {e}")

    def check_input(self, input_text: str) -> Dict[str, Any]:
        """
        Check input for compliance issues.

        Args:
            input_text: User input to check

        Returns:
            Compliance result with findings
        """
        results = {
            "compliant": True,
            "findings": [],
            "frameworks_checked": [],
        }

        for framework, checker in self._checkers.items():
            try:
                if hasattr(checker, "check_input"):
                    check_result = checker.check_input(input_text)
                    results["frameworks_checked"].append(framework)

                    if hasattr(check_result, "findings"):
                        for finding in check_result.findings:
                            results["findings"].append({
                                "framework": framework,
                                "vulnerability": getattr(finding, "vulnerability", str(finding)),
                                "severity": getattr(finding, "severity", "medium"),
                                "description": getattr(finding, "description", ""),
                            })

                    if not getattr(check_result, "compliant", True):
                        results["compliant"] = False
            except Exception as e:
                logger.error(f"Compliance check error ({framework}): {e}")

        # Fallback check if no SDK checkers available
        if not self._checkers:
            results = self._fallback_check(input_text, "input")
            results["frameworks_checked"] = ["fallback"]

        return results

    def check_output(self, output_text: str, input_context: str = "") -> Dict[str, Any]:
        """
        Check output for compliance issues.

        Args:
            output_text: AI output to check
            input_context: Original input for context

        Returns:
            Compliance result with findings
        """
        results = {
            "compliant": True,
            "findings": [],
            "frameworks_checked": [],
        }

        for framework, checker in self._checkers.items():
            try:
                if hasattr(checker, "check_output"):
                    check_result = checker.check_output(output_text)
                    results["frameworks_checked"].append(framework)

                    if hasattr(check_result, "findings"):
                        for finding in check_result.findings:
                            results["findings"].append({
                                "framework": framework,
                                "vulnerability": getattr(finding, "vulnerability", str(finding)),
                                "severity": getattr(finding, "severity", "medium"),
                                "description": getattr(finding, "description", ""),
                            })

                    if not getattr(check_result, "compliant", True):
                        results["compliant"] = False
            except Exception as e:
                logger.error(f"Output compliance check error ({framework}): {e}")

        if not self._checkers:
            results = self._fallback_check(output_text, "output")
            results["frameworks_checked"] = ["fallback"]

        return results

    def process(self, text: str, stage: str = "input") -> str:
        """
        Check compliance and raise error if violations found.

        Args:
            text: Text to check
            stage: "input" or "output"

        Returns:
            The text if compliant

        Raises:
            ComplianceViolationError: If compliance check fails
        """
        if stage == "input":
            result = self.check_input(text)
        else:
            result = self.check_output(text)

        if not result["compliant"]:
            violations = [f["vulnerability"] for f in result["findings"]]
            severity = max((f.get("severity", "medium") for f in result["findings"]), default="medium")
            raise ComplianceViolationError(
                framework=", ".join(result["frameworks_checked"]),
                violations=violations,
                severity=severity,
            )

        return text

    def _fallback_check(self, text: str, stage: str) -> Dict[str, Any]:
        """Fallback compliance check when SDK not available."""
        import re

        findings = []

        # Check for OWASP LLM01: Prompt Injection
        injection_patterns = [
            r"ignore.*instructions",
            r"forget.*previous",
            r"system prompt",
            r"<\|.*\|>",  # Special tokens
        ]

        for pattern in injection_patterns:
            if re.search(pattern, text.lower()):
                findings.append({
                    "framework": "owasp_llm",
                    "vulnerability": "LLM01:PromptInjection",
                    "severity": "high",
                    "description": "Potential prompt injection detected",
                })
                break

        # Check for OWASP LLM06: Sensitive Information Disclosure
        if stage == "output":
            sensitive_patterns = [
                r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",  # Email
                r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",  # Phone
                r"\bsk-[a-zA-Z0-9]{32,}\b",  # API key pattern
            ]

            for pattern in sensitive_patterns:
                if re.search(pattern, text):
                    findings.append({
                        "framework": "owasp_llm",
                        "vulnerability": "LLM06:SensitiveInfoDisclosure",
                        "severity": "high",
                        "description": "Potential sensitive information in output",
                    })
                    break

        return {
            "compliant": len(findings) == 0,
            "findings": findings,
            "frameworks_checked": ["fallback"],
        }

    def get_coverage_report(self) -> Dict[str, Any]:
        """Get compliance coverage report."""
        coverage = {}

        for framework, checker in self._checkers.items():
            if hasattr(checker, "get_coverage_assessment"):
                coverage[framework] = checker.get_coverage_assessment()
            else:
                coverage[framework] = {"status": "active"}

        return {
            "frameworks": self.frameworks,
            "active_checkers": list(self._checkers.keys()),
            "coverage": coverage,
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get module statistics."""
        return {
            "module": "compliance",
            "frameworks": self.frameworks,
            "checkers_available": list(self._checkers.keys()),
            "fail_on_warning": self.fail_on_warning,
        }
