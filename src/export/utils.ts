/**
 * Export Utilities
 *
 * Shared utility functions for all export formats.
 */

/**
 * Format a date as YYYY-MM-DD.
 * Handles Date objects and ISO date strings (from JSON deserialization).
 */
export function formatDate(date: Date | string | undefined): string {
  if (!date) return ''
  if (typeof date === 'string') {
    return date.split('T')[0] ?? ''
  }
  return date.toISOString().split('T')[0] ?? ''
}

/**
 * Format a time as HH:MM:SS.
 * Handles Date objects and ISO date strings (from JSON deserialization).
 */
export function formatTime(date: Date | string | undefined): string {
  if (!date) return ''
  if (typeof date === 'string') {
    return date.split('T')[1]?.split('.')[0] ?? ''
  }
  return date.toTimeString().split(' ')[0] ?? ''
}

/**
 * Generate a Google Maps link for coordinates.
 */
export function googleMapsLink(lat?: number, lng?: number): string {
  if (lat === undefined || lng === undefined) {
    return ''
  }
  return `https://www.google.com/maps?q=${lat},${lng}`
}
