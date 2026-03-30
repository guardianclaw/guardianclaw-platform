"""
Node.js Runtime Image Configuration for Modal.

This module defines optimized Modal images for executing Node.js/TypeScript agents,
specifically designed for ElizaOS and VoltAgent frameworks.

Image Variants:
    - nodejs_image: Full runtime with all ElizaOS dependencies
    - nodejs_sandbox_image: Minimal image for code sandbox execution

Design Decisions:
    - Using Node.js 20 LTS for stability and long-term support
    - Pre-installing common ElizaOS dependencies to reduce cold start time
    - Including TypeScript tooling for direct .ts execution
    - Separating full runtime from sandbox for security isolation
"""

import modal

# =============================================================================
# VERSION CONSTANTS
# =============================================================================

NODEJS_VERSION = "20"  # LTS version for stability

# ElizaOS core dependencies that are pre-installed
# These are the most commonly used packages in ElizaOS agents
ELIZAOS_DEPS = [
    "@elizaos/core@^1.0.0",
    "@elizaos/plugin-node@^1.0.0",
    "@guardianclaw/elizaos-plugin@^1.2.0",
]

# Additional common dependencies for social agents
SOCIAL_DEPS = [
    "discord.js@^14.0.0",
    "node-telegram-bot-api@^0.66.0",
    "twitter-api-v2@^1.17.0",
]

# TypeScript tooling
TYPESCRIPT_DEPS = [
    "typescript@^5.3.0",
    "ts-node@^10.9.0",
    "@types/node@^20.0.0",
]

# =============================================================================
# FULL NODE.JS RUNTIME IMAGE
# =============================================================================

# Base Debian image with Node.js from nodesource
_nodejs_base = (
    modal.Image.debian_slim()
    # Install system dependencies
    .apt_install(
        "curl",
        "ca-certificates",
        "gnupg",
        "git",
    )
    # Add NodeSource repository and install Node.js LTS
    .run_commands(
        # Setup NodeSource repository
        "mkdir -p /etc/apt/keyrings",
        "curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg",
        f'echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_{NODEJS_VERSION}.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list',
        "apt-get update",
        f"apt-get install -y nodejs",
        # Verify installation
        "node --version",
        "npm --version",
    )
    # Install global npm packages
    .run_commands(
        # Enable corepack for pnpm
        "corepack enable",
        "corepack prepare pnpm@latest --activate",
        # Install global TypeScript tooling
        "npm install -g typescript ts-node tsx",
    )
)

# Full Node.js image with ElizaOS dependencies pre-installed
nodejs_image = (
    _nodejs_base
    # Create working directory for agent execution
    .run_commands(
        "mkdir -p /app",
        "cd /app && npm init -y",
    )
    # Pre-install ElizaOS dependencies (reduces cold start)
    .run_commands(
        f"cd /app && npm install {' '.join(ELIZAOS_DEPS)}",
        f"cd /app && npm install {' '.join(TYPESCRIPT_DEPS)}",
    )
    # Pre-install social platform SDKs
    .run_commands(
        f"cd /app && npm install {' '.join(SOCIAL_DEPS)}",
    )
    # Install additional common utilities
    .run_commands(
        "cd /app && npm install dotenv zod uuid",
    )
    # Add Python for GuardianClaw SDK validation (hybrid approach)
    .pip_install(
        "guardianclaw>=2.21.0",
        "pydantic>=2.9.0",
        "httpx>=0.25.0",
    )
    # Set working directory
    .workdir("/app")
)


# =============================================================================
# SANDBOX IMAGE FOR CODE EXECUTION
# =============================================================================

# Minimal Node.js image for sandboxed code execution
# This is intentionally minimal for security - no network packages
nodejs_sandbox_image = (
    modal.Image.debian_slim()
    .apt_install(
        "curl",
        "ca-certificates",
        "gnupg",
    )
    .run_commands(
        "mkdir -p /etc/apt/keyrings",
        "curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg",
        f'echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_{NODEJS_VERSION}.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list',
        "apt-get update",
        "apt-get install -y nodejs",
    )
    # Only install safe utility packages
    .run_commands(
        "npm install -g typescript",
        "mkdir -p /sandbox",
    )
    .workdir("/sandbox")
)


# =============================================================================
# IMAGE VERIFICATION
# =============================================================================

def get_nodejs_version_info() -> dict:
    """
    Get version information for the Node.js image.

    Returns:
        Dictionary with version details for verification.
    """
    return {
        "nodejs_version": NODEJS_VERSION,
        "elizaos_deps": ELIZAOS_DEPS,
        "typescript_deps": TYPESCRIPT_DEPS,
        "social_deps": SOCIAL_DEPS,
    }
