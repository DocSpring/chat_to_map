/**
 * Shared JSON parsing helpers used by document-based chat parsers
 * (Telegram, Messenger, iMessage JSON bundles).
 */

import type { MediaType } from '../types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

export function hasValue(record: Record<string, unknown>, key: string): boolean {
  const value = record[key]
  return value !== undefined && value !== null && value !== ''
}

export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

/**
 * Parse a JSON document and throw a parser-specific error on failure.
 */
export function parseJsonOrThrow(raw: string, errorMessage: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new Error(errorMessage)
  }
}

/**
 * Deduplicate URLs while preserving insertion order.
 */
export function dedupeUrls(urls: readonly string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const url of urls) {
    if (!seen.has(url)) {
      unique.push(url)
      seen.add(url)
    }
  }

  return unique
}

/**
 * Return the trimmed content, or fall back to a `[mediaType]` placeholder
 * when the message has no text but did carry media.
 */
export function applyMediaPlaceholder(content: string, mediaType: MediaType | undefined): string {
  if (content.length > 0) {
    return content
  }
  return mediaType ? `[${mediaType}]` : ''
}
