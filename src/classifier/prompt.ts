/**
 * Classification Prompt
 *
 * AI prompt for classifying candidate messages as activities.
 */

import type { CandidateMessage } from '../types.js'

/**
 * Format context for display. Context already includes target marked with >>>.
 */
function formatContext(candidate: CandidateMessage): string {
  if (candidate.context) {
    return candidate.context
  }
  // Fallback if no context
  return `>>> ${candidate.sender}: ${candidate.content}`
}

/**
 * Format timestamp for display in prompt.
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Build the classification prompt for a batch of candidates.
 */
export function buildClassificationPrompt(candidates: readonly CandidateMessage[]): string {
  const messagesText = candidates
    .map((candidate) => {
      const context = formatContext(candidate)
      const timestamp = formatTimestamp(candidate.timestamp)
      return `
---
ID: ${candidate.messageId} | ${timestamp}
${context}
---`
    })
    .join('\n')

  return `You are analyzing chat messages between people. Your task is to identify messages that suggest "things to do" - activities, places to visit, events to attend, trips to take, etc.

URLs in the chat may be followed by [URL_META: {...}] lines containing scraped metadata (title, description, platform). Use this metadata to better understand what the link is about - it tells you the actual content (e.g., a restaurant name, hotel listing, event details) rather than just seeing a raw URL.

For each message marked with >>>, determine:
1. Is this a suggestion for something to do together? (yes/no)
2. If yes, what is the activity/thing to do?
3. If yes, what location is mentioned (if any)?
4. Activity score: 0.0 (errand like vet/mechanic) to 1.0 (fun activity)
5. Category: restaurant, cafe, bar, hike, nature, beach, trip, hotel, event, concert, museum, entertainment, adventure, family, errand, appointment, other
6. Is mappable: Can this be pinned on a map? (yes if specific location like "Queenstown", "Coffee Lab", Google Maps URL; no if general idea like "see a movie", "go kayaking" without a specific venue)

Focus on:
- Suggestions to visit places (restaurants, beaches, parks, cities)
- Activities to try (hiking, kayaking, concerts, shows)
- Travel plans (trips, hotels, Airbnb)
- Events to attend (festivals, markets, movies)
- Experiences to have ("we should try...", "let's go to...")

Ignore:
- Mundane tasks (groceries, cleaning, work)
- Past events (things they already did)
- Vague statements without actionable suggestions
- Just sharing links without suggesting to go/do something
- Romantic/intimate invitations (coming over, staying the night, "netflix and chill")
- Adult or suggestive content (explicit messages, flirting, intimate conversations)
- Private relationship moments - these should NEVER appear in results
- Generic routine activities without a specific venue ("go to a coffee shop", "get dinner somewhere") - these happen daily and aren't special. But DO include unique experiences even without a specific location ("go kayaking", "try skydiving", "see a show")

${messagesText}

Respond in this exact JSON format (array of objects, one per message analyzed):
\`\`\`json
[
  {
    "message_id": <id>,
    "is_activity": true/false,
    "activity": "<what to do - null if not a suggestion>",
    "location": "<place/location mentioned - null if none or not a suggestion>",
    "activity_score": <0.0-1.0>,
    "category": "<category>",
    "confidence": <0.0-1.0 how confident you are>,
    "is_mappable": true/false
  }
]
\`\`\`

Include ALL messages in your response (both activities and non-activities).
Be concise with activity descriptions (under 100 chars).
For location, extract specific place names if mentioned.`
}

export interface ParsedClassification {
  message_id: number
  is_activity: boolean
  activity: string | null
  location: string | null
  activity_score: number
  category: string
  confidence: number
  is_mappable: boolean
}

function extractJsonFromResponse(response: string): string {
  // Try to extract JSON from response (might be wrapped in ```json```)
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
  if (jsonMatch?.[1]) {
    return jsonMatch[1]
  }
  // Try to find JSON array directly
  const arrayMatch = response.match(/\[[\s\S]*\]/)
  if (!arrayMatch) {
    throw new Error('Could not find JSON array in response')
  }
  return arrayMatch[0]
}

function parseItem(obj: Record<string, unknown>): ParsedClassification {
  const location = typeof obj.location === 'string' ? obj.location : null
  const defaultMappable = location !== null && location.trim().length > 0

  return {
    message_id: typeof obj.message_id === 'number' ? obj.message_id : 0,
    is_activity: obj.is_activity === true,
    activity: typeof obj.activity === 'string' ? obj.activity : null,
    location,
    activity_score:
      typeof obj.activity_score === 'number' ? Math.max(0, Math.min(1, obj.activity_score)) : 0.5,
    category: typeof obj.category === 'string' ? obj.category : 'other',
    confidence: typeof obj.confidence === 'number' ? Math.max(0, Math.min(1, obj.confidence)) : 0.5,
    is_mappable: typeof obj.is_mappable === 'boolean' ? obj.is_mappable : defaultMappable
  }
}

/**
 * Parse the classification response from the AI.
 * @param response Raw AI response text
 * @param expectedIds Optional array of message IDs - at least one must match
 */
export function parseClassificationResponse(
  response: string,
  expectedIds?: readonly number[]
): ParsedClassification[] {
  const jsonStr = extractJsonFromResponse(response)
  const parsed = JSON.parse(jsonStr) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error('Response is not an array')
  }

  if (parsed.length === 0) {
    throw new Error('Response array is empty')
  }

  const results = parsed.map((item: unknown) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Array item is not an object')
    }
    return parseItem(item as Record<string, unknown>)
  })

  // Validate at least one message_id matches expected
  if (expectedIds && expectedIds.length > 0) {
    const expectedSet = new Set(expectedIds)
    const hasMatch = results.some((r) => expectedSet.has(r.message_id))
    if (!hasMatch) {
      throw new Error(
        `AI response contains no matching message IDs. Expected: [${expectedIds.join(', ')}], got: [${results.map((r) => r.message_id).join(', ')}]`
      )
    }
  }

  return results
}
