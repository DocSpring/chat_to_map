/**
 * Map Data Transformation
 *
 * Converts GeocodedActivity[] to MapData for the map template.
 */

import { formatLocation, type GeocodedActivity, type MapConfig } from '../../types'
import { formatDate } from '../utils'
import type { MapData, MapPoint } from './types'
import { calculateCenter, DEFAULT_ZOOM, extractUrl, MARKER_COLORS } from './utils'

/**
 * Convert geocoded activities to map data structure.
 */
export function toMapData(
  activities: readonly GeocodedActivity[],
  config: MapConfig = {}
): MapData {
  const { points, senderColors } = toMapPoints(activities, config)

  const center = {
    lat: config.centerLat ?? calculateCenter(points).lat,
    lng: config.centerLng ?? calculateCenter(points).lng
  }

  return {
    title: config.title ?? 'Things To Do Map',
    center,
    zoom: config.zoom ?? DEFAULT_ZOOM,
    clusterMarkers: config.clusterMarkers !== false,
    points,
    senderColors: Object.fromEntries(senderColors)
  }
}

/**
 * Convert activities to map points with sender colors.
 */
function toMapPoints(
  activities: readonly GeocodedActivity[],
  config: MapConfig
): { points: MapPoint[]; senderColors: Map<string, string> } {
  // Get unique senders and assign colors
  const senders = [...new Set(activities.flatMap((s) => s.messages.map((m) => m.sender)))]
  const senderColors = new Map<string, string>()

  for (let i = 0; i < senders.length; i++) {
    const sender = senders[i]
    if (sender) {
      senderColors.set(sender, MARKER_COLORS[i % MARKER_COLORS.length] ?? 'blue')
    }
  }

  // Filter to geocoded activities and convert to points
  const points: MapPoint[] = []

  for (const s of activities) {
    if (s.latitude === undefined || s.longitude === undefined) {
      continue
    }

    const firstMessage = s.messages[0]
    const sender = firstMessage?.sender ?? 'Unknown'
    const color = config.colorBySender !== false ? (senderColors.get(sender) ?? 'blue') : 'blue'

    points.push({
      lat: s.latitude,
      lng: s.longitude,
      sender,
      activity: s.activity.slice(0, 100),
      activityId: s.activityId,
      location: formatLocation(s) ?? '',
      date: formatDate(firstMessage?.timestamp),
      score: s.score,
      url: firstMessage ? extractUrl(firstMessage.message) : null,
      color,
      imagePath: config.imagePaths?.get(s.activityId) ?? null,
      placeId: s.placeId ?? null,
      messages: s.messages.map((m) => ({
        sender: m.sender,
        date: formatDate(m.timestamp),
        message: m.message.slice(0, 200)
      }))
    })
  }

  return { points, senderColors }
}
