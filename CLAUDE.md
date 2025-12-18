# Claude Code Guidelines for ChatToMap Core Library

## Project Overview

ChatToMap core library is a **pure TypeScript library** that transforms chat exports into geocoded activity suggestions. It provides shared logic for both the open-source CLI and the commercial SaaS.

**License:** AGPL-3.0
**Runtime:** Bun (strict requirement)

### Architecture Principle

**Pure functions only. No IO, no progress reporting, no orchestration.**

The library is stateless and side-effect-free (except for API calls to external services). Orchestration (parallelization, progress, rate limiting) is the coordinator's responsibility:
- **CLI** - Spawns its own parallel workers locally
- **Cloudflare Workers** - ARE the parallelization units in the SaaS

## Key Files

| File | Purpose |
|------|---------|
| `src/types.ts` | All TypeScript type definitions |
| `src/index.ts` | Public API exports |
| `src/cli.ts` | CLI entry point (orchestrator) |
| `src/parser/` | WhatsApp export parsing |
| `src/extractor/` | Regex/URL candidate extraction |
| `src/embeddings/` | OpenAI embeddings + semantic search |
| `src/classifier/` | AI classification (Claude/OpenAI) |
| `src/geocoder/` | Google Maps geocoding |
| `src/export/` | CSV, Excel, JSON, Map, PDF generation |

## Python Prototype Reference

The Python prototype in `src/*.py` serves as the reference implementation:

| Python File | What to Learn |
|-------------|---------------|
| `src/parser.py` | WhatsApp export format patterns |
| `src/suggestion_extractor.py` | Regex patterns that work |
| `src/embeddings.py` | Semantic search approach |
| `src/classifier.py` | Claude prompt structure |
| `src/geocoder.py` | Geocoding approach |
| `src/export.py` | Leaflet.js map generation |

**Goal:** TypeScript version should produce identical results for the same input.

## Quality Standards

### Non-Negotiable Rules

| Rule | Limit |
|------|-------|
| File length (code) | 500 lines max |
| File length (tests) | 1000 lines max |
| Function length | 50 lines max |
| Line length | 100 chars max |
| Cognitive complexity | 15 max |
| Code duplication | Zero tolerance |
| `any` types | Forbidden |
| `biome-ignore` | Forbidden |
| `--no-verify` | Forbidden |
| **Test coverage** | **90%+ statements, 80%+ branches** |

### Before Marking ANY Task Complete

```bash
task ci
```

This runs: typecheck, lint, check-ignores, duplication, file-length, test.
**Must pass completely.**

## Commands

```bash
# Development
task dev              # Run CLI in watch mode
task build            # Build library and CLI
task build:binary     # Build standalone binary

# Quality
task ci               # Run ALL CI checks
task lint             # Check linting
task lint:fix         # Auto-fix linting
task typecheck        # TypeScript checking
task duplication      # Check for duplication
task file-length      # Check file lengths
task check-ignores    # Verify no biome-ignore

# Testing
task test             # Run tests
task test:watch       # Run tests in watch mode
task test:cov         # Run tests with coverage

# Git hooks
task hooks:install    # Install lefthook hooks
task hooks:run        # Run pre-commit manually
```

## Code Standards

### TypeScript

- Strict mode enabled
- No `any` types
- Explicit return types on exported functions
- Use `interface` for object types, `type` for unions/aliases
- Use `readonly` for immutable data

### Naming Conventions

- Functions: `camelCase`
- Types/Interfaces: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Files: `kebab-case.ts`

### Testing

```typescript
// Test file naming
src/parser/whatsapp.ts        // Implementation
src/parser/whatsapp.test.ts   // Tests

// Use vitest
import { describe, expect, it } from 'vitest'
```

## Documentation

| Document | Location |
|----------|----------|
| Core Library PRD | `project/PRD_CORE.md` |
| CLI PRD | `project/PRD_CLI.md` |
| Phase 8 TODO | `project/todo/PHASE_8_TODO.md` |

## What NOT to Do

- ❌ Add IO operations to core library functions
- ❌ Add progress callbacks or events
- ❌ Add database operations
- ❌ Add rate limiting logic (coordinator's job)
- ❌ Use `biome-ignore` comments
- ❌ Skip `task ci` before completing work
- ❌ Forget to update project/TODO.md

## Dependencies

Core dependencies are minimal:
- `exceljs` - Excel export
- `jszip` - Zip file handling
- `pdfkit` - PDF generation

AI SDKs are peer dependencies (optional):
- `openai` - Embeddings
- `@anthropic-ai/sdk` - Classification

## Default AI Models

**You MUST use current model IDs.** Outdated models will fail or produce poor results.

| Provider | Model ID | Purpose |
|----------|----------|---------|
| Anthropic | `claude-haiku-4-5` | Classification (fast, cheap) |
| OpenAI | `gpt-5-mini` | Classification fallback |
| OpenRouter | `anthropic/claude-haiku-4.5` | Classification via OpenRouter |

**Keep these updated!** Check provider docs when models feel outdated.

---

*Last updated: 2025-12-19*
