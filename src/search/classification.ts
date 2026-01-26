/**
 * AI Classification for Search Results
 *
 * Stage 5 of the entity resolution pipeline.
 * Uses Gemini to rank URLs by likelihood of being the correct match.
 */

import { generateCacheKey } from '../caching/key'
import type { ResponseCache } from '../caching/types'
import { createAIUsageRecords } from '../costs/calculator'
import type { CostTracker } from '../costs/tracker'
import { type HttpResponse, httpFetch } from '../http'
import type { AIClassificationConfig, ClassificationResult, DeferredItem } from './types'
import { DEFAULT_TIMEOUT } from './types'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
const DEFAULT_MODEL = 'gemini-2.5-flash-preview-05-20'

/**
 * Full configuration for AI classification.
 */
export interface ClassificationFullConfig extends AIClassificationConfig {
  /** Response cache for API calls */
  cache?: ResponseCache | undefined
  /** Cost tracker for API usage billing */
  costTracker?: CostTracker | undefined
  /** Request timeout in milliseconds */
  timeout?: number | undefined
  /** Custom fetch function (for testing) */
  customFetch?: typeof fetch | undefined
}

/**
 * Build classification prompt for an item.
 */
function buildPrompt(item: DeferredItem): string {
  const { title, category, searchResults } = item

  let resultsText = ''
  searchResults.forEach((r, i) => {
    resultsText += `${i + 1}. ${r.title}\n`
    resultsText += `   ${r.url}\n`
    if (r.snippet) {
      resultsText += `   ${r.snippet.slice(0, 200)}\n`
    }
    resultsText += '\n'
  })

  return `Find URLs for this specific media entity that will have an og:image meta tag.

Entity: "${title}" (${category})

Search results:
${resultsText}
STRICT RULES:
1. Only include results that are actually for THIS SPECIFIC entity - not similar titles, not other works by the same creator
2. NEVER include: reddit.com, facebook.com, instagram.com, linkedin.com, twitter.com, any forum or social media
3. Rank authoritative sources first: imdb.com, wikipedia.org, goodreads.com, amazon.com, spotify.com, letterboxd.com
4. Return EMPTY ARRAY if none of the results are for the correct entity

Return JSON with 1-indexed result numbers, best first:
{"url_indexes": [2, 5], "explanation": "Result 2 is IMDB, Result 5 is Wikipedia"}

Empty array if no result matches the entity (a book by the same author is NOT a match).`
}

/** Token usage from Gemini API response */
interface GeminiUsageMetadata {
  promptTokenCount?: number
  candidatesTokenCount?: number
  totalTokenCount?: number
}

/** Result from Gemini API call including usage */
interface GeminiCallResult {
  result: { url_indexes: number[]; explanation: string } | null
  usage: GeminiUsageMetadata | null
}

/**
 * Call Gemini API and parse JSON response.
 */
async function callGemini(
  prompt: string,
  config: ClassificationFullConfig
): Promise<GeminiCallResult> {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT
  const model = config.model ?? DEFAULT_MODEL

  const url = `${GEMINI_API_URL.replace('{model}', model)}?key=${config.apiKey}`

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  }

  let response: HttpResponse
  try {
    if (config.customFetch) {
      const fetchResponse = await config.customFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeout)
      })
      response = fetchResponse as unknown as HttpResponse
    } else {
      response = await httpFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeout)
      })
    }
  } catch {
    return { result: null, usage: null }
  }

  if (!response.ok) {
    return { result: null, usage: null }
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>
      }
    }>
    usageMetadata?: GeminiUsageMetadata
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  const usage = data.usageMetadata ?? null

  if (!text) {
    return { result: null, usage }
  }

  try {
    const result = JSON.parse(text) as { url_indexes: number[]; explanation: string }
    return { result, usage }
  } catch {
    return { result: null, usage }
  }
}

