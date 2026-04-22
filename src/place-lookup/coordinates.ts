import type { GeocodedActivity } from '../types'

/**
 * Count activities with coordinates.
 */
export function countWithCoordinates(activities: readonly GeocodedActivity[]): number {
  return activities.filter((a) => a.latitude !== undefined && a.longitude !== undefined).length
}

/**
 * Filter to only activities with coordinates.
 */
export function filterWithCoordinates(activities: readonly GeocodedActivity[]): GeocodedActivity[] {
  return activities.filter(
    (a): a is GeocodedActivity & { latitude: number; longitude: number } =>
      a.latitude !== undefined && a.longitude !== undefined
  )
}

/**
 * Calculate the center point of activities with coordinates.
 */
export function calculateCenter(
  activities: readonly GeocodedActivity[]
): { lat: number; lng: number } | null {
  const withCoords = filterWithCoordinates(activities)

  if (withCoords.length === 0) {
    return null
  }

  const sumLat = withCoords.reduce((sum, a) => sum + (a.latitude as number), 0)
  const sumLng = withCoords.reduce((sum, a) => sum + (a.longitude as number), 0)

  return {
    lat: sumLat / withCoords.length,
    lng: sumLng / withCoords.length
  }
}
