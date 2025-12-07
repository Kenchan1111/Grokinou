# Scripts Directory

This directory contains utility scripts for development, testing, and maintenance.

## Structure

### `changelog/`
- `gen-auto-changelog.sh` - Generate automatic changelog from git commits

### `integrity/`
- `update-source-hashes.sh` - Update SHA-256 baseline for source integrity tests

### `dev/`
Development and testing scripts:
- `test-models.py` - Test various LLM models
- `test-gpt5-response.ts` - Test GPT-5 specific responses
- `test-timeline-init.ts` - Test timeline initialization

### `security/`
Security and integrity scripts:
- `audit-security-system.sh` - Audit security system
- `update-security-baseline.ts` - Update security baseline

### `database/`
Database and timeline management:
- `checkpoint-databases.mjs` - Create database checkpoints
- `timeline-merkle-check.ts` - Verify Merkle DAG integrity
- `timeline-rewind-test.ts` - Test timeline rewind functionality
- `diagnose-duplication.sh` - Diagnose duplication issues

## Usage

All scripts can be run from the project root:

```bash
# Changelog
scripts/changelog/gen-auto-changelog.sh

# Integrity
scripts/integrity/update-source-hashes.sh

# Development tests
scripts/dev/test-models.py
scripts/dev/test-gpt5-response.ts

# Security
scripts/security/audit-security-system.sh

# Database
scripts/database/checkpoint-databases.mjs
```
