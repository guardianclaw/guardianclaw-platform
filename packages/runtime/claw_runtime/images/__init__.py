"""
Modal Image Configurations.

This module provides pre-configured Modal images for different runtimes.
Each image is optimized for specific use cases with pre-installed dependencies.

Available Images:
    - nodejs_image: Optimized for Node.js/TypeScript agents (ElizaOS, VoltAgent)
    - python_image: Standard Python image (defined in main.py)

Usage:
    from claw_runtime.images import nodejs_image

    @app.function(image=nodejs_image, timeout=90)
    def execute_nodejs_agent(...):
        ...
"""

from claw_runtime.images.nodejs import (
    nodejs_image,
    nodejs_sandbox_image,
    NODEJS_VERSION,
    ELIZAOS_DEPS,
)

__all__ = [
    "nodejs_image",
    "nodejs_sandbox_image",
    "NODEJS_VERSION",
    "ELIZAOS_DEPS",
]
