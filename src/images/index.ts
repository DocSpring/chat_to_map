/**
 * Images Module
 *
 * Fetches images for activities using a priority chain:
 * 1. CDN default images (category/action based)
 * 2. Google Places Photos (for venues with placeId - NOT cities/regions)
 * 3. Pixabay (for generic activities)
 *
 * Returns null if no image found.
 *
 * ⚠️ LEGAL NOTICE: OpenGraph/scraped images are NOT used here.
 * OG images can ONLY be used for inline link previews (shown with the URL).
 * Using them as activity images = republishing = copyright infringement.
 * See project_docs/IMAGES.md for full licensing rules.
 */

import type { ResponseCache } from '../cache/types'
import type { GeocodedActivity } from '../types/geocoder'
import { fetchCdnDefaultImage } from './cdn'
import { fetchGooglePlacesPhoto } from './google-places'
import { fetchPixabayImage } from './pixabay'
import type { ImageFetchConfig, ImageResult } from './types'

export { fetchGooglePlacesPhoto } from './google-places'
export { fetchPixabayImage } from './pixabay'
export type { ImageFetchConfig, ImageResult, ImageSource } from './types'
export { fetchWikipediaImage } from './wikipedia'

/**
 * Fetch an image for a single activity.
 *
 * Tries sources in priority order: cdn → google_places → pixabay.
 * Returns null if no image found from any source.
 *
 * NOTE: Scraped OG images are intentionally NOT used here.
 * OG images can only be displayed as link previews within message context.
 */
export async function fetchImageForActivity(
  activity: GeocodedActivity,
  config: ImageFetchConfig,
  cache: ResponseCache
): Promise<ImageResult | null> {
  // 1. Try CDN default images (unless --no-image-cdn)
  if (!config.skipCdn) {
    const result = await fetchCdnDefaultImage(activity)
    if (result) return result
  }

  // 2. Try Google Places Photos (only for venue placeIds, not city/region placeIds)
  if (
    activity.placeId &&
    activity.isVenuePlaceId &&
    !config.skipGooglePlaces &&
    config.googlePlacesApiKey
  ) {
    const result = await fetchGooglePlacesPhoto(activity.placeId, config.googlePlacesApiKey, cache)
    if (result) return result
  }

  // 3. Try Pixabay (if not skipped and has API key)
  if (!config.skipPixabay && config.pixabayApiKey) {
    const result = await fetchPixabayImage(activity, config.pixabayApiKey, cache)
    if (result) return result
  }

  return null
}

/**
 * Fetch images for multiple activities.
 *
 * Returns a map of activityId → ImageResult (or null if no image found).
 * Uses activityId (not messageId) because compound activities can create
 * multiple activities from a single message.
 */
export async function fetchImagesForActivities(
  activities: readonly GeocodedActivity[],
  config: ImageFetchConfig,
  cache: ResponseCache,
  options?: {
    onProgress?: (current: number, total: number) => void
  }
): Promise<Map<string, ImageResult | null>> {
  const results = new Map<string, ImageResult | null>()
  const total = activities.length

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i]
    if (!activity) continue

    const result = await fetchImageForActivity(activity, config, cache)
    results.set(activity.activityId, result)

    options?.onProgress?.(i + 1, total)
  }

  return results
}
