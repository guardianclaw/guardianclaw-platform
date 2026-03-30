"""
Security Modules - Pluggable security features for agent execution.

Each module wraps a component from the guardianclaw SDK and provides
a consistent interface for the runtime executor.

Available modules:
- InputValidatorModule: Validates user input before LLM
- OutputValidatorModule: Validates LLM output before response
- MemoryShieldModule: HMAC-based memory integrity protection
- FiduciaryModule: Duty of care validation
- ComplianceModule: Regulatory compliance checks
"""

from claw_runtime.modules.input_validator import InputValidatorModule
from claw_runtime.modules.output_validator import OutputValidatorModule
from claw_runtime.modules.memory_shield import MemoryShieldModule
from claw_runtime.modules.fiduciary import FiduciaryModule
from claw_runtime.modules.compliance import ComplianceModule

__all__ = [
    "InputValidatorModule",
    "OutputValidatorModule",
    "MemoryShieldModule",
    "FiduciaryModule",
    "ComplianceModule",
]


def create_module(module_id: str, config: dict = None, llm_key: str = None):
    """
    Factory function to create a security module.

    Args:
        module_id: Module identifier (input_validator, output_validator, etc.)
        config: Module configuration
        llm_key: API key for LLM-based modules

    Returns:
        Module instance
    """
    modules = {
        "input_validator": InputValidatorModule,
        "output_validator": OutputValidatorModule,
        "memory_shield": MemoryShieldModule,
        "fiduciary": FiduciaryModule,
        "compliance": ComplianceModule,
    }

    module_class = modules.get(module_id)
    if not module_class:
        raise ValueError(f"Unknown module: {module_id}")

    return module_class(config=config or {}, llm_key=llm_key)
