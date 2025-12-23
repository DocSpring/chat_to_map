/**
 * Default Activities
 *
 * Pre-defined activities by category for default image assignments.
 * These are common activities that we pre-cache images for on our CDN.
 */

import type { ActivityCategory } from './categories'

/**
 * Default activities for each category.
 * These are used to pre-fetch and cache images on the CDN.
 */
export const DEFAULT_ACTIVITIES: Record<ActivityCategory, readonly string[]> = {
  food: [
    'restaurant',
    'cafe',
    'bakery',
    'brunch',
    'dinner',
    'lunch',
    'breakfast',
    'sushi',
    'pizza',
    'burger',
    'tacos',
    'ramen',
    'thai food',
    'indian food',
    'italian food',
    'mexican food',
    'chinese food',
    'korean bbq',
    'seafood',
    'steakhouse',
    'vegetarian',
    'vegan',
    'food truck',
    'ice cream',
    'dessert',
    'coffee',
    'wine bar',
    'brewery',
    'food market',
    'farmers market'
  ],

  nightlife: [
    'bar',
    'pub',
    'club',
    'cocktail bar',
    'rooftop bar',
    'dive bar',
    'sports bar',
    'karaoke',
    'live music venue',
    'jazz club',
    'comedy club',
    'nightclub',
    'lounge',
    'beer garden'
  ],

  nature: [
    'hiking',
    'beach',
    'park',
    'camping',
    'fishing',
    'kayaking',
    'surfing',
    'swimming',
    'snorkeling',
    'diving',
    'mountain biking',
    'rock climbing',
    'trail running',
    'bird watching',
    'stargazing',
    'waterfall',
    'forest walk',
    'lake',
    'river',
    'national park',
    'botanical garden',
    'picnic',
    'sunset viewing',
    'sunrise hike'
  ],

  arts: [
    'art gallery',
    'art museum',
    'art class',
    'painting',
    'drawing',
    'sculpture',
    'pottery',
    'ceramics',
    'photography',
    'street art tour',
    'art exhibition',
    'art fair',
    'craft workshop',
    'glassblowing',
    'printmaking'
  ],

  culture: [
    'museum',
    'history museum',
    'science museum',
    'cultural center',
    'heritage site',
    'historic landmark',
    'architecture tour',
    'walking tour',
    'temple',
    'cathedral',
    'castle',
    'palace',
    'ancient ruins',
    'cultural festival',
    'traditional market'
  ],

  music: [
    'concert',
    'live music',
    'music festival',
    'open mic',
    'orchestra',
    'opera',
    'jazz performance',
    'classical music',
    'rock concert',
    'indie show',
    'dj set',
    'music lesson',
    'guitar lesson',
    'piano lesson',
    'singing lesson'
  ],

  entertainment: [
    'movie',
    'cinema',
    'theater',
    'musical',
    'comedy show',
    'magic show',
    'circus',
    'escape room',
    'bowling',
    'mini golf',
    'arcade',
    'laser tag',
    'go karts',
    'trampoline park',
    'theme park',
    'water park',
    'zoo',
    'aquarium',
    'planetarium'
  ],

  events: [
    'festival',
    'fair',
    'parade',
    'fireworks',
    'market',
    'flea market',
    'night market',
    'food festival',
    'beer festival',
    'wine tasting',
    'block party',
    'street festival',
    'holiday event',
    'pop-up event',
    'exhibition'
  ],

  sports: [
    'soccer',
    'football',
    'basketball',
    'baseball',
    'tennis',
    'golf',
    'volleyball',
    'badminton',
    'table tennis',
    'cricket',
    'rugby',
    'hockey',
    'skiing',
    'snowboarding',
    'ice skating',
    'skateboarding',
    'sports game',
    'stadium tour'
  ],

  fitness: [
    'gym',
    'yoga',
    'pilates',
    'crossfit',
    'spin class',
    'boxing',
    'kickboxing',
    'martial arts',
    'running',
    'jogging',
    'cycling',
    'swimming laps',
    'weight training',
    'personal training',
    'fitness class',
    'boot camp',
    'barre',
    'dance fitness'
  ],

  wellness: [
    'spa',
    'massage',
    'sauna',
    'hot springs',
    'meditation',
    'wellness retreat',
    'facial',
    'acupuncture',
    'float tank',
    'cryotherapy',
    'sound bath',
    'breathwork',
    'wellness workshop',
    'detox retreat'
  ],

  shopping: [
    'mall',
    'outlet shopping',
    'boutique',
    'vintage shopping',
    'thrift store',
    'bookstore',
    'record store',
    'antique shopping',
    'craft market',
    'souvenir shopping',
    'fashion shopping',
    'home decor shopping',
    'electronics shopping',
    'grocery shopping'
  ],

  travel: [
    'road trip',
    'weekend getaway',
    'beach vacation',
    'city break',
    'backpacking',
    'cruise',
    'train journey',
    'flight',
    'hotel stay',
    'airbnb',
    'hostel',
    'resort',
    'sightseeing',
    'day trip',
    'adventure travel'
  ],

  experiences: [
    'hot air balloon',
    'helicopter tour',
    'boat tour',
    'wine tour',
    'food tour',
    'ghost tour',
    'segway tour',
    'zip lining',
    'bungee jumping',
    'skydiving',
    'paragliding',
    'sailing',
    'sunset cruise',
    'whale watching',
    'safari'
  ],

  hobbies: [
    'photography walk',
    'birdwatching',
    'gardening',
    'cooking class',
    'baking class',
    'sewing class',
    'knitting',
    'woodworking',
    'model building',
    'collecting',
    'reading club',
    'writing workshop',
    'journaling',
    'scrapbooking'
  ],

  gaming: [
    'video games',
    'board games',
    'card games',
    'trivia night',
    'puzzle room',
    'lan party',
    'gaming cafe',
    'vr gaming',
    'tabletop gaming',
    'chess',
    'poker night',
    'game tournament'
  ],

  learning: [
    'workshop',
    'class',
    'lecture',
    'seminar',
    'language class',
    'coding bootcamp',
    'online course',
    'book club',
    'study group',
    'tutoring',
    'museum tour',
    'documentary screening',
    'ted talk',
    'skill share'
  ],

  home: [
    'movie night',
    'game night',
    'dinner party',
    'bbq',
    'house party',
    'potluck',
    'home cooking',
    'gardening',
    'home improvement',
    'decorating',
    'cleaning',
    'organizing',
    'netflix',
    'reading'
  ],

  work: [
    'meeting',
    'conference',
    'networking event',
    'team building',
    'office party',
    'coworking',
    'business lunch',
    'presentation',
    'training',
    'workshop',
    'trade show',
    'career fair'
  ],

  social: [
    'party',
    'gathering',
    'meetup',
    'hangout',
    'catch up',
    'coffee date',
    'drinks',
    'dinner with friends',
    'birthday party',
    'celebration',
    'reunion',
    'networking',
    'club meeting',
    'group activity'
  ],

  family: [
    'family dinner',
    'family outing',
    'kids activities',
    'playground',
    'family movie',
    'family game night',
    'family vacation',
    'family reunion',
    'birthday party',
    'holiday gathering',
    'school event',
    'sports practice',
    'recital',
    'graduation'
  ],

  pets: [
    'dog park',
    'pet store',
    'vet visit',
    'dog walking',
    'pet grooming',
    'dog training',
    'cat cafe',
    'pet adoption',
    'pet sitting',
    'dog beach',
    'pet friendly cafe',
    'pet photography'
  ],

  other: [
    'appointment',
    'errand',
    'task',
    'chore',
    'maintenance',
    'repair',
    'service',
    'miscellaneous'
  ]
} as const

