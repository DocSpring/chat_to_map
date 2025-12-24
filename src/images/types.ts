/**
 * Image Types
 *
 * Types for image fetching and results.
 *
 * ⚠️ LEGAL NOTICE: 'scraped' is NOT a valid source.
 * OpenGraph images can ONLY be used for inline link previews.
 * Using them as activity images = copyright infringement.
 * See project_docs/IMAGES.md for full licensing rules.
 */

/**
 * Sources for activity images, in priority order.
 *
 * NOTE: 'scraped'/'og' is intentionally NOT included.
 * OG images can only be displayed as link previews within message context.
 */
export type ImageSource =
  | 'cdn' // ChatToMap CDN default image
  | 'google_places' // Google Places Photos API
  | 'wikipedia' // Wikipedia/Wikimedia Commons
  | 'pixabay' // Pixabay stock photos
  | 'user_upload' // User-provided replacement image

/**
 * Result of fetching an image for an activity.
 */
export interface ImageResult {
  /** URL to the image */
  readonly url: string

  /** Image data (for embedding in PDF) */
  readonly data?: Uint8Array | undefined

  /** Image dimensions */
  readonly width?: number | undefined
  readonly height?: number | undefined

  /** Source that provided the image */
  readonly source: ImageSource

  /** Attribution info (required for some sources) */
  readonly attribution?:
    | {
        readonly name: string
        readonly url: string
      }
    | undefined

  /** Search query used (for Pixabay debugging) */
  readonly query?: string | undefined
}

/**
 * Configuration for image fetching.
 */
export interface ImageFetchConfig {
  /** Skip CDN default images (--no-image-cdn) */
  readonly skipCdn?: boolean | undefined

  /** Skip Pixabay image search */
  readonly skipPixabay?: boolean | undefined

  /** Skip Wikipedia image lookup */
  readonly skipWikipedia?: boolean | undefined

  /** Skip Google Places Photos */
  readonly skipGooglePlaces?: boolean | undefined

  /** Pixabay API key */
  readonly pixabayApiKey?: string | undefined

  /** Google Places API key */
  readonly googlePlacesApiKey?: string | undefined
}
