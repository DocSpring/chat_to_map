/**
 * Tests for cost tracking in the entity resolution pipeline.
 */

import { describe, expect, it, vi } from 'vitest'
import { CostTracker } from '../costs/tracker'
import type { ClassificationFullConfig } from './classification'
import { classifyItem } from './classification'
import type { GoogleSearchFullConfig } from './google'
import { searchGoogle } from './google'
import type { DeferredItem } from './types'

describe('Google Search cost tracking', () => {
  it('should record costs when search is executed (no cache)', async () => {
    const costTracker = new CostTracker()

    // Mock fetch to return empty results
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] })
    })

    const config: GoogleSearchFullConfig = {
      apiKey: 'test-key',
      cx: 'test-cx',
      costTracker,
      customFetch: mockFetch as unknown as typeof fetch
    }

    await searchGoogle('test query', config)

    // Should record 1 search query cost
    expect(costTracker.recordCount).toBe(1)

    const records = costTracker.getRecords()
    expect(records[0]?.resource).toBe('google_search')
    expect(records[0]?.provider).toBe('google_search')
    expect(records[0]?.quantity).toBe(1)
    expect(records[0]?.costMicros).toBe(5_000) // $0.005 per query
    expect(records[0]?.metadata).toEqual({ query: 'test query' })
  })

  it('should not record costs when result is cached', async () => {
    const costTracker = new CostTracker()

    // Mock cache that returns a cached result
    const mockCache = {
      get: vi.fn().mockResolvedValue({
        data: [{ title: 'Cached Result', url: 'https://example.com', snippet: 'cached' }]
      }),
      set: vi.fn()
    }

    const config: GoogleSearchFullConfig = {
      apiKey: 'test-key',
      cx: 'test-cx',
      cache: mockCache,
      costTracker
    }

    await searchGoogle('test query', config)

    // No cost should be recorded for cache hit
    expect(costTracker.recordCount).toBe(0)
  })

  it('should record costs after caching new result', async () => {
    const costTracker = new CostTracker()

    // Mock cache that returns null (cache miss)
    const mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn()
    }

    // Mock fetch to return results
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ title: 'Result', link: 'https://example.com', snippet: 'test' }]
      })
    })

    const config: GoogleSearchFullConfig = {
      apiKey: 'test-key',
      cx: 'test-cx',
      cache: mockCache,
      costTracker,
      customFetch: mockFetch as unknown as typeof fetch
    }

    const results = await searchGoogle('test query', config)

    // Should have results
    expect(results).toHaveLength(1)

    // Should record cost
    expect(costTracker.recordCount).toBe(1)
    expect(costTracker.getRecords()[0]?.resource).toBe('google_search')
  })

  it('should work without costTracker (optional)', async () => {
    // Mock fetch to return results
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] })
    })

    const config: GoogleSearchFullConfig = {
      apiKey: 'test-key',
      cx: 'test-cx',
      customFetch: mockFetch as unknown as typeof fetch
      // No costTracker
    }

    // Should not throw
    const results = await searchGoogle('test query', config)
    expect(results).toEqual([])
  })
})

describe('AI Classification cost tracking', () => {
  it('should record AI costs when classification is executed (no cache)', async () => {
    const costTracker = new CostTracker()

    // Mock fetch to return Gemini response with usage metadata
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"url_indexes": [1], "explanation": "Test"}' }]
            }
          }
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150
        }
      })
    })

    const item: DeferredItem = {
      title: 'Test Movie',
      category: 'movie',
      searchResults: [{ title: 'IMDB', url: 'https://imdb.com/title/tt123', snippet: 'test' }]
    }

    const config: ClassificationFullConfig = {
      apiKey: 'test-key',
      model: 'gemini-3-flash-preview', // Use a model from pricing table
      costTracker,
      customFetch: mockFetch as unknown as typeof fetch
    }

    await classifyItem(item, config)

    // Should record 2 records (input + output tokens)
    expect(costTracker.recordCount).toBe(2)

    const records = costTracker.getRecords()
    const inputRecord = records.find((r) => r.resource === 'ai_input_token')
    const outputRecord = records.find((r) => r.resource === 'ai_output_token')

    expect(inputRecord).toBeDefined()
    expect(inputRecord?.quantity).toBe(100)
    expect(inputRecord?.provider).toBe('google') // Gemini model

    expect(outputRecord).toBeDefined()
    expect(outputRecord?.quantity).toBe(50)
    expect(outputRecord?.metadata).toEqual({
      operation: 'entity_classification',
      title: 'Test Movie',
      category: 'movie'
    })
  })

  it('should not record costs when result is cached', async () => {
    const costTracker = new CostTracker()

    // Mock cache that returns cached result
    const mockCache = {
      get: vi.fn().mockResolvedValue({
        data: {
          title: 'Test Movie',
          category: 'movie',
          urlIndexes: [1],
          rankedUrls: ['https://imdb.com/title/tt123'],
          explanation: 'Cached'
        }
      }),
      set: vi.fn()
    }

    const item: DeferredItem = {
      title: 'Test Movie',
      category: 'movie',
      searchResults: [{ title: 'IMDB', url: 'https://imdb.com/title/tt123' }]
    }

    const config: ClassificationFullConfig = {
      apiKey: 'test-key',
      cache: mockCache,
      costTracker
    }

    await classifyItem(item, config)

    // No cost should be recorded for cache hit
    expect(costTracker.recordCount).toBe(0)
  })

  it('should record costs even when AI classification fails', async () => {
    const costTracker = new CostTracker()

    // Mock fetch to return response with usage but no valid content
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'invalid json' }] } }],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 10
        }
      })
    })

    const item: DeferredItem = {
      title: 'Test Movie',
      category: 'movie',
      searchResults: [{ title: 'IMDB', url: 'https://imdb.com/title/tt123' }]
    }

    const config: ClassificationFullConfig = {
      apiKey: 'test-key',
      model: 'gemini-3-flash-preview', // Use a model from pricing table
      costTracker,
      customFetch: mockFetch as unknown as typeof fetch
    }

    const result = await classifyItem(item, config)

    // Should still record costs even though classification failed
    expect(costTracker.recordCount).toBe(2)
    expect(result.explanation).toBe('AI classification failed')
  })

  it('should work without costTracker (optional)', async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"url_indexes": [], "explanation": "No match"}' }]
            }
          }
        ],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 }
      })
    })

    const item: DeferredItem = {
      title: 'Test',
      category: 'movie',
      searchResults: []
    }

    const config: ClassificationFullConfig = {
      apiKey: 'test-key',
      customFetch: mockFetch as unknown as typeof fetch
      // No costTracker
    }

    // Should not throw
    const result = await classifyItem(item, config)
    expect(result.rankedUrls).toEqual([])
  })

  it('should not record costs when usage metadata is missing', async () => {
    const costTracker = new CostTracker()

    // Mock fetch to return response without usage metadata
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"url_indexes": [1], "explanation": "Test"}' }]
            }
          }
        ]
        // No usageMetadata
      })
    })

    const item: DeferredItem = {
      title: 'Test Movie',
      category: 'movie',
      searchResults: [{ title: 'IMDB', url: 'https://imdb.com/title/tt123' }]
    }

    const config: ClassificationFullConfig = {
      apiKey: 'test-key',
      costTracker,
      customFetch: mockFetch as unknown as typeof fetch
    }

    await classifyItem(item, config)

    // No cost recorded when usage metadata is missing
    expect(costTracker.recordCount).toBe(0)
  })
})
