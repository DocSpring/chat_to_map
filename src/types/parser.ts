/**
 * Parser Types
 *
 * Types for chat parsing and message representation.
 */

export type ChatSource = 'whatsapp' | 'imessage' | 'telegram' | 'line'

export type WhatsAppFormat = 'ios' | 'android' | 'auto'

export type MediaType = 'image' | 'video' | 'audio' | 'gif' | 'sticker' | 'document' | 'contact'

export interface ParsedMessage {
  readonly id: number
  readonly timestamp: Date
  readonly sender: string
  readonly content: string
  readonly rawLine: string
  readonly hasMedia: boolean
  readonly mediaType?: MediaType | undefined
  readonly urls?: readonly string[] | undefined
  readonly source: ChatSource
  /** Chunk index when a long message is split (0 = first/only, 1+ = continuation) */
  readonly chunkIndex?: number | undefined
  /** Source chat identifier when the upload bundles multiple chats (iMessage desktop export) */
  readonly chatId?: string | undefined
}

/** Metadata for one chat inside a multi-chat upload bundle. */
export interface ChatMetadata {
  /** Stable ID within the bundle, e.g. `chat_001`. */
  readonly id: string
  readonly name: string
  readonly identifier: string
  readonly messageCount: number
}

export type UrlType =
  | 'google_maps'
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'x'
  | 'facebook'
  | 'facebook_group'
  | 'airbnb'
  | 'booking'
  | 'tripadvisor'
  | 'event'
  | 'website'

export interface ParserOptions {
  readonly format?: WhatsAppFormat
  readonly timezone?: string
}

export interface ParseResult {
  readonly messages: readonly ParsedMessage[]
  readonly senders: readonly string[]
  readonly dateRange: {
    readonly start: Date
    readonly end: Date
  }
  readonly messageCount: number
  readonly urlCount: number
  /** Per-chat metadata when the upload was a multi-chat bundle. */
  readonly chats?: readonly ChatMetadata[]
}
