# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-01-04

### Fixed
- Replaced unsafe `exec()` usage in claw_provider.py with direct imports

### Changed
- Test runner in claw_provider.py now uses proper function calls instead of code execution

## [1.0.0] - 2025-12-12

### Added
- Initial release of guardianclaw-promptfoo
- Promptfoo provider with CLAW protocol validation
- Support for all 6 GuardianClaw seeds (v1/v2 × minimal/standard/full)
- Custom red team plugin (claw-plugin.yaml)
- OpenAI and Anthropic provider support
- Validation functions for safety scoring
- 68 test cases covering core functionality

### Security
- CLAW four-gate validation (Credibility, Limits, Avoidance, Worth)
- False positive corrections for common phrases (kill process, bomb slang, fake news negation)
- Null input protection and validation

## Links

- [PyPI package](https://pypi.org/project/guardianclaw-promptfoo/)
- [GitHub](https://github.com/guardian-claw/guardianclaw/tree/main/packages/promptfoo)
- [Promptfoo Documentation](https://promptfoo.dev/docs/)
