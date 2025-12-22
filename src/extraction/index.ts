/**
 * Candidate Extraction Module
 *
 * Extract candidate messages likely to contain activities using:
 * - Heuristics (regex + URL patterns) - fast, free
 * - Embeddings (semantic search) - slower, requires OpenAI API
 *
 * Includes agreement deduplication to avoid classifying both suggestions
 * and their responses as separate activities.
 */

import type {
  CandidateMessage,
  EmbeddingConfig,
  ExtractorOptions,
  ExtractorResult,
  ParsedMessage,
  ResponseCache,
  Result,
  SemanticSearchConfig
} from '../types.js'
import { extractCandidatesByEmbeddings } from './embeddings/index.js'
import { extractCandidatesByHeuristics } from './heuristics/index.js'

/** Default proximity range for agreement deduplication. */
const DEFAULT_AGREEMENT_PROXIMITY = 5

// Re-export embeddings
export {
  ACTIVITY_TYPE_QUERIES,
  AGREEMENT_QUERIES,
  cosineSimilarity,
  DEFAULT_ACTIVITY_QUERIES,
  embedMessages,
  embedQueries,
  extractCandidatesByEmbeddings,
  findSemanticCandidates,
  findTopK,
  getAllQueryEmbeddings,
  getDefaultQueryEmbeddings,
  getQueryEmbedding,
  getQueryEmbeddingsDimensions,
  getQueryEmbeddingsModel,
  getQueryType,
  loadQueryEmbeddings,
  SUGGESTION_QUERIES
} from './embeddings/index.js'
// Re-export heuristics
export {
  ACTIVITY_KEYWORDS,
  ACTIVITY_PATTERNS,
  type ActivityLinkOptions,
  classifyUrl,
  EXCLUSION_PATTERNS,
  extractActivityLinks,
  extractCandidatesByHeuristics,
  extractGoogleMapsCoords,
  isActivityUrl,
  isSocialUrl
} from './heuristics/index.js'

export interface ExtractCandidatesConfig {
  heuristics?: ExtractorOptions
  embeddings?: {
    config: EmbeddingConfig
    search?: SemanticSearchConfig
  }
  cache?: ResponseCache
  /**
   * Proximity range for agreement deduplication.
   * If an agreement candidate is within this many messages of a suggestion,
   * the agreement is dropped (the suggestion contains the activity details).
   * Set to 0 to disable deduplication.
   * Default: 5
   */
  agreementProximity?: number
}

/**
 * Deduplicate agreement candidates that overlap with nearby suggestions.
 *
 * Agreement patterns (like "sounds great!", "I'm keen") are responses to prior suggestions.
 * When both appear as candidates, we prefer the suggestion since it contains the activity.
 *
 * @param candidates All candidates (mixed suggestions and agreements)
 * @param proximity Maximum message ID distance for overlap detection
 * @returns Deduplicated candidates with agreement count
 */
export function deduplicateAgreements(
  candidates: readonly CandidateMessage[],
  proximity: number
): { candidates: CandidateMessage[]; removedCount: number } {
  if (proximity <= 0) {
    return { candidates: [...candidates], removedCount: 0 }
  }

  // Separate suggestions and agreements
  const suggestions = candidates.filter((c) => c.candidateType === 'suggestion')
  const agreements = candidates.filter((c) => c.candidateType === 'agreement')

  // Filter agreements: keep only those NOT within proximity of any suggestion
  const keptAgreements: CandidateMessage[] = []
  let removedCount = 0

  for (const agreement of agreements) {
    const hasNearbySuggestion = suggestions.some(
      (s) => Math.abs(s.messageId - agreement.messageId) <= proximity
    )

    if (hasNearbySuggestion) {
      // Agreement is near a suggestion - drop it (suggestion has the activity details)
      removedCount++
    } else {
      // Standalone agreement - keep it (might reference something further back)
      keptAgreements.push(agreement)
    }
  }

  // Merge and sort by confidence
  const result = [...suggestions, ...keptAgreements].sort((a, b) => b.confidence - a.confidence)

  return { candidates: result, removedCount }
}

export interface ExtractCandidatesResult extends ExtractorResult {
  embeddingsMatches: number
  /** Number of agreement candidates removed due to overlap with suggestions. */
  agreementsRemoved: number
}

/**
 * Extract candidates using both heuristics and embeddings.
 *
 * When embeddings config is provided and OPENAI_API_KEY is available,
 * runs both extraction methods and merges results by messageId.
 * Falls back to heuristics-only when embeddings unavailable.
 *
 * Applies agreement deduplication to remove agreement candidates that
 * overlap with nearby suggestions (configurable via agreementProximity).
 */
export async function extractCandidates(
  messages: readonly ParsedMessage[],
  config?: ExtractCandidatesConfig
): Promise<Result<ExtractCandidatesResult>> {
  const proximity = config?.agreementProximity ?? DEFAULT_AGREEMENT_PROXIMITY

  // Always run heuristics (fast, free)
  const heuristicsResult = extractCandidatesByHeuristics(messages, config?.heuristics)

  // If no embeddings config, apply deduplication and return heuristics only
  if (!config?.embeddings) {
    const { candidates, removedCount } = deduplicateAgreements(
      heuristicsResult.candidates,
      proximity
    )
    return {
      ok: true,
      value: {
        ...heuristicsResult,
        candidates,
        totalUnique: candidates.length,
        embeddingsMatches: 0,
        agreementsRemoved: removedCount
      }
    }
  }

  // Run embeddings extraction
  const embeddingsResult = await extractCandidatesByEmbeddings(
    messages,
    config.embeddings.config,
    config.embeddings.search,
    config.cache
  )

  if (!embeddingsResult.ok) {
    return embeddingsResult
  }

  // Merge by messageId, keeping highest confidence
  const candidateMap = new Map<number, CandidateMessage>()

  for (const candidate of heuristicsResult.candidates) {
    candidateMap.set(candidate.messageId, candidate)
  }

  for (const candidate of embeddingsResult.value) {
    const existing = candidateMap.get(candidate.messageId)
    if (!existing) {
      candidateMap.set(candidate.messageId, candidate)
    } else if (candidate.confidence > existing.confidence) {
      candidateMap.set(candidate.messageId, candidate)
    }
  }

  const mergedCandidates = [...candidateMap.values()]

  // Apply agreement deduplication
  const { candidates, removedCount } = deduplicateAgreements(mergedCandidates, proximity)

  return {
    ok: true,
    value: {
      candidates,
      regexMatches: heuristicsResult.regexMatches,
      urlMatches: heuristicsResult.urlMatches,
      embeddingsMatches: embeddingsResult.value.length,
      totalUnique: candidates.length,
      agreementsRemoved: removedCount
    }
  }
}
