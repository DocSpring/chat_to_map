/**
 * Activity Deduplication
 *
 * Merges similar activities into one, combining their messages.
 * Activities mentioned multiple times are MORE valuable, not duplicates.
 *
 * This is an orchestrator concern (CLI), not core library.
 */

import { type ClassifiedActivity, formatLocation } from '../types'

/**
 * Normalize a string for comparison (lowercase, trim, collapse whitespace).
 */
function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching of activity names.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) =>
    Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )

  for (let i = 1; i <= b.length; i++) {
    const row = matrix[i]
    const prevRow = matrix[i - 1]
    if (!row || !prevRow) continue

    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1
      const substitution = (prevRow[j - 1] ?? 0) + cost
      const insertion = (row[j - 1] ?? 0) + 1
      const deletion = (prevRow[j] ?? 0) + 1
      row[j] = Math.min(substitution, insertion, deletion)
    }
  }

  const lastRow = matrix[b.length]
  return lastRow ? (lastRow[a.length] ?? 0) : 0
}

/**
 * Calculate similarity ratio between two strings (0.0 to 1.0).
 */
function similarity(a: string, b: string): number {
  const normA = normalizeString(a)
  const normB = normalizeString(b)

  if (normA === normB) return 1.0
  if (normA.length === 0 || normB.length === 0) return 0.0

  const distance = levenshteinDistance(normA, normB)
  const maxLength = Math.max(normA.length, normB.length)

  return 1 - distance / maxLength
}

/**
 * Check if two activities should be grouped together.
 *
 * Matching criteria (in priority order):
 * 1. Exact location match (case-insensitive) - e.g., "Queenstown" appears twice
 * 2. High activity name similarity (>= 0.8) - e.g., "pottery class" vs "pottery classes"
 */
function shouldGroup(a: ClassifiedActivity, b: ClassifiedActivity): boolean {
  // Exact location match (if both have locations)
  const locA = formatLocation(a)
  const locB = formatLocation(b)
  if (locA && locB) {
    if (normalizeString(locA) === normalizeString(locB)) {
      return true
    }
  }

  // High activity name similarity
  if (similarity(a.activity, b.activity) >= 0.8) {
    return true
  }

  return false
}

/**
 * Round a number to specified decimal places.
 */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Deduplicate activities by merging similar ones.
 *
 * - Merges messages from duplicates into the primary activity
 * - Averages funScore and interestingScore (2 decimal places)
 * - Recalculates score from averaged values (1 decimal place)
 * - First occurrence becomes the primary (keeps its activity name, category, etc.)
 *
 * @param activities Classified activities to deduplicate
 * @returns Deduplicated activities with merged messages
 */
export function deduplicateActivities(
  activities: readonly ClassifiedActivity[]
): ClassifiedActivity[] {
  if (activities.length === 0) return []

  const grouped = new Set<number>()
  const result: ClassifiedActivity[] = []

  for (let i = 0; i < activities.length; i++) {
    const primary = activities[i]
    if (!primary) continue
    if (grouped.has(i)) continue

    // Find all matching activities
    const matches: ClassifiedActivity[] = [primary]
    const matchIndices: number[] = [i]

    for (let j = i + 1; j < activities.length; j++) {
      if (grouped.has(j)) continue

      const other = activities[j]
      if (other && shouldGroup(primary, other)) {
        matches.push(other)
        matchIndices.push(j)
      }
    }

    // Mark all as grouped
    for (const idx of matchIndices) {
      grouped.add(idx)
    }

    if (matches.length === 1) {
      // No duplicates - keep as-is
      result.push(primary)
    } else {
      // Merge duplicates
      const allMessages = matches.flatMap((a) => a.messages)

      // Average scores across all matches
      const avgFunScore = round(matches.reduce((sum, a) => sum + a.funScore, 0) / matches.length, 2)
      const avgInterestingScore = round(
        matches.reduce((sum, a) => sum + a.interestingScore, 0) / matches.length,
        2
      )
      const newScore = round(avgInterestingScore * 2 + avgFunScore, 1)

      // Create merged activity (primary keeps its fields, just update messages/scores)
      result.push({
        ...primary,
        messages: allMessages,
        funScore: avgFunScore,
        interestingScore: avgInterestingScore,
        score: newScore
      })
    }
  }

  return result
}

/**
 * Get mention count for an activity.
 */
export function getMentionCount(activity: ClassifiedActivity): number {
  return activity.messages.length
}

/**
 * Get earliest mention timestamp for an activity.
 */
export function getFirstMentionedAt(activity: ClassifiedActivity): Date {
  return activity.messages.reduce(
    (min, m) => (m.timestamp < min ? m.timestamp : min),
    activity.messages[0]?.timestamp ?? new Date()
  )
}

/**
 * Get latest mention timestamp for an activity.
 */
export function getLastMentionedAt(activity: ClassifiedActivity): Date {
  return activity.messages.reduce(
    (max, m) => (m.timestamp > max ? m.timestamp : max),
    activity.messages[0]?.timestamp ?? new Date()
  )
}

/**
 * Filter activities by minimum mention count.
 */
export function filterByMentionCount(
  activities: readonly ClassifiedActivity[],
  minCount: number
): ClassifiedActivity[] {
  return activities.filter((a) => getMentionCount(a) >= minCount)
}

/**
 * Get "most wanted" activities - those mentioned multiple times.
 */
export function getMostWanted(
  activities: readonly ClassifiedActivity[],
  limit = 10
): ClassifiedActivity[] {
  return activities.filter((a) => getMentionCount(a) > 1).slice(0, limit)
}