/**
 * Classify a single deferred item using AI.
 *
 * @param item - Deferred item with search results
 * @param config - AI classification configuration
 * @returns Classification result with ranked URLs
 */
export async function classifyItem(
  item: DeferredItem,
  config: ClassificationFullConfig
): Promise<ClassificationResult> {
  const { title, category, searchResults } = item

  // Check cache first
  if (config.cache) {
    const cacheKey = generateCacheKey({
      service: 'gemini',
      model: config.model ?? DEFAULT_MODEL,
      payload: { title, category, urls: searchResults.map((r) => r.url) }
    })

    const cached = await config.cache.get<ClassificationResult>(cacheKey)
    if (cached) {
      return cached.data
    }

    // Execute classification and cache result
    const result = await executeClassification(item, config)
    await config.cache.set(cacheKey, { data: result, cachedAt: Date.now() })
    return result
  }

  return executeClassification(item, config)
}

async function executeClassification(
  item: DeferredItem,
  config: ClassificationFullConfig
): Promise<ClassificationResult> {
  const { title, category, searchResults } = item
  const model = config.model ?? DEFAULT_MODEL

  const prompt = buildPrompt(item)
  const { result: aiResponse, usage } = await callGemini(prompt, config)

  // Record AI costs if we have usage data and a cost tracker
  if (usage && config.costTracker) {
    const inputTokens = usage.promptTokenCount ?? 0
    const outputTokens = usage.candidatesTokenCount ?? 0
    if (inputTokens > 0 || outputTokens > 0) {
      const usageRecords = createAIUsageRecords(model, inputTokens, outputTokens, {
        operation: 'entity_classification',
        title,
        category
      })
      config.costTracker.addRecords(usageRecords)
    }
  }

  if (!aiResponse) {
    return {
      title,
      category,
      urlIndexes: [],
      rankedUrls: [],
      explanation: 'AI classification failed'
    }
  }

  const urlIndexes = aiResponse.url_indexes || []
  const explanation = aiResponse.explanation || ''

  // Convert indexes to URLs (1-indexed)
  const rankedUrls: string[] = []
  for (const idx of urlIndexes) {
    if (idx >= 1 && idx <= searchResults.length) {
      const result = searchResults[idx - 1]
      if (result) {
        rankedUrls.push(result.url)
      }
    }
  }

  return {
    title,
    category,
    urlIndexes,
    rankedUrls,
    explanation
  }
}

/**
 * Classify multiple deferred items using AI.
 *
 * @param items - Array of deferred items
 * @param config - AI classification configuration
 * @returns Array of classification results
 */
export async function classifyItems(
  items: DeferredItem[],
  config: ClassificationFullConfig
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = []

  for (const item of items) {
    const result = await classifyItem(item, config)
    results.push(result)
  }

  return results
}

/**
 * Get the best URL from a classification result.
 *
 * @param result - Classification result
 * @returns Best URL or null if none found
 */
export function getBestUrl(result: ClassificationResult): string | null {
  if (result.rankedUrls.length === 0) {
    return null
  }
  return result.rankedUrls[0] ?? null
}

/**
 * Convert classification result to a simplified match format.
 */
export function classificationToMatch(
  result: ClassificationResult
): { url: string; source: string; title: string } | null {
  const url = getBestUrl(result)
  if (!url) {
    return null
  }

  // Determine source from URL
  let source = 'ai'
  const urlLower = url.toLowerCase()
  if (urlLower.includes('imdb.com')) source = 'imdb'
  else if (urlLower.includes('goodreads.com')) source = 'goodreads'
  else if (urlLower.includes('wikipedia.org')) source = 'wikipedia'
  else if (urlLower.includes('spotify.com')) source = 'spotify'
  else if (urlLower.includes('boardgamegeek.com')) source = 'bgg'
  else if (urlLower.includes('steam')) source = 'steam'

  return {
    url,
    source,
    title: result.title
  }
}
