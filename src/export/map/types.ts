/**
 * Map Export Types
 */

import type { ActivityCategory } from '../../categories'

interface MapMessage {
  sender: string
  date: string
  message: string
}

export interface MapActivity {
  lat: number | null
  lng: number | null
  sender: string
  activity: string
  activityId: string
  category: ActivityCategory
  location: string
  date: string
  score: number
  url: string | null
  color: string
  imagePath: string | null
  placeId: string | null
  messages: MapMessage[]
}

export interface MapData {
  title: string
  center: { lat: number; lng: number }
  zoom: number
  clusterMarkers: boolean
  defaultStyle: 'osm' | 'satellite' | 'terrain'
  /** Whether images are enabled (determines thumbnail rendering) */
  hasImages: boolean
  /** All activities (filter by lat/lng !== null for map pins) */
  activities: MapActivity[]
  senderColors: Record<string, string>
  /** Lucide SVG icons keyed by category */
  categoryIcons: Record<string, string>
  /** Background colors keyed by category */
  categoryColors: Record<string, string>
}
