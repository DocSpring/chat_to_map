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

### CLI Worker Pool Convention

**All CLI parallelism uses `runWorkerPool` from `src/cli/worker-pool.ts`.**

```typescript
import { runWorkerPool } from '../worker-pool'

const { successes, errors } = await runWorkerPool(
  items,
  async (item, index) => processItem(item),
  {
    concurrency: 5,
    onProgress: ({ completed, total }) => logger.log(`${completed}/${total}`)
  }
)
```

This ensures consistent:
- Concurrency control (default 5 workers)
- Progress reporting
- Error handling
- Result ordering

**Never use manual Promise.all loops for parallel work in CLI steps.**

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
| File length (code) | 500 lines max (NEVER remove comments to reduce - REFACTOR and SPLIT the file) |
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

## CLI Pipeline

Commands build on each other. Each command runs earlier steps if not cached.

```
parse            → Parse messages from chat export
scan             → Heuristic candidate extraction (quick, free)
embed            → Embed messages for semantic search (~$0.001/1000 msgs)
filter           → scan + embed + semantic search + merge → candidates.all
scrape-urls      → Get URL metadata for candidates
preview          → Quick AI classification on scan results only (~$0.01)
classify         → filter → scrape-urls → AI classify (full pipeline)
geocode          → classify → geocode locations
fetch-image-urls → geocode → fetch images from various sources
analyze          → Full pipeline with export (not yet tested)
```

**Key points:**
- `scan` is the quick/free heuristic preview
- `filter` combines heuristics + embeddings into `candidates.all`
- `classify` runs the FULL pipeline (filter → scrape → classify)
- `geocode` builds on classify results
- Each step uses pipeline cache if already run

## CLI Command Reference

Run with `bun run cli <command>` or after build `chat-to-map <command>`.

**⚠️ Default output is limited to 10 results.** Use `-a`/`--all` or `-n`/`--max-results` to see more.

| Command | Purpose | Key Options |
|---------|---------|-------------|
| `parse <input>` | Parse chat, show stats | `--json [file]`, `-m <num>` |
| `scan <input>` | Heuristic extraction (free) | `-n <num>` (default: 10) |
| `embed <input>` | Embed for semantic search | `--dry-run` |
| `filter <input>` | Heuristics + embeddings | `--method`, `--json [file]`, `-a` |
| `scrape-urls <input>` | Scrape URL metadata | `--dry-run`, `--json [file]` |
| `preview <input>` | Quick AI preview (scan only) | `-c <country>`, `--dry-run` |
| `classify <input>` | AI classification | `-c <country>`, `--json [file]`, `-a` |
| `geocode <input>` | Google Maps geocoding | `-c <country>`, `--json [file]`, `-a` |
| `fetch-image-urls <input>` | Fetch images for activities | `--no-image-cdn`, `--skip-pixabay`, `-a` |

**Common options (all commands):**
- `--no-cache` - Skip cache, regenerate results
- `--cache-dir <dir>` - Custom cache directory
- `-m, --max-messages <num>` - Limit messages processed
- `--dry-run` - Show cost estimate without API calls

**JSON output:** Most commands support `--json [file]` to output JSON to stdout or a file.

**Examples:**
```bash
bun run cli scan ./chat.txt -n 50           # Show 50 heuristic candidates
bun run cli filter ./chat.txt --all         # Show ALL candidates
bun run cli classify ./chat.txt --json out.json -c "New Zealand"
bun run cli geocode ./chat.txt -a           # Show all geocoded activities
bun run cli fetch-image-urls ./chat.txt --no-image-cdn --all  # Fetch images from APIs
```

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
task test             # Run unit tests (excludes E2E)
task test:watch       # Run unit tests in watch mode
task test:cov         # Run unit tests with coverage
task test:e2e         # Run CLI E2E tests (separate vitest config)

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

**🚨 NEVER use `bun test` - ALWAYS use `bun run test` or `task test`:**
- ❌ `bun test` → Bun's native runner - NO .env, NO vitest config, BROKEN setup files
- ✅ `bun run test` → Vitest - loads .env, proper config, works correctly
- ✅ `task test` → Same as above (preferred)
- ✅ `task test:e2e` → E2E tests only (uses separate vitest config)

