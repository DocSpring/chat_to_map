/**
 * Core types for ChatToMap library
 *
 * Design principle: Pure types only. No runtime validation or transformation.
 */

// ============================================================================
// Chat Source Types
// ============================================================================

export type ChatSource = 'whatsapp' | 'imessage'

export type WhatsAppFormat = 'ios' | 'android' | 'auto'

// ============================================================================
// Parser Types
// ============================================================================

export type MediaType = 'image' | 'video' | 'audio' | 'gif' | 'sticker' | 'document' | 'contact'

export interface ParsedMessage {
  readonly id: number
  readonly timestamp: Date
  readonly sender: string
  readonly content: string
  readonly rawLine: string
  readonly hasMedia: boolean
  readonly mediaType?: MediaType | undefined
  readonly urls?: readonly string[] | undefined
  readonly source: ChatSource
}

export type UrlType =
  | 'google_maps'
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'x'
  | 'facebook'
  | 'facebook_group'
  | 'airbnb'
  | 'booking'
  | 'tripadvisor'
  | 'event'
  | 'website'

export interface ParserOptions {
  readonly format?: WhatsAppFormat
  readonly timezone?: string
}

export interface ParseResult {
  readonly messages: readonly ParsedMessage[]
  readonly senders: readonly string[]
  readonly dateRange: {
    readonly start: Date
    readonly end: Date
  }
  readonly messageCount: number
  readonly urlCount: number
}

// ============================================================================
// Extractor Types
// ============================================================================

export type CandidateSource =
  | { readonly type: 'regex'; readonly pattern: string }
  | { readonly type: 'url'; readonly urlType: UrlType }
  | { readonly type: 'semantic'; readonly similarity: number; readonly query: string }

export interface CandidateMessage {
  readonly messageId: number
  readonly content: string
  readonly sender: string
  readonly timestamp: Date
  readonly source: CandidateSource
  readonly confidence: number
  readonly context?: string | undefined
  readonly urls?: readonly string[] | undefined
}

export interface ExtractorOptions {
  readonly minConfidence?: number
  readonly includeUrlBased?: boolean
  readonly additionalPatterns?: readonly RegExp[]
  readonly additionalExclusions?: readonly RegExp[]
}

export interface ExtractorResult {
  readonly candidates: readonly CandidateMessage[]
  readonly regexMatches: number
  readonly urlMatches: number
  readonly totalUnique: number
}

// ============================================================================
// Activity Link Types
// ============================================================================

/**
 * Inferred type for an activity link based on context analysis.
 */
export type ActivityLinkType = 'place' | 'activity' | 'event' | 'idea' | 'unknown'

/**
 * Social platform type for activity links.
 */
export type SocialPlatform =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'x'
  | 'facebook'
  | 'google_maps'
  | 'airbnb'
  | 'booking'
  | 'tripadvisor'
  | 'eventbrite'
  | 'other'

/**
 * Context surrounding an activity link in the chat.
 */
export interface ActivityLinkContext {
  /** Messages before the link (±2 messages) */
  readonly before: readonly string[]
  /** Messages after the link (±2 messages) */
  readonly after: readonly string[]
  /** Sender who shared the link */
  readonly sender: string
  /** Timestamp when the link was shared */
  readonly timestamp: Date
  /** The full message content containing the link */
  readonly messageContent: string
}

/**
 * Intent signals detected from context around an activity link.
 */
export interface IntentSignals {
  /** High-signal keywords found (e.g., "go", "try", "visit") */
  readonly keywords: readonly string[]
  /** High-signal emojis found (e.g., fire, heart eyes) */
  readonly emojis: readonly string[]
  /** Combined intent score from 0.0 to 1.0 */
  readonly score: number
}

/**
 * Optional metadata scraped from the linked content.
 * This is best-effort - may not be available for all links.
 */
export interface ActivityLinkMetadata {
  readonly title?: string | undefined
  readonly description?: string | undefined
  readonly thumbnail?: string | undefined
  readonly creator?: string | undefined
}

/**
 * An activity link extracted from chat - a social media or web link
 * that likely represents a place, activity, or event.
 */
