/**
 * Map Export Types
 */

interface MapMessage {
  sender: string
  date: string
  message: string
}

export interface MapPoint {
  lat: number
  lng: number
  sender: string
  activity: string
  activityId: string
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
  points: MapPoint[]
  senderColors: Record<string, string>
}
