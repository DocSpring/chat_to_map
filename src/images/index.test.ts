/**
 * Images Module Tests
 */

import { describe, expect, it } from 'vitest'
import type { CachedResponse, ResponseCache } from '../cache/types'
import type { GeocodedActivity } from '../types/geocoder'
import { fetchImageForActivity, fetchImagesForActivities } from './index'
import type { ImageFetchConfig } from './types'

function createMockCache(): ResponseCache {
  const store = new Map<string, CachedResponse<unknown>>()
  return {
    get: async <T = unknown>(key: string): Promise<CachedResponse<T> | null> => {
      const result = store.get(key)
      return (result as CachedResponse<T>) ?? null
    },
    set: async <T = unknown>(key: string, value: CachedResponse<T>): Promise<void> => {
      store.set(key, value as CachedResponse<unknown>)
    }
  }
}

function createMockActivity(overrides: Partial<GeocodedActivity> = {}): GeocodedActivity {
  return {
    messageId: 1,
    activity: 'Visit the coffee shop',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    sender: 'Alice',
    originalMessage: 'We should check out this restaurant!',
    confidence: 0.8,
    category: 'food',
    funScore: 0.8,
    interestingScore: 0.7,
    isGeneric: false,
    isCompound: false,
    action: null,
    actionOriginal: null,
    object: null,
    objectOriginal: null,
    venue: null,
    city: null,
    region: null,
    country: null,
    ...overrides
  }
}

describe('Images Module', () => {
  describe('fetchImageForActivity', () => {
    it('returns null when no sources available', async () => {
      const cache = createMockCache()
      const activity = createMockActivity()
      const config: ImageFetchConfig = {
        skipGooglePlaces: true,
        skipWikipedia: true,
        skipPixabay: true
      }

      const result = await fetchImageForActivity(activity, config, cache)

      expect(result).toBeNull()
    })

    it('skips Google Places when skipGooglePlaces is true', async () => {
      const cache = createMockCache()
      const activity = createMockActivity({ placeId: 'ChIJ123' })
      const config: ImageFetchConfig = {
        skipGooglePlaces: true,
        skipWikipedia: true,
        skipPixabay: true,
        googlePlacesApiKey: 'test-key'
      }

      const result = await fetchImageForActivity(activity, config, cache)

      expect(result).toBeNull()
    })

    it('skips Wikipedia when skipWikipedia is true', async () => {
      const cache = createMockCache()
      const activity = createMockActivity({ venue: 'Eiffel Tower', city: 'Paris' })
      const config: ImageFetchConfig = {
        skipGooglePlaces: true,
        skipWikipedia: true,
        skipPixabay: true
      }

      const result = await fetchImageForActivity(activity, config, cache)

      expect(result).toBeNull()
    })

    it('skips Pixabay when skipPixabay is true', async () => {
      const cache = createMockCache()
      const activity = createMockActivity({ action: 'hiking', object: 'mountains' })
      const config: ImageFetchConfig = {
        skipGooglePlaces: true,
        skipWikipedia: true,
        skipPixabay: true,
        pixabayApiKey: 'test-key'
      }

      const result = await fetchImageForActivity(activity, config, cache)

      expect(result).toBeNull()
    })

    it('skips Pixabay when no API key provided', async () => {
      const cache = createMockCache()
      const activity = createMockActivity({ action: 'hiking' })
      const config: ImageFetchConfig = {
        skipGooglePlaces: true,
        skipWikipedia: true
        // No pixabayApiKey
      }

      const result = await fetchImageForActivity(activity, config, cache)

      expect(result).toBeNull()
    })

    it('skips Google Places when no API key provided', async () => {
      const cache = createMockCache()
      const activity = createMockActivity({ placeId: 'ChIJ123' })
      const config: ImageFetchConfig = {
        skipWikipedia: true,
        skipPixabay: true
        // No googlePlacesApiKey
      }

      const result = await fetchImageForActivity(activity, config, cache)

      expect(result).toBeNull()
    })
  })

  describe('fetchImagesForActivities', () => {
    it('returns a map with null values when no sources available', async () => {
      const cache = createMockCache()
      const activities = [
        createMockActivity({ messageId: 1, category: 'food' }),
        createMockActivity({ messageId: 2, category: 'nature' }),
        createMockActivity({ messageId: 3, category: 'food' })
      ]
      const config: ImageFetchConfig = {
        skipGooglePlaces: true,
        skipWikipedia: true,
        skipPixabay: true
      }

      const results = await fetchImagesForActivities(activities, config, cache)

      expect(results.size).toBe(3)
      expect(results.get(1)).toBeNull()
      expect(results.get(2)).toBeNull()
      expect(results.get(3)).toBeNull()
    })

    it('calls onProgress callback', async () => {
      const cache = createMockCache()
      const activities = [
        createMockActivity({ messageId: 1 }),
        createMockActivity({ messageId: 2 })
      ]
      const config: ImageFetchConfig = {
        skipGooglePlaces: true,
        skipWikipedia: true,
        skipPixabay: true
      }
      const progressCalls: Array<{ current: number; total: number }> = []

      await fetchImagesForActivities(activities, config, cache, {
        onProgress: (current, total) => {
          progressCalls.push({ current, total })
        }
      })

      expect(progressCalls).toHaveLength(2)
      expect(progressCalls[0]).toEqual({ current: 1, total: 2 })
      expect(progressCalls[1]).toEqual({ current: 2, total: 2 })
    })

    it('handles empty activities array', async () => {
      const cache = createMockCache()
      const config: ImageFetchConfig = {}

      const results = await fetchImagesForActivities([], config, cache)

      expect(results.size).toBe(0)
    })
  })
})
