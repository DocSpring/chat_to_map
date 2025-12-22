/**
 * Context Enrichment Tests
 */

import { describe, expect, it } from 'vitest'
import type { CandidateMessage } from '../types'
import {
  enrichCandidatesWithMetadata,
  extractUrlsFromCandidates,
  extractUrlsFromText,
  injectMetadataIntoText
} from './enrich'
import type { ScrapedMetadata } from './types'

describe('extractUrlsFromText', () => {
  it('extracts http URLs', () => {
    const text = 'Check out http://example.com for more info'
    expect(extractUrlsFromText(text)).toEqual(['http://example.com'])
  })

  it('extracts https URLs', () => {
    const text = 'Visit https://airbnb.com/rooms/123 for booking'
    expect(extractUrlsFromText(text)).toEqual(['https://airbnb.com/rooms/123'])
  })

  it('extracts multiple URLs', () => {
    const text = 'See https://a.com and https://b.com'
    expect(extractUrlsFromText(text)).toEqual(['https://a.com', 'https://b.com'])
  })

  it('deduplicates URLs', () => {
    const text = 'Visit https://a.com and https://a.com again'
    expect(extractUrlsFromText(text)).toEqual(['https://a.com'])
  })

  it('returns empty array for no URLs', () => {
    expect(extractUrlsFromText('No links here')).toEqual([])
  })

  it('handles complex URLs with paths and params', () => {
    const text = 'Check https://example.com/path/to/page?foo=bar&baz=qux#section'
    expect(extractUrlsFromText(text)).toEqual([
      'https://example.com/path/to/page?foo=bar&baz=qux#section'
    ])
  })
})

describe('extractUrlsFromCandidates', () => {
  const makeCandidate = (content: string, context?: string): CandidateMessage => ({
    messageId: 1,
    content,
    sender: 'Alice',
    timestamp: new Date(),
    source: { type: 'regex', pattern: 'test' },
    confidence: 0.8,
    candidateType: 'suggestion',
    context
  })

  it('extracts URLs from candidate context', () => {
    const candidates = [makeCandidate('hi', 'Check https://example.com')]
    expect(extractUrlsFromCandidates(candidates)).toEqual(['https://example.com'])
  })

  it('falls back to content if no context', () => {
    const candidates = [makeCandidate('Visit https://example.com')]
    expect(extractUrlsFromCandidates(candidates)).toEqual(['https://example.com'])
  })

  it('deduplicates across candidates', () => {
    const candidates = [
      makeCandidate('hi', 'Check https://a.com'),
      makeCandidate('hi', 'Also https://a.com and https://b.com')
    ]
    expect(extractUrlsFromCandidates(candidates)).toEqual(['https://a.com', 'https://b.com'])
  })
})