/**
 * Get all default activities as a flat list.
 */
export function getAllDefaultActivities(): string[] {
  return Object.values(DEFAULT_ACTIVITIES).flat()
}

/**
 * Get default activities for a specific category.
 */
export function getDefaultActivitiesForCategory(category: ActivityCategory): readonly string[] {
  return DEFAULT_ACTIVITIES[category]
}

/**
 * Check if an activity matches a default activity (case-insensitive).
 */
export function isDefaultActivity(activity: string): boolean {
  const normalized = activity.toLowerCase().trim()
  return getAllDefaultActivities().some((a) => a.toLowerCase() === normalized)
}

/**
 * Find the best matching default activity for a given activity string.
 * Returns null if no close match is found.
 */
export function findMatchingDefaultActivity(
  activity: string,
  category?: ActivityCategory
): string | null {
  const normalized = activity.toLowerCase().trim()
  const activities = category ? DEFAULT_ACTIVITIES[category] : getAllDefaultActivities()

  // Exact match
  const exact = activities.find((a) => a.toLowerCase() === normalized)
  if (exact) return exact

  // Contains match (activity contains default or default contains activity)
  const contains = activities.find(
    (a) => normalized.includes(a.toLowerCase()) || a.toLowerCase().includes(normalized)
  )
  if (contains) return contains

  return null
}
