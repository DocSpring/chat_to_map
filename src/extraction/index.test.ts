/**
 * Combined Extraction Tests
 *
 * Tests for extractCandidates() which merges heuristics and embeddings results,
 * and deduplicateAgreements() for agreement/suggestion overlap handling.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CandidateMessage, ParsedMessage, QueryType } from '../types.js'
import * as embeddingsModule from './embeddings/index.js'
import * as heuristicsModule from './heuristics/index.js'
import { deduplicateAgreements } from './index.js'

// Create spies after importing
const mockExtractByEmbeddings = vi.spyOn(embeddingsModule, 'extractCandidatesByEmbeddings')
const mockExtractByHeuristics = vi.spyOn(heuristicsModule, 'extractCandidatesByHeuristics')

function createMessage(id: number, content: string): ParsedMessage {
  return {
    id,
    content,
    sender: 'Test User',
    timestamp: new Date('2025-01-15T10:00:00Z'),
    rawLine: `[1/15/25, 10:00:00 AM] Test User: ${content}`,
    hasMedia: false,
    source: 'whatsapp'
  }
}

function createCandidate(
  messageId: number,
  content: string,
  confidence: number,
  sourceType: 'regex' | 'url' | 'semantic',
  candidateType: QueryType = 'suggestion'
): CandidateMessage {
  const source =
    sourceType === 'semantic'
      ? {
          type: 'semantic' as const,
          similarity: confidence,
          query: 'test query',
          queryType: candidateType
        }
      : sourceType === 'url'
        ? { type: 'url' as const, urlType: 'google_maps' as const }
        : { type: 'regex' as const, pattern: 'test_pattern' }

  return {
    messageId,
    content,
    sender: 'Test User',
    timestamp: new Date('2025-01-15T10:00:00Z'),
    source,
    confidence,
    candidateType
  }
}

describe('extractCandidates (combined)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('heuristics only (no embeddings config)', () => {
    it('returns heuristics results when no embeddings config provided', async () => {
      const { extractCandidates } = await import('./index.js')

      mockExtractByHeuristics.mockReturnValue({
        candidates: [createCandidate(1, 'We should try this restaurant', 0.8, 'regex')],
        regexMatches: 1,
        urlMatches: 0,
        totalUnique: 1
      })

      const messages = [createMessage(1, 'We should try this restaurant')]
      const result = await extractCandidates(messages)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.candidates).toHaveLength(1)
        expect(result.value.embeddingsMatches).toBe(0)
        expect(mockExtractByEmbeddings).not.toHaveBeenCalled()
      }
    })
  })

  describe('with embeddings config', () => {
    it('calls both extractors and merges results', async () => {
      const { extractCandidates } = await import('./index.js')

      mockExtractByHeuristics.mockReturnValue({
        candidates: [createCandidate(1, 'We should try this restaurant', 0.8, 'regex')],
        regexMatches: 1,
        urlMatches: 0,
        totalUnique: 1
      })

      mockExtractByEmbeddings.mockResolvedValue({
        ok: true,
        value: [createCandidate(2, 'Hidden gem activity', 0.7, 'semantic')]
      })

      const messages = [
        createMessage(1, 'We should try this restaurant'),
        createMessage(2, 'Hidden gem activity')
      ]

      const result = await extractCandidates(messages, {
        embeddings: { config: { apiKey: 'test-key' } }
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.candidates).toHaveLength(2)
        expect(result.value.embeddingsMatches).toBe(1)
        expect(result.value.regexMatches).toBe(1)
      }
    })

    it('deduplicates by messageId, keeping highest confidence', async () => {
      const { extractCandidates } = await import('./index.js')

      // Same message found by both, heuristics has lower confidence
      mockExtractByHeuristics.mockReturnValue({
        candidates: [createCandidate(1, 'We should try this restaurant', 0.6, 'regex')],
        regexMatches: 1,
        urlMatches: 0,
        totalUnique: 1
      })

      // Embeddings finds same message with higher confidence
      mockExtractByEmbeddings.mockResolvedValue({
        ok: true,
        value: [createCandidate(1, 'We should try this restaurant', 0.9, 'semantic')]
      })

      const messages = [createMessage(1, 'We should try this restaurant')]

      const result = await extractCandidates(messages, {
        embeddings: { config: { apiKey: 'test-key' } }
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        // Should have 1 candidate (deduplicated)
        expect(result.value.candidates).toHaveLength(1)
        // Should keep the higher confidence (0.9 from embeddings)
        expect(result.value.candidates[0]?.confidence).toBe(0.9)
        expect(result.value.candidates[0]?.source.type).toBe('semantic')
      }
    })

    it('keeps heuristics result when it has higher confidence', async () => {
      const { extractCandidates } = await import('./index.js')

      // Heuristics has higher confidence
      mockExtractByHeuristics.mockReturnValue({
        candidates: [createCandidate(1, 'Bucket list restaurant', 0.95, 'regex')],
        regexMatches: 1,
        urlMatches: 0,
        totalUnique: 1
      })

      // Embeddings finds same message with lower confidence
      mockExtractByEmbeddings.mockResolvedValue({
        ok: true,
        value: [createCandidate(1, 'Bucket list restaurant', 0.7, 'semantic')]
      })

      const messages = [createMessage(1, 'Bucket list restaurant')]

      const result = await extractCandidates(messages, {
        embeddings: { config: { apiKey: 'test-key' } }
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.candidates).toHaveLength(1)
        // Should keep heuristics (0.95 > 0.7)
        expect(result.value.candidates[0]?.confidence).toBe(0.95)
        expect(result.value.candidates[0]?.source.type).toBe('regex')
      }
    })

    it('sorts merged results by confidence descending', async () => {
      const { extractCandidates } = await import('./index.js')

      mockExtractByHeuristics.mockReturnValue({
        candidates: [
          createCandidate(1, 'Low confidence', 0.5, 'regex'),
          createCandidate(2, 'High confidence', 0.9, 'regex')
        ],
        regexMatches: 2,
        urlMatches: 0,
        totalUnique: 2
      })

      mockExtractByEmbeddings.mockResolvedValue({
        ok: true,
        value: [createCandidate(3, 'Medium confidence', 0.7, 'semantic')]
      })

      const messages = [
        createMessage(1, 'Low confidence'),
        createMessage(2, 'High confidence'),
        createMessage(3, 'Medium confidence')
      ]

      const result = await extractCandidates(messages, {
        embeddings: { config: { apiKey: 'test-key' } }
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.candidates).toHaveLength(3)
        expect(result.value.candidates[0]?.confidence).toBe(0.9)
        expect(result.value.candidates[1]?.confidence).toBe(0.7)
        expect(result.value.candidates[2]?.confidence).toBe(0.5)
      }
    })

    it('returns embeddings error if embeddings fails', async () => {
      const { extractCandidates } = await import('./index.js')

      mockExtractByHeuristics.mockReturnValue({
        candidates: [],
        regexMatches: 0,
        urlMatches: 0,
        totalUnique: 0
      })

      mockExtractByEmbeddings.mockResolvedValue({
        ok: false,
        error: { type: 'auth', message: 'Invalid API key' }
      })

      const messages = [createMessage(1, 'Test message')]

      const result = await extractCandidates(messages, {
        embeddings: { config: { apiKey: 'bad-key' } }
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.type).toBe('auth')
      }
    })

    it('counts embeddings-only matches correctly', async () => {
      const { extractCandidates } = await import('./index.js')

      // Heuristics finds message 1
      mockExtractByHeuristics.mockReturnValue({
        candidates: [createCandidate(1, 'Heuristics match', 0.8, 'regex')],
        regexMatches: 1,
        urlMatches: 0,
        totalUnique: 1
      })

      // Embeddings finds messages 1, 2, and 3
      mockExtractByEmbeddings.mockResolvedValue({
        ok: true,
        value: [
          createCandidate(1, 'Heuristics match', 0.7, 'semantic'), // duplicate
          createCandidate(2, 'Embeddings only 1', 0.6, 'semantic'),
          createCandidate(3, 'Embeddings only 2', 0.5, 'semantic')
        ]
      })

      const messages = [
        createMessage(1, 'Heuristics match'),
        createMessage(2, 'Embeddings only 1'),
        createMessage(3, 'Embeddings only 2')
      ]

      const result = await extractCandidates(messages, {
        embeddings: { config: { apiKey: 'test-key' } }
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        // 3 unique candidates total
        expect(result.value.totalUnique).toBe(3)
        // Embeddings found 3 messages total
        expect(result.value.embeddingsMatches).toBe(3)
        // Heuristics found 1 (the shared one is kept with heuristics source due to higher confidence)
        expect(result.value.regexMatches).toBe(1)
      }
    })
  })

  describe('agreement deduplication in extractCandidates', () => {
    it('removes agreement candidates near suggestions', async () => {
      const { extractCandidates } = await import('./index.js')

      mockExtractByHeuristics.mockReturnValue({
        candidates: [
          createCandidate(1, 'We should try that new restaurant', 0.8, 'regex', 'suggestion'),
          createCandidate(2, 'Sounds great!', 0.7, 'regex', 'agreement')
        ],
        regexMatches: 2,
        urlMatches: 0,
        totalUnique: 2
      })

      const messages = [
        createMessage(1, 'We should try that new restaurant'),
        createMessage(2, 'Sounds great!')
      ]

      const result = await extractCandidates(messages)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.candidates).toHaveLength(1)
        expect(result.value.candidates[0]?.candidateType).toBe('suggestion')
        expect(result.value.agreementsRemoved).toBe(1)
      }
    })

    it('keeps standalone agreements not near suggestions', async () => {
      const { extractCandidates } = await import('./index.js')

      mockExtractByHeuristics.mockReturnValue({
        candidates: [
          createCandidate(1, 'We should try that restaurant', 0.8, 'regex', 'suggestion'),
          createCandidate(20, 'That looks amazing!', 0.7, 'regex', 'agreement') // Far from suggestion
        ],
        regexMatches: 2,
        urlMatches: 0,
        totalUnique: 2
      })

      const messages = [
        createMessage(1, 'We should try that restaurant'),
        createMessage(20, 'That looks amazing!')
      ]

      const result = await extractCandidates(messages)

      expect(result.ok).toBe(true)
      if (result.ok) {
        // Both kept - agreement is > 5 messages away
        expect(result.value.candidates).toHaveLength(2)
        expect(result.value.agreementsRemoved).toBe(0)
      }
    })

    it('respects custom agreementProximity', async () => {
      const { extractCandidates } = await import('./index.js')

      mockExtractByHeuristics.mockReturnValue({
        candidates: [
          createCandidate(1, 'We should try that restaurant', 0.8, 'regex', 'suggestion'),
          createCandidate(3, 'Sounds good', 0.7, 'regex', 'agreement')
        ],
        regexMatches: 2,
        urlMatches: 0,
        totalUnique: 2
      })

      const messages = [
        createMessage(1, 'We should try that restaurant'),
        createMessage(3, 'Sounds good')
      ]

      // With proximity 1, agreement at message 3 is NOT near suggestion at message 1
      const result = await extractCandidates(messages, { agreementProximity: 1 })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.candidates).toHaveLength(2)
        expect(result.value.agreementsRemoved).toBe(0)
      }
    })

    it('can disable deduplication with agreementProximity: 0', async () => {
      const { extractCandidates } = await import('./index.js')

      mockExtractByHeuristics.mockReturnValue({
        candidates: [
          createCandidate(1, 'We should try that restaurant', 0.8, 'regex', 'suggestion'),
          createCandidate(2, 'Sounds great!', 0.7, 'regex', 'agreement')
        ],
        regexMatches: 2,
        urlMatches: 0,
        totalUnique: 2
      })

      const messages = [
        createMessage(1, 'We should try that restaurant'),
        createMessage(2, 'Sounds great!')
      ]

      const result = await extractCandidates(messages, { agreementProximity: 0 })

      expect(result.ok).toBe(true)
      if (result.ok) {
        // Both kept - deduplication disabled
        expect(result.value.candidates).toHaveLength(2)
        expect(result.value.agreementsRemoved).toBe(0)
      }
    })
  })
})

describe('deduplicateAgreements', () => {
  it('returns empty array for empty input', () => {
    const { candidates, removedCount } = deduplicateAgreements([], 5)
    expect(candidates).toEqual([])
    expect(removedCount).toBe(0)
  })

  it('returns all candidates when only suggestions', () => {
    const candidates = [
      createCandidate(1, 'Try this restaurant', 0.8, 'regex', 'suggestion'),
      createCandidate(5, 'Visit that cafe', 0.7, 'regex', 'suggestion')
    ]

    const { candidates: result, removedCount } = deduplicateAgreements(candidates, 5)

    expect(result).toHaveLength(2)
    expect(removedCount).toBe(0)
  })

  it('returns all candidates when only agreements', () => {
    const candidates = [
      createCandidate(1, 'Sounds great', 0.8, 'regex', 'agreement'),
      createCandidate(5, 'Love it', 0.7, 'regex', 'agreement')
    ]

    const { candidates: result, removedCount } = deduplicateAgreements(candidates, 5)

    expect(result).toHaveLength(2)
    expect(removedCount).toBe(0)
  })

  it('removes agreement within proximity of suggestion', () => {
    const candidates = [
      createCandidate(10, 'Lets go hiking tomorrow', 0.9, 'regex', 'suggestion'),
      createCandidate(12, 'Sounds fun!', 0.7, 'regex', 'agreement')
    ]

    const { candidates: result, removedCount } = deduplicateAgreements(candidates, 5)

    expect(result).toHaveLength(1)
    expect(result[0]?.candidateType).toBe('suggestion')
    expect(removedCount).toBe(1)
  })

  it('removes agreement before suggestion within proximity', () => {
    // Agreement comes BEFORE suggestion (less common but possible)
    const candidates = [
      createCandidate(8, 'That looks fun', 0.7, 'regex', 'agreement'),
      createCandidate(10, 'Lets do that hike', 0.9, 'regex', 'suggestion')
    ]

    const { candidates: result, removedCount } = deduplicateAgreements(candidates, 5)

    expect(result).toHaveLength(1)
    expect(result[0]?.candidateType).toBe('suggestion')
    expect(removedCount).toBe(1)
  })

  it('keeps agreement outside proximity', () => {
    const candidates = [
      createCandidate(1, 'Lets try that restaurant', 0.9, 'regex', 'suggestion'),
      createCandidate(20, 'Amazing!', 0.7, 'regex', 'agreement') // 19 messages away
    ]

    const { candidates: result, removedCount } = deduplicateAgreements(candidates, 5)

    expect(result).toHaveLength(2)
    expect(removedCount).toBe(0)
  })

  it('removes multiple agreements near same suggestion', () => {
    const candidates = [
      createCandidate(10, 'Lets go to that cafe', 0.9, 'regex', 'suggestion'),
      createCandidate(11, 'Yes!', 0.6, 'regex', 'agreement'),
      createCandidate(12, 'Im keen', 0.7, 'regex', 'agreement'),
      createCandidate(13, 'Sounds good', 0.5, 'regex', 'agreement')
    ]

    const { candidates: result, removedCount } = deduplicateAgreements(candidates, 5)

    expect(result).toHaveLength(1)
    expect(result[0]?.candidateType).toBe('suggestion')
    expect(removedCount).toBe(3)
  })

  it('handles multiple suggestion/agreement clusters', () => {
    const candidates = [
      // Cluster 1: messages 1-5
      createCandidate(1, 'Try this restaurant', 0.9, 'regex', 'suggestion'),
      createCandidate(3, 'Sounds great', 0.7, 'regex', 'agreement'),
      // Cluster 2: messages 50-55
      createCandidate(50, 'Lets go hiking', 0.85, 'regex', 'suggestion'),
      createCandidate(52, 'Im down', 0.6, 'regex', 'agreement'),
      // Standalone agreement far from both
      createCandidate(100, 'That looks amazing', 0.7, 'regex', 'agreement')
    ]

    const { candidates: result, removedCount } = deduplicateAgreements(candidates, 5)

    expect(result).toHaveLength(3)
    expect(result.filter((c) => c.candidateType === 'suggestion')).toHaveLength(2)
    expect(result.filter((c) => c.candidateType === 'agreement')).toHaveLength(1)
    expect(result.find((c) => c.messageId === 100)).toBeDefined() // Standalone kept
    expect(removedCount).toBe(2)
  })

  it('uses exact proximity boundary', () => {
    const candidates = [
      createCandidate(10, 'Suggestion', 0.9, 'regex', 'suggestion'),
      createCandidate(15, 'Exactly 5 away', 0.7, 'regex', 'agreement'), // Exactly at boundary
      createCandidate(16, 'One past boundary', 0.6, 'regex', 'agreement') // Just outside
    ]

    const { candidates: result, removedCount } = deduplicateAgreements(candidates, 5)

    expect(result).toHaveLength(2)
    // Agreement at 15 (distance = 5) should be removed
    expect(result.find((c) => c.messageId === 15)).toBeUndefined()
    // Agreement at 16 (distance = 6) should be kept
    expect(result.find((c) => c.messageId === 16)).toBeDefined()
    expect(removedCount).toBe(1)
  })

  it('sorts results by confidence descending', () => {
    const candidates = [
      createCandidate(1, 'Low conf suggestion', 0.5, 'regex', 'suggestion'),
      createCandidate(100, 'High conf suggestion', 0.95, 'regex', 'suggestion'),
      createCandidate(200, 'Medium conf agreement', 0.7, 'regex', 'agreement')
    ]

    const { candidates: result } = deduplicateAgreements(candidates, 5)

    expect(result[0]?.confidence).toBe(0.95)
    expect(result[1]?.confidence).toBe(0.7)
    expect(result[2]?.confidence).toBe(0.5)
  })

  it('returns copy when proximity is 0 (disabled)', () => {
    const candidates = [
      createCandidate(1, 'Suggestion', 0.9, 'regex', 'suggestion'),
      createCandidate(2, 'Agreement right next to it', 0.7, 'regex', 'agreement')
    ]

    const { candidates: result, removedCount } = deduplicateAgreements(candidates, 0)

    expect(result).toHaveLength(2)
    expect(removedCount).toBe(0)
  })

  it('returns copy when proximity is negative (disabled)', () => {
    const candidates = [
      createCandidate(1, 'Suggestion', 0.9, 'regex', 'suggestion'),
      createCandidate(2, 'Agreement', 0.7, 'regex', 'agreement')
    ]

    const { candidates: result, removedCount } = deduplicateAgreements(candidates, -1)

    expect(result).toHaveLength(2)
    expect(removedCount).toBe(0)
  })
})
