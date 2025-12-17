/**
 * Smart Batching for Classifier
 *
 * Groups nearby candidates together so planning discussions don't get split across batches.
 */

import type { CandidateMessage } from '../types.js'

/**
 * Default gap between message IDs that triggers a new group.
 * Messages closer than this are considered part of the same discussion.
 */
const DEFAULT_PROXIMITY_GAP = 5

/**
 * Group candidates by proximity in the original conversation.
 * Messages with IDs close together are grouped together.
 *
 * @param candidates Candidates to group
 * @param proximityGap Max gap between message IDs to consider them in same group (default: 5)
 * @returns Array of grouped candidates
 */
export function groupCandidatesByProximity(
  candidates: readonly CandidateMessage[],
  proximityGap = DEFAULT_PROXIMITY_GAP
): readonly CandidateMessage[][] {
  if (candidates.length === 0) {
    return []
  }

  // Sort by message ID to ensure proper proximity detection
  const sorted = [...candidates].sort((a, b) => a.messageId - b.messageId)

  const groups: CandidateMessage[][] = []
  let currentGroup: CandidateMessage[] = []

  for (const candidate of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(candidate)
      continue
    }

    const lastCandidate = currentGroup[currentGroup.length - 1]
    if (!lastCandidate) {
      currentGroup.push(candidate)
      continue
    }

    const gap = candidate.messageId - lastCandidate.messageId

    if (gap <= proximityGap) {
      // Close enough, add to current group
      currentGroup.push(candidate)
    } else {
      // Too far apart, start new group
      groups.push(currentGroup)
      currentGroup = [candidate]
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

/**
 * Create smart batches that respect proximity groups.
 *
 * Unlike naive batching (slice every N), this keeps nearby candidates together.
 * Groups smaller than batchSize are combined when possible.
 * Groups larger than batchSize are split at natural boundaries.
 *
 * @param candidates Candidates to batch
 * @param batchSize Target batch size
 * @param proximityGap Max gap between message IDs for same group (default: 5)
 * @returns Array of batches, each containing grouped candidates
 */
export function createSmartBatches(
  candidates: readonly CandidateMessage[],
  batchSize: number,
  proximityGap = DEFAULT_PROXIMITY_GAP
): readonly (readonly CandidateMessage[])[] {
  if (candidates.length === 0) {
    return []
  }

  const groups = groupCandidatesByProximity(candidates, proximityGap)
  const batches: CandidateMessage[][] = []
  let currentBatch: CandidateMessage[] = []

  for (const group of groups) {
    // If adding this group would exceed batch size
    if (currentBatch.length + group.length > batchSize) {
      // If current batch has items, save it
      if (currentBatch.length > 0) {
        batches.push(currentBatch)
        currentBatch = []
      }

      // If group itself is larger than batch size, split it
      if (group.length > batchSize) {
        for (let i = 0; i < group.length; i += batchSize) {
          batches.push(group.slice(i, i + batchSize))
        }
      } else {
        // Group fits in a single batch
        currentBatch = [...group]
      }
    } else {
      // Add group to current batch
      currentBatch.push(...group)
    }
  }

  // Don't forget the last batch
  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}