describe('injectMetadataIntoText', () => {
  const metadata: ScrapedMetadata = {
    platform: 'airbnb',
    canonicalUrl: 'https://airbnb.com/rooms/123',
    contentId: '123',
    title: 'Cozy Cabin',
    description: 'A beautiful cabin in the woods',
    hashtags: [],
    creator: 'Host Name',
    thumbnailUrl: null,
    categories: ['accommodation'],
    suggestedKeywords: []
  }

  it('injects metadata after URL', () => {
    const text = 'Check out https://airbnb.com/rooms/123 for our trip'
    const metadataMap = new Map([['https://airbnb.com/rooms/123', metadata]])

    const result = injectMetadataIntoText(text, metadataMap)

    expect(result).toContain('https://airbnb.com/rooms/123')
    expect(result).toContain('[URL_META:')
    expect(result).toContain('"platform":"airbnb"')
    expect(result).toContain('"title":"Cozy Cabin"')
  })

  it('handles multiple URLs', () => {
    const text = 'See https://a.com and https://b.com'
    const metadataMap = new Map<string, ScrapedMetadata>([
      [
        'https://a.com',
        { ...metadata, platform: 'other', canonicalUrl: 'https://a.com', title: 'Site A' }
      ],
      [
        'https://b.com',
        { ...metadata, platform: 'other', canonicalUrl: 'https://b.com', title: 'Site B' }
      ]
    ])

    const result = injectMetadataIntoText(text, metadataMap)

    expect(result).toContain('"title":"Site A"')
    expect(result).toContain('"title":"Site B"')
  })

  it('skips URLs without metadata', () => {
    const text = 'See https://unknown.com'
    const result = injectMetadataIntoText(text, new Map())

    expect(result).toBe(text)
  })

  it('returns original text if no URLs', () => {
    const text = 'No links here'
    const result = injectMetadataIntoText(text, new Map())

    expect(result).toBe(text)
  })

  it('truncates long descriptions', () => {
    const longDesc = 'A'.repeat(300)
    const metadataWithLongDesc = { ...metadata, description: longDesc }
    const text = 'Check https://airbnb.com/rooms/123'
    const metadataMap = new Map([['https://airbnb.com/rooms/123', metadataWithLongDesc]])

    const result = injectMetadataIntoText(text, metadataMap)

    // Description should be truncated to 200 chars
    expect(result).not.toContain('A'.repeat(300))
    expect(result).toContain('A'.repeat(200))
  })

  it('omits null fields from JSON', () => {
    const minimalMetadata: ScrapedMetadata = {
      platform: 'other',
      canonicalUrl: 'https://example.com',
      contentId: null,
      title: 'Test',
      description: null,
      hashtags: [],
      creator: null,
      thumbnailUrl: null,
      categories: [],
      suggestedKeywords: []
    }
    const text = 'Check https://example.com'
    const metadataMap = new Map([['https://example.com', minimalMetadata]])

    const result = injectMetadataIntoText(text, metadataMap)

    expect(result).toContain('"platform":"other"')
    expect(result).toContain('"title":"Test"')
    expect(result).not.toContain('"description"')
    expect(result).not.toContain('"creator"')
  })
})

describe('enrichCandidatesWithMetadata', () => {
  const makeCandidate = (id: number, context: string): CandidateMessage => ({
    messageId: id,
    content: 'test',
    sender: 'Alice',
    timestamp: new Date(),
    source: { type: 'regex', pattern: 'test' },
    confidence: 0.8,
    candidateType: 'suggestion',
    context
  })

  const metadata: ScrapedMetadata = {
    platform: 'youtube',
    canonicalUrl: 'https://youtube.com/watch?v=abc',
    contentId: 'abc',
    title: 'Cool Video',
    description: 'A cool video about stuff',
    hashtags: [],
    creator: 'Creator',
    thumbnailUrl: 'https://img.youtube.com/abc.jpg',
    categories: ['video'],
    suggestedKeywords: []
  }

  it('enriches candidate contexts', () => {
    const candidates = [makeCandidate(1, 'Watch https://youtube.com/watch?v=abc')]
    const metadataMap = new Map([['https://youtube.com/watch?v=abc', metadata]])

    const enriched = enrichCandidatesWithMetadata(candidates, metadataMap)

    expect(enriched).toHaveLength(1)
    expect(enriched[0]?.context).toContain('[URL_META:')
    expect(enriched[0]?.context).toContain('"title":"Cool Video"')
  })

  it('preserves other candidate fields', () => {
    const candidates = [makeCandidate(42, 'Watch https://youtube.com/watch?v=abc')]
    const metadataMap = new Map([['https://youtube.com/watch?v=abc', metadata]])

    const enriched = enrichCandidatesWithMetadata(candidates, metadataMap)

    expect(enriched[0]?.messageId).toBe(42)
    expect(enriched[0]?.sender).toBe('Alice')
    expect(enriched[0]?.confidence).toBe(0.8)
  })

  it('handles candidates without matching URLs', () => {
    const candidates = [makeCandidate(1, 'No URLs here')]
    const metadataMap = new Map([['https://other.com', metadata]])

    const enriched = enrichCandidatesWithMetadata(candidates, metadataMap)

    expect(enriched[0]?.context).toBe('No URLs here')
  })
})