**E2E Tests:**
- Located in `src/cli/e2e/`
- Use their own vitest config: `src/cli/e2e/vitest.config.ts`
- Excluded from regular `task test` runs
- Run with `task test:e2e` or `bun run test:e2e`
- To run a single E2E test file: `task test:e2e -- src/cli/e2e/07-classify.test.ts`
- To preserve temp cache dir for debugging: `DEBUG_E2E=1 task test:e2e -- src/cli/e2e/07-classify.test.ts`
- To update cache fixture (allow real API calls): `UPDATE_E2E_CACHE=true task test:e2e`
- To rebuild cache fixture from scratch: `REPLACE_E2E_CACHE=true task test:e2e`

**VCR Testing Model:** Tests are NEVER skipped. API responses are recorded locally and replayed on CI:
1. Run tests locally with API keys in `.env` → responses cached to fixtures
2. Commit fixture files (`tests/fixtures/`)
3. CI replays from cached fixtures (no real API calls needed)

```typescript
// Test file naming
src/parser/whatsapp.ts        // Implementation
src/parser/whatsapp.test.ts   // Tests

// Use vitest
import { describe, expect, it } from 'vitest'
```

### Test Fixtures & Caching

Three mechanisms for caching external API responses in tests:

| Class | Purpose | Use For |
|-------|---------|---------|
| `FixtureCache` | AI API responses (classifier, embeddings, geocoder) | Single .json.gz file, pass to functions as `cache` param |
| `HttpRecorder` | Raw HTTP responses (scrapers) | Auto-records to fixtures dir, provides `recorder.fetch` |
| `FilesystemCache` | General response cache | Production-style caching in tests |

**FixtureCache** - For AI API calls (classifier, embeddings, geocoder):
```typescript
import { FixtureCache } from '../test-support/fixture-cache.js'

const cache = new FixtureCache('tests/fixtures/my-test.json.gz')
await cache.load()

// Pass to classifier/embeddings/geocoder - auto records on first run
const result = await classifyMessages(candidates, config, cache)

await cache.save() // Writes new entries to fixture
```

**HttpRecorder** - For HTTP scraper tests:
```typescript
import { HttpRecorder } from './test-support/http-recorder.js'

const recorder = new HttpRecorder('tests/fixtures/scraper-name')

// Pass recorder.fetch to scrapers - auto records/replays
const result = await scrapeTikTok(url, { fetch: recorder.fetch })
```

**CI HTTP Guard** - Blocks uncached requests in CI:
```typescript
// In src/http.ts - throws UncachedHttpRequestError when:
// - CI=true AND (NODE_ENV=test OR VITEST=true)
// Run: CI=true bun run test  # Verifies all HTTP is cached
```

## Documentation

| Document | Location |
|----------|----------|
| Core Library PRD | `project/PRD_CORE.md` |
| CLI PRD | `project/PRD_CLI.md` |
| Phase 8 TODO | `project/todo/PHASE_8_TODO.md` |

## Cache System

The CLI uses a **two-layer caching system**:

| Layer | Purpose | Location |
|-------|---------|----------|
| **Pipeline Cache** | Per-run stage outputs (messages, candidates, classifications) | `~/.cache/chat-to-map/chats/<input>/<datetime>-<hash>/` |
| **API Cache** | Deduplicate API calls (embeddings, classification, geocoding, scraping) | `~/.cache/chat-to-map/requests/` |

### Cache Location

```bash
~/.cache/chat-to-map/
├── chats/                              # Pipeline cache (per-run outputs)
│   └── WhatsApp_Chat/
│       └── 2025-01-15T10-30-45-abc123/ # datetime-filehash
│           ├── chat.txt
│           ├── messages.json
│           ├── candidates.heuristics.json
│           ├── classifications.json
│           └── ...
└── requests/                           # API cache (response deduplication)
    ├── ai/openai/text-embedding-3-large/{hash}.json
    ├── ai/anthropic/claude-haiku-4-5/{hash}.json
    ├── geo/google/{hash}.json
    └── web/https_example_com_{hash}.json
```

