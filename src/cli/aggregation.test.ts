import { describe, expect, it } from 'vitest'
import { createActivity as createTestActivity } from '../test-support'
import type { ClassifiedActivity } from '../types'
import {
  deduplicateActivities,
  filterByMentionCount,
  getFirstMentionedAt,
  getLastMentionedAt,
  getMentionCount,
  getMostWanted
} from './aggregation'

function createActivity(
  id: number,
  activity: string,
  city?: string,
  timestamp?: Date,
  sender = 'User'
): ClassifiedActivity {
  return createTestActivity({
    activity,
    category: 'food',
    messages: [
      {
        id,
        sender,
        timestamp: timestamp ?? new Date('2025-01-15T10:00:00Z'),
        message: `Let's do ${activity}`
      }
    ],
    city: city ?? null
  })
}

describe('Aggregation Module', () => {
  describe('deduplicateActivities', () => {
    it('returns empty array for empty input', () => {
      const result = deduplicateActivities([])
      expect(result).toEqual([])
    })

    it('returns single activity unchanged', () => {
      const activities = [createActivity(1, 'Dinner at Italian Place', 'Rome')]

      const result = deduplicateActivities(activities)

      expect(result).toHaveLength(1)
      const first = result[0]
      if (!first) throw new Error('Expected first result')
      expect(getMentionCount(first)).toBe(1)
      expect(first.messages).toHaveLength(1)
    })

    it('groups by exact location match (case-insensitive)', () => {
      const activities = [
        createActivity(1, 'Visit Queenstown', 'Queenstown'),
        createActivity(2, 'Go to queenstown', 'queenstown'),
        createActivity(3, 'QUEENSTOWN trip', 'QUEENSTOWN')
      ]

      const result = deduplicateActivities(activities)

      expect(result).toHaveLength(1)
      const first = result[0]
      if (!first) throw new Error('Expected first result')
      expect(getMentionCount(first)).toBe(3)
      expect(first.messages).toHaveLength(3)
    })

    it('groups by activity name similarity', () => {
      const activities = [
        createActivity(1, 'pottery class'),
        createActivity(2, 'Pottery Class'),
        createActivity(3, 'pottery classes')
      ]

      const result = deduplicateActivities(activities)

      expect(result).toHaveLength(1)
      const first = result[0]
      if (!first) throw new Error('Expected first result')
      expect(getMentionCount(first)).toBe(3)
    })

    it('does not group dissimilar activities', () => {
      const activities = [
        createActivity(1, 'pottery class'),
        createActivity(2, 'cooking class'),
        createActivity(3, 'yoga class')
      ]

      const result = deduplicateActivities(activities)

      expect(result).toHaveLength(3)
      expect(result.every((r) => getMentionCount(r) === 1)).toBe(true)
    })

    it('calculates correct date range', () => {
      const activities = [
        createActivity(1, 'pottery', undefined, new Date('2022-01-15')),
        createActivity(2, 'pottery', undefined, new Date('2023-06-20')),
        createActivity(3, 'pottery', undefined, new Date('2024-12-01'))
      ]

      const result = deduplicateActivities(activities)

      expect(result).toHaveLength(1)
      const first = result[0]
      if (!first) throw new Error('Expected first result')
      expect(getFirstMentionedAt(first)).toEqual(new Date('2022-01-15'))
      expect(getLastMentionedAt(first)).toEqual(new Date('2024-12-01'))
    })

    it('preserves all source messages', () => {
      const activities = [
        createActivity(1, 'Dinner', 'The Restaurant', new Date('2022-01-01'), 'Alice'),
        createActivity(2, 'dinner', 'the restaurant', new Date('2023-01-01'), 'Bob'),
        createActivity(3, 'Dinner', 'The Restaurant', new Date('2024-01-01'), 'Charlie')
      ]

      const result = deduplicateActivities(activities)

      expect(result).toHaveLength(1)
      expect(result[0]?.messages).toHaveLength(3)

      const senders = result[0]?.messages.map((m) => m.sender)
      expect(senders).toContain('Alice')
      expect(senders).toContain('Bob')
      expect(senders).toContain('Charlie')
    })

    it('averages funScore and interestingScore across merged activities', () => {
      const act1 = createTestActivity({
        activity: 'pottery',
        funScore: 0.8,
        interestingScore: 0.6
      })
      const act2 = createTestActivity({
        activity: 'pottery',
        funScore: 0.6,
        interestingScore: 0.4
      })
      const act3 = createTestActivity({
        activity: 'pottery',
        funScore: 0.7,
        interestingScore: 0.5
      })

      const result = deduplicateActivities([act1, act2, act3])

      expect(result).toHaveLength(1)
      expect(result[0]?.funScore).toBe(0.7) // (0.8 + 0.6 + 0.7) / 3 = 0.7
      expect(result[0]?.interestingScore).toBe(0.5) // (0.6 + 0.4 + 0.5) / 3 = 0.5
      expect(result[0]?.score).toBe(1.7) // 0.5 * 2 + 0.7 = 1.7
    })

    it('keeps first occurrence as primary when merging', () => {
      const activities = [
        createActivity(1, 'pottery class', 'Old City', new Date('2022-01-01')),
        createActivity(2, 'Pottery Class', 'New City', new Date('2024-01-01'))
      ]

      const result = deduplicateActivities(activities)

      expect(result).toHaveLength(1)
      // First occurrence is the primary
      expect(result[0]?.activity).toBe('pottery class')
      expect(result[0]?.city).toBe('Old City')
    })
  })

  describe('filterByMentionCount', () => {
    it('filters activities below minimum count', () => {
      const act1 = createActivity(1, 'once')
      const act2 = createTestActivity({
        activity: 'thrice',
        messages: [
          { id: 2, sender: 'A', timestamp: new Date(), message: 'thrice' },
          { id: 3, sender: 'B', timestamp: new Date(), message: 'thrice' },
          { id: 4, sender: 'C', timestamp: new Date(), message: 'thrice' }
        ]
      })
      const act3 = createTestActivity({
        activity: 'five times',
        messages: [
          { id: 5, sender: 'A', timestamp: new Date(), message: 'five' },
          { id: 6, sender: 'B', timestamp: new Date(), message: 'five' },
          { id: 7, sender: 'C', timestamp: new Date(), message: 'five' },
          { id: 8, sender: 'D', timestamp: new Date(), message: 'five' },
          { id: 9, sender: 'E', timestamp: new Date(), message: 'five' }
        ]
      })

      const result = filterByMentionCount([act1, act2, act3], 3)

      expect(result).toHaveLength(2)
      expect(result.map((r) => getMentionCount(r))).toEqual([3, 5])
    })
  })

  describe('getMostWanted', () => {
    it('returns only activities mentioned more than once', () => {
      const raw = [
        createActivity(1, 'once'),
        createActivity(2, 'twice'),
        createActivity(3, 'twice'),
        createActivity(4, 'thrice'),
        createActivity(5, 'thrice'),
        createActivity(6, 'thrice')
      ]

      const deduped = deduplicateActivities(raw)
      const result = getMostWanted(deduped)

      expect(result).toHaveLength(2)
      expect(result.every((r) => getMentionCount(r) > 1)).toBe(true)
    })

    it('respects limit parameter', () => {
      const raw = [
        createActivity(1, 'a'),
        createActivity(2, 'a'),
        createActivity(3, 'b'),
        createActivity(4, 'b'),
        createActivity(5, 'c'),
        createActivity(6, 'c')
      ]

      const deduped = deduplicateActivities(raw)
      const result = getMostWanted(deduped, 2)

      expect(result).toHaveLength(2)
    })
  })
})
