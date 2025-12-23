# E2E Test Guidelines

## Cache Fixture

E2E tests use `tests/fixtures/cli/cache-fixture.tar.gz` to cache external API/HTTP responses.

**What's cached:**
- `requests/ai/openai/` - OpenAI embeddings API responses
- `requests/ai/openrouter/` - OpenRouter (Gemini) classifier responses
- `requests/web/` - Scraped web page responses

**What's NOT cached:**
- `chats/` - Pipeline cache (parse results, candidates, etc.) - regenerated each run
- The fixture only contains `requests/` directory

**How it works:**
1. `setupE2ETests()` extracts `cache-fixture.tar.gz` to a temp directory
2. CLI subprocess gets `--cache-dir <tempDir>` pointing to extracted cache
3. `FilesystemCache` looks up requests in `<tempDir>/requests/`
4. If cache hit → use cached response. If miss → make real API call (or fail if locked)

**Cache locking (CI mode):**
When `cache-fixture.tar.gz` exists and `UPDATE_E2E_CACHE` is not set:
- All API keys are stripped from subprocess environment
- `E2E_CACHE_LOCKED=true` is set, blocking uncached HTTP requests
- Tests must use only cached responses

**Updating the cache:**
```bash
UPDATE_E2E_CACHE=true task test:e2e
```
This allows real API calls and updates the fixture with new responses.

## Writing a New E2E Test

1. **Run the CLI yourself first** to see the actual output:
   ```bash
   bun src/cli.ts <command> tests/fixtures/cli/whatsapp-sample.txt
   ```

2. **Note the actual values** from the output (message counts, stats, etc.)

3. **Write the test file** with assertions based on the real output

## Test Assertions

Use `toBeGreaterThanOrEqual` with the **current actual value** for numeric assertions.

This allows us to add more messages to the fixture in the future without breaking tests.

```typescript
// ✅ Correct - uses current value as minimum
expect(stats.totalEmbedded).toBeGreaterThanOrEqual(182)

// ❌ Wrong - too loose, doesn't catch regressions
expect(stats.totalEmbedded).toBeGreaterThan(0)
```