### Configuration

```bash
# Custom cache directory
chat-to-map analyze ./chat.zip --cache-dir /tmp/cache
export CHAT_TO_MAP_CACHE_DIR="/custom/path"

# Skip all caching
chat-to-map analyze ./chat.zip --no-cache
```

### Cache Key Generation

Keys are **deterministic SHA256 hashes** with sorted object properties:

```typescript
import { generateCacheKey, generateUrlCacheKey } from 'src/cache/key'

// Same key regardless of property order
generateCacheKey({ a: 1, b: 2 }) === generateCacheKey({ b: 2, a: 1 })

// URL cache key includes sanitized URL + hash
generateUrlCacheKey('https://example.com/path')
// → 'web/https_example_com_path_abc12345.json'
```

### No TTL

Both caches store entries **forever**. Manual cleanup:

```bash
rm -rf ~/.cache/chat-to-map           # Clear all
rm -rf ~/.cache/chat-to-map/requests  # Clear API cache only
```

## User CLI Config

The CLI config file is at `~/.config/chat-to-map/config.json`:

```json
{
  "homeCountry": "New Zealand",
  "timezone": "Pacific/Auckland",
  "mediaLibraryPath": "/Users/ndbroadbent/code/chat_to_map_worktrees/media-library/media_library/images",
  "pdfThumbnails": true,
  "fetchImages": true
}
```

## Media Library

**Local path:** `/Users/ndbroadbent/code/chat_to_map_worktrees/media-library/media_library/images/`
**CDN:** `https://media.chattomap.com/images/` for image assets, with the index at
`https://media.chattomap.com/index.json.gz` (synced via rclone to R2)

```
images/
├── objects/          # ~700 curated activity images (swimming, restaurant, etc.)
├── categories/       # Category fallback images (references to objects)
├── countries/        # Country images (France, Japan, New Zealand, etc.)
├── regions/          # Region images (future)
├── cities/           # City images (future)
├── venues/           # Venue images (future)
├── index.json        # Index with all entries and synonyms (local)
└── index.json.gz     # Compressed index (CDN)
```

Use `mediaLibraryPath` in config or `--media-library-path` CLI flag to use local images instead of CDN.

## What NOT to Do

- ❌ Add IO operations to core library functions
- ❌ Add progress callbacks or events
- ❌ Add database operations
- ❌ Add rate limiting logic (coordinator's job)
- ❌ Use `biome-ignore` comments
- ❌ Skip `task ci` before completing work
- ❌ Forget to update project/TODO.md
- ❌ Use inline imports like `import('../../types').SomeType` - add proper imports at the top of the file
- ❌ Investigate bugs by reading code first - always write a failing test FIRST to reproduce the issue
- ❌ Assume CLI stdout shows all results - commands default to 10 results max, use `--max-results` or `--all` to see more

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

### CLI Model Selection

Model ID determines provider. Set via `CLASSIFIER_MODEL` env var.

| Model ID | Provider | API Model ID | Required Env Var |
|----------|----------|--------------|------------------|
| `gemini-3-flash` | google | `gemini-3-flash-preview` | `GOOGLE_AI_API_KEY` |
| `gemini-3-flash-or` | openrouter | `google/gemini-3-flash-preview` | `OPENROUTER_API_KEY` |
| `haiku-4.5` | anthropic | `claude-haiku-4-5` | `ANTHROPIC_API_KEY` |
| `haiku-4.5-or` | openrouter | `anthropic/claude-3-5-haiku-latest` | `OPENROUTER_API_KEY` |
| `gpt-5-mini` | openai | `gpt-5-mini` | `OPENAI_API_KEY` |

**Default:** `gemini-3-flash` (falls back to `haiku-4.5` if no Google AI key)

**Keep these updated!** Model constants are in `src/classifier/models.ts` - update `LATEST_*` when new models are released.

---

*Last updated: 2025-12-25*