export interface ActivityLink {
  /** The URL of the link */
  readonly url: string
  /** Detected platform (instagram, tiktok, youtube, etc.) */
  readonly platform: SocialPlatform
  /** Confidence that this is activity-related (0.0 to 1.0) */
  readonly confidence: number
  /** Inferred type based on context (place, activity, event, idea) */
  readonly inferredType: ActivityLinkType
  /** Context from surrounding messages */
  readonly context: ActivityLinkContext
  /** Intent signals detected from context */
  readonly intent: IntentSignals
  /** Optional metadata from scraping (best-effort) */
  readonly metadata?: ActivityLinkMetadata | undefined
  /** Original message ID */
  readonly messageId: number
}

/**
 * Result from extracting activity links from messages.
 */
export interface ActivityLinkResult {
  readonly links: readonly ActivityLink[]
  readonly totalUrls: number
  readonly activityLinkCount: number
}

// ============================================================================
// Embeddings Types
// ============================================================================

export interface EmbeddingConfig {
  readonly apiKey: string
  readonly model?: string
  readonly batchSize?: number
}

export interface EmbeddedMessage {
  readonly messageId: number
  readonly content: string
  readonly embedding: Float32Array
}

export interface SemanticSearchConfig {
  readonly queries?: readonly string[]
  readonly topK?: number
  readonly minSimilarity?: number
}

// ============================================================================
// Classifier Types
// ============================================================================

export type ActivityCategory =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'hike'
  | 'nature'
  | 'beach'
  | 'trip'
  | 'hotel'
  | 'event'
  | 'concert'
  | 'museum'
  | 'entertainment'
  | 'adventure'
  | 'family'
  | 'errand'
  | 'appointment'
  | 'other'

export interface ClassifiedSuggestion {
  readonly messageId: number
  readonly isActivity: boolean
  readonly activity: string
  readonly location?: string | undefined
  readonly activityScore: number
  readonly category: ActivityCategory
  readonly confidence: number
  readonly originalMessage: string
  readonly sender: string
  readonly timestamp: Date
  /**
   * Whether this activity has a specific location that can be geocoded.
   * - true: Mappable (specific place like "Queenstown", "Coffee Lab", Google Maps URL)
   * - false: General activity idea without location (like "see a movie", "go kayaking")
   * Both types are valuable - general ideas appear in the list but not on the map.
   */
  readonly isMappable: boolean
}

/**
 * Provider type for AI classification APIs.
 */
export type ClassifierProvider = 'anthropic' | 'openai' | 'openrouter'

/**
 * Configuration for a single provider (used for fallbacks).
 */
export interface ProviderConfig {
  readonly provider: ClassifierProvider
  readonly apiKey: string
  readonly model?: string
}

export interface BatchInfo {
  readonly batchIndex: number
  readonly totalBatches: number
  readonly candidateCount: number
  readonly model: string
  readonly provider: ClassifierProvider
}

export interface CacheCheckInfo {
  readonly batchIndex: number
  readonly cacheKey: string
  readonly hit: boolean
}

export interface ClassifierConfig {
  readonly provider: ClassifierProvider
  readonly apiKey: string
  readonly model?: string
  readonly batchSize?: number
  readonly contextChars?: number
  /**
   * Max gap between message IDs to consider them in the same discussion.
   * Nearby messages are grouped together in batches for better context.
   * Default: 5
   */
  readonly proximityGap?: number
  /**
   * Fallback providers to try when the primary provider returns a rate limit error (429).
   * Providers are tried in order until one succeeds.
   */
  readonly fallbackProviders?: readonly ProviderConfig[]
  /**
   * Called before each batch API request (only on cache miss). Use for logging/progress.
   */
  readonly onBatchStart?: (info: BatchInfo) => void
  /**
   * Called after cache check. Use for debug logging.
   */
  readonly onCacheCheck?: (info: CacheCheckInfo) => void
}

export interface ClassifierResponse {
  readonly message_id: number
  readonly is_activity: boolean
  readonly activity: string | null
  readonly location: string | null
  readonly activity_score: number
  readonly category: string
  readonly confidence: number
  /**
   * Whether this activity can be geocoded to a map location.
   * - true: Has specific place name (Queenstown, Coffee Lab, URL)
   * - false: General activity idea (see a movie, go kayaking)
   */
  readonly is_mappable: boolean
}

// ============================================================================
// Aggregation Types
// ============================================================================

