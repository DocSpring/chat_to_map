/**
 * Map Export Utilities
 */

import type { MapPoint } from './types'

export const DEFAULT_ZOOM = 6

export const MARKER_COLORS = [
  'blue',
  'red',
  'green',
  'purple',
  'orange',
  'darkred',
  'darkblue',
  'darkgreen'
]

/**
 * Calculate the center point from a list of coordinates.
 */
export function calculateCenter(points: readonly MapPoint[]): { lat: number; lng: number } {
  if (points.length === 0) {
    return { lat: 0, lng: 0 }
  }

  const sumLat = points.reduce((sum, p) => sum + p.lat, 0)
  const sumLng = points.reduce((sum, p) => sum + p.lng, 0)

  return {
    lat: sumLat / points.length,
    lng: sumLng / points.length
  }
}

/**
 * Extract URL from message text.
 */
export function extractUrl(message: string): string | null {
  const match = message.match(/https?:\/\/[^\s]+/i)
  return match ? match[0] : null
}
