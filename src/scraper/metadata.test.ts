/**
 * URL Metadata Fetching Tests
 */

import { describe, expect, it } from 'vitest'
import type { CandidateMessage } from '../types'
import { extractUrlsFromCandidates, extractUrlsFromText, fetchMetadataForUrls } from './metadata'
import type { FetchFn } from './types'

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
  function createContextMessage(
    id: number,
    content: string
  ): {
    id: number
    sender: string
    content: string
    timestamp: Date
  } {
    return { id, sender: 'User', content, timestamp: new Date() }
  }

  const makeCandidate = (
    content: string,
    contextBefore: ReturnType<typeof createContextMessage>[] = [],
    contextAfter: ReturnType<typeof createContextMessage>[] = []
  ): CandidateMessage => ({
    messageId: 1,
    content,
    sender: 'Alice',
    timestamp: new Date(),
    source: { type: 'regex', pattern: 'test' },
    confidence: 0.8,
    candidateType: 'suggestion',
    contextBefore,
    contextAfter
  })

  it('extracts URLs from context before', () => {
    const candidates = [makeCandidate('hi', [createContextMessage(0, 'Check https://example.com')])]
    expect(extractUrlsFromCandidates(candidates)).toEqual(['https://example.com'])
  })

  it('extracts URLs from context after', () => {
    const candidates = [
      makeCandidate('hi', [], [createContextMessage(2, 'See https://example.com')])
    ]
    expect(extractUrlsFromCandidates(candidates)).toEqual(['https://example.com'])
  })

  it('extracts URLs from content', () => {
    const candidates = [makeCandidate('Visit https://example.com')]
    expect(extractUrlsFromCandidates(candidates)).toEqual(['https://example.com'])
  })

  it('deduplicates across candidates', () => {
    const candidates = [
      makeCandidate('hi', [createContextMessage(0, 'Check https://a.com')]),
      makeCandidate('hi', [createContextMessage(0, 'Also https://a.com and https://b.com')])
    ]
    expect(extractUrlsFromCandidates(candidates)).toEqual(['https://a.com', 'https://b.com'])
  })
})

describe('fetchMetadataForUrls', () => {
  it('fetches OG metadata for a bare Omata Kitchen URL', async () => {
    const url = 'https://www.omata.co.nz/kitchen'
    const fetch: FetchFn = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => `
        <html>
          <head>
            <meta property="og:title" content="Kitchen &mdash; Omata Estate">
            <meta
              property="og:description"
              content="A relaxed style eatery with views overlooking the ocean."
            >
            <meta property="og:url" content="${url}">
          </head>
        </html>
      `,
      json: async () => ({}),
      arrayBuffer: async () => new ArrayBuffer(0)
    })

    const metadata = await fetchMetadataForUrls([url], { fetch, concurrency: 1 })

    expect(metadata.get(url)).toEqual(
      expect.objectContaining({
        canonicalUrl: url,
        title: 'Kitchen — Omata Estate',
        description: 'A relaxed style eatery with views overlooking the ocean.'
      })
    )
  })
})