/**
 * A single message that mentioned an activity/location.
 * Used for tracking multiple mentions of the same thing.
 */
export interface SourceMessage {
  readonly messageId: number
  readonly content: string
  readonly sender: string
  readonly timestamp: Date
  readonly context?: string | undefined
}

/**
 * An aggregated suggestion combining multiple mentions of the same activity/location.
 * Activities mentioned multiple times are MORE valuable, not duplicates.
 */
export interface AggregatedSuggestion extends ClassifiedSuggestion {
  /** Number of times this activity/location was mentioned */
  readonly mentionCount: number
  /** Timestamp of first mention */
  readonly firstMentionedAt: Date
  /** Timestamp of most recent mention */
  readonly lastMentionedAt: Date
  /** All source messages that mentioned this activity */
  readonly sourceMessages: readonly SourceMessage[]
}

// ============================================================================
// Geocoder Types
// ============================================================================

export type GeocodeSource = 'google_maps_url' | 'google_geocoding' | 'place_search'

export interface GeocodedSuggestion extends ClassifiedSuggestion {
  readonly latitude?: number | undefined
  readonly longitude?: number | undefined
  readonly formattedAddress?: string | undefined
  readonly placeId?: string | undefined
  readonly geocodeSource?: GeocodeSource | undefined
}

export interface GeocoderConfig {
  readonly apiKey: string
  readonly regionBias?: string | undefined
  readonly defaultCountry?: string | undefined
}

export interface GeocodeResult {
  readonly latitude: number
  readonly longitude: number
  readonly formattedAddress: string
  readonly placeId?: string | undefined
}

// ============================================================================
// Export Types
// ============================================================================

export interface MapConfig {
  readonly title?: string
  readonly centerLat?: number
  readonly centerLng?: number
  readonly zoom?: number
  readonly clusterMarkers?: boolean
  readonly colorBySender?: boolean
}

export interface PDFConfig {
  readonly title?: string
  readonly subtitle?: string
  readonly includeMap?: boolean
  readonly filterByCategory?: readonly ActivityCategory[]
  readonly filterByRegion?: string
}

export interface ExportMetadata {
  readonly version: string
  readonly generatedAt: Date
  readonly inputFile?: string | undefined
  readonly messageCount: number
  readonly suggestionCount: number
  readonly geocodedCount: number
}

// ============================================================================
// Result Types
// ============================================================================

export type ApiErrorType =
  | 'rate_limit'
  | 'auth'
  | 'quota'
  | 'network'
  | 'invalid_response'
  | 'invalid_request'

export interface ApiError {
  readonly type: ApiErrorType
  readonly message: string
  readonly retryAfter?: number | undefined
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApiError }

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cached response wrapper with metadata
 */
export interface CachedResponse<T = unknown> {
  readonly data: T
  readonly cachedAt: number
}

/**
 * Pluggable cache interface for API responses.
 */
export interface ResponseCache {
  get<T = unknown>(hash: string): Promise<CachedResponse<T> | null>
  set<T = unknown>(hash: string, response: CachedResponse<T>, ttlSeconds: number): Promise<void>
}

// ============================================================================
// CLI Types
// ============================================================================

export interface CLIOptions {
  readonly outputDir?: string | undefined
  readonly format?: readonly string[] | undefined
  readonly region?: string | undefined
  readonly parallel?: number | undefined
  readonly minConfidence?: number | undefined
  readonly activitiesOnly?: boolean | undefined
  readonly category?: ActivityCategory | undefined
  readonly skipEmbeddings?: boolean | undefined
  readonly skipGeocoding?: boolean | undefined
  readonly quiet?: boolean | undefined
  readonly verbose?: boolean | undefined
  readonly dryRun?: boolean | undefined
  readonly openaiKey?: string | undefined
  readonly anthropicKey?: string | undefined
  readonly openrouterKey?: string | undefined
  readonly googleMapsKey?: string | undefined
}

export interface ProcessingStats {
  readonly messageCount: number
  readonly candidateCount: number
  readonly semanticCandidateCount: number
  readonly activityCount: number
  readonly errandCount: number
  readonly geocodedCount: number
  readonly costs: {
    readonly embeddings: number
    readonly classification: number
    readonly geocoding: number
    readonly total: number
  }
}
