/**
 * Activity Categories
 *
 * Source of truth for valid categories and their emoji.
 * Used across classifier, images, exports, and UI.
 */

export const VALID_CATEGORIES = [
  'food',
  'nightlife',
  'nature',
  'arts',
  'culture',
  'music',
  'entertainment',
  'events',
  'sports',
  'fitness',
  'wellness',
  'shopping',
  'travel',
  'experiences',
  'hobbies',
  'gaming',
  'learning',
  'home',
  'work',
  'social',
  'family',
  'pets',
  'other'
] as const

export type ActivityCategory = (typeof VALID_CATEGORIES)[number]

/** Emoji for each activity category */
export const CATEGORY_EMOJI: Record<ActivityCategory, string> = {
  food: '🍽️',
  nightlife: '🍸',
  nature: '🌲',
  arts: '🎨',
  culture: '🏛️',
  music: '🎵',
  entertainment: '🎬',
  events: '🎉',
  sports: '⚽',
  fitness: '💪',
  wellness: '🧘',
  shopping: '🛍️',
  travel: '✈️',
  experiences: '✨',
  hobbies: '🎯',
  gaming: '🎮',
  learning: '📚',
  home: '🏠',
  work: '💼',
  social: '👥',
  family: '👨‍👩‍👧',
  pets: '🐾',
  other: '📍'
}
