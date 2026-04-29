import { describe, expect, it } from 'vitest'
import { detectChatSource, parseChat, parseChatStream } from './index'
import { isMessengerExport, parseMessengerExport } from './messenger'

interface MessengerMessage {
  isUnsent?: boolean
  media?: ReadonlyArray<{ uri: string }>
  reactions?: ReadonlyArray<{ actor: string; reaction: string }>
  senderName: string
  text: string
  timestamp: number
  type: 'text' | 'link' | 'media' | 'placeholder'
}

function messengerMessage(overrides: Partial<MessengerMessage>): MessengerMessage {
  return {
    isUnsent: false,
    media: [],
    reactions: [],
    senderName: 'Alice',
    text: 'Hello',
    timestamp: 1711913758573,
    type: 'text',
    ...overrides
  }
}

function messengerExport(messages: readonly MessengerMessage[]): string {
  return JSON.stringify({
    participants: ['Alice', 'Bob'],
    threadName: 'Bob_15',
    messages
  })
}

describe('Messenger parser', () => {
  it('detects Messenger chat JSON exports', () => {
    const raw = messengerExport([messengerMessage({ text: 'Hello' })])

    expect(isMessengerExport(raw)).toBe(true)
    expect(detectChatSource(raw)).toBe('messenger')
  })

  it('does not treat generic JSON as Messenger', () => {
    const raw = JSON.stringify({ messages: [{ content: 'Hello' }] })

    expect(isMessengerExport(raw)).toBe(false)
    expect(detectChatSource(raw)).toBe('whatsapp')
  })

  it('does not confuse Telegram exports with Messenger', () => {
    const raw = JSON.stringify({
      id: 1,
      name: 'Chat',
      type: 'private_group',
      messages: [{ id: 1, type: 'message', date: '2025-01-01', from: 'X', text: 'hi' }]
    })

    expect(isMessengerExport(raw)).toBe(false)
    expect(detectChatSource(raw)).toBe('telegram')
  })

  it('parses text messages with sender, timestamp, and content', () => {
    const raw = messengerExport([
      messengerMessage({
        senderName: 'Masha',
        text: 'I wanna go back to QT',
        timestamp: 1712167366660,
        type: 'text'
      })
    ])

    const messages = parseMessengerExport(raw)

    expect(messages).toHaveLength(1)
    expect(messages[0]?.id).toBe(0)
    expect(messages[0]?.sender).toBe('Masha')
    expect(messages[0]?.content).toBe('I wanna go back to QT')
    expect(messages[0]?.source).toBe('messenger')
    expect(messages[0]?.timestamp.toISOString()).toBe(new Date(1712167366660).toISOString())
  })

  it('extracts URLs from link messages', () => {
    const raw = messengerExport([
      messengerMessage({
        text: 'https://example.com/cafe',
        type: 'link'
      })
    ])

    const messages = parseMessengerExport(raw)

    expect(messages).toHaveLength(1)
    expect(messages[0]?.urls).toEqual(['https://example.com/cafe'])
  })

  it('marks media messages and substitutes content placeholder', () => {
    const raw = messengerExport([
      messengerMessage({
        text: '',
        media: [{ uri: 'photo.jpg' }],
        type: 'media'
      })
    ])

    const messages = parseMessengerExport(raw)

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('[image]')
    expect(messages[0]?.hasMedia).toBe(true)
    expect(messages[0]?.mediaType).toBe('image')
  })

  it('detects video media from file extension', () => {
    const raw = messengerExport([
      messengerMessage({
        text: '',
        media: [{ uri: 'clip.mp4' }],
        type: 'media'
      })
    ])

    const messages = parseMessengerExport(raw)

    expect(messages[0]?.mediaType).toBe('video')
    expect(messages[0]?.content).toBe('[video]')
  })

  it('skips placeholder messages (unsent)', () => {
    const raw = messengerExport([
      messengerMessage({
        text: 'User unsent a message',
        isUnsent: true,
        type: 'placeholder'
      }),
      messengerMessage({
        text: 'Real message',
        timestamp: 1712205546463,
        type: 'text'
      })
    ])

    const messages = parseMessengerExport(raw)

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('Real message')
  })

  it('skips media messages with failed downloads and no text', () => {
    const raw = messengerExport([
      messengerMessage({
        text: '',
        media: [],
        type: 'media'
      })
    ])

    const messages = parseMessengerExport(raw)

    expect(messages).toHaveLength(0)
  })

  it('chunks long Messenger messages and keeps URLs on the first chunk only', () => {
    const longContent = `Check https://example.com ${'word '.repeat(100)}`
    const raw = messengerExport([messengerMessage({ text: longContent })])

    const messages = parseMessengerExport(raw)

    expect(messages.length).toBeGreaterThan(1)
    expect(messages[0]?.urls).toEqual(['https://example.com'])
    expect(messages[0]?.chunkIndex).toBe(0)
    expect(messages[1]?.chunkIndex).toBe(1)
    expect(messages[1]?.urls).toBeUndefined()
  })

  it('routes Messenger exports through parseChat auto-detection', () => {
    const raw = messengerExport([messengerMessage({ senderName: 'Sam', text: 'Coffee tomorrow?' })])

    const messages = parseChat(raw)

    expect(messages).toHaveLength(1)
    expect(messages[0]?.sender).toBe('Sam')
    expect(messages[0]?.source).toBe('messenger')
  })

  it('rejects invalid JSON in the explicit parser', () => {
    expect(() => parseMessengerExport('{not valid json')).toThrow('Invalid Messenger export JSON')
  })

  it('rejects non-Messenger JSON in the explicit parser', () => {
    expect(() => parseMessengerExport(JSON.stringify({ foo: 'bar' }))).toThrow(
      'Invalid Messenger export JSON: expected participants and messages'
    )
  })

  it('rejects streaming Messenger JSON because it is document based', async () => {
    async function collect(): Promise<unknown[]> {
      const lines = (async function* () {
        yield messengerExport([])
      })()
      const messages: unknown[] = []
      for await (const message of parseChatStream(lines, 'messenger')) {
        messages.push(message)
      }
      return messages
    }

    await expect(collect()).rejects.toThrow('Messenger JSON exports must be parsed with parseChat')
  })
})
