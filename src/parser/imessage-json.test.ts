import { describe, expect, it } from 'vitest'
import {
  type IMessageJsonChat,
  type IMessageJsonChatEntry,
  type IMessageJsonManifest,
  type IMessageJsonMessage,
  isIMessageJsonChat,
  isIMessageJsonManifest,
  parseIMessageJsonBundle
} from './imessage-json'

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function makeManifest(overrides: Partial<IMessageJsonManifest> = {}): IMessageJsonManifest {
  return {
    version: '1.0',
    source: 'imessage',
    chat_count: 1,
    total_messages: 0,
    ...overrides
  }
}

function makeMessage(overrides: Partial<IMessageJsonMessage> = {}): IMessageJsonMessage {
  return {
    timestamp: '2025-04-02T08:52:29.000Z',
    sender: 'Alice',
    is_from_me: false,
    text: 'Hello',
    ...overrides
  }
}

function makeChat(name: string, messages: readonly IMessageJsonMessage[]): IMessageJsonChat {
  return {
    meta: {
      name,
      identifier: `+1555${name.length.toString().padStart(7, '0')}`,
      service: 'iMessage',
      message_count: messages.length
    },
    messages
  }
}

function makeEntry(id: string, chat: IMessageJsonChat): IMessageJsonChatEntry {
  return { id, chat }
}

// ---------------------------------------------------------------------------
// Manifest type guard
// ---------------------------------------------------------------------------

describe('isIMessageJsonManifest', () => {
  it('accepts a valid manifest', () => {
    expect(isIMessageJsonManifest(makeManifest({ chat_count: 3, total_messages: 42 }))).toBe(true)
  })

  it('rejects wrong source', () => {
    expect(isIMessageJsonManifest({ ...makeManifest(), source: 'whatsapp' })).toBe(false)
  })

  it('rejects missing fields', () => {
    expect(isIMessageJsonManifest({ source: 'imessage' })).toBe(false)
    expect(isIMessageJsonManifest(null)).toBe(false)
    expect(isIMessageJsonManifest('not an object')).toBe(false)
  })

  it('rejects wrong field types', () => {
    expect(isIMessageJsonManifest({ ...makeManifest(), chat_count: '3' })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Chat type guard
// ---------------------------------------------------------------------------

describe('isIMessageJsonChat', () => {
  it('accepts a valid chat', () => {
    expect(isIMessageJsonChat(makeChat('A', [makeMessage()]))).toBe(true)
  })

  it('rejects missing meta', () => {
    expect(isIMessageJsonChat({ messages: [] })).toBe(false)
  })

  it('rejects malformed messages', () => {
    const bad = {
      meta: { name: 'A', identifier: 'x', service: 'iMessage', message_count: 1 },
      messages: [{ timestamp: '2025-04-02T00:00:00Z', sender: 'A', text: 'hi' }] // missing is_from_me
    }
    expect(isIMessageJsonChat(bad)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Bundle parsing
// ---------------------------------------------------------------------------

describe('parseIMessageJsonBundle', () => {
  it('parses a single chat with multiple messages', () => {
    const chat = makeChat('Travel', [
      makeMessage({ timestamp: '2025-04-02T08:00:00Z', sender: 'Alice', text: 'Try the cafe' }),
      makeMessage({ timestamp: '2025-04-02T09:00:00Z', is_from_me: true, text: 'Sure!' })
    ])
    const result = parseIMessageJsonBundle(makeManifest({ chat_count: 1, total_messages: 2 }), [
      makeEntry('chat_001', chat)
    ])

    expect(result.messageCount).toBe(2)
    expect(result.messages[0]?.sender).toBe('Alice')
    expect(result.messages[0]?.content).toBe('Try the cafe')
    expect(result.messages[0]?.source).toBe('imessage')
    expect(result.messages[0]?.chatId).toBe('chat_001')
    expect(result.messages[1]?.sender).toBe('Me')
    expect(result.messages[1]?.chatId).toBe('chat_001')
    expect(result.chats).toHaveLength(1)
    expect(result.chats?.[0]?.name).toBe('Travel')
  })

  it('preserves chatId across multi-chat bundles', () => {
    const chatA = makeChat('Travel', [makeMessage({ text: 'cafe melt' })])
    const chatB = makeChat('Sports', [makeMessage({ text: 'gym session' })])
    const chatC = makeChat('Work', [makeMessage({ text: 'lunch spot' })])

    const result = parseIMessageJsonBundle(makeManifest({ chat_count: 3, total_messages: 3 }), [
      makeEntry('chat_001', chatA),
      makeEntry('chat_002', chatB),
      makeEntry('chat_003', chatC)
    ])

    expect(result.messages.map((m) => m.chatId)).toEqual(['chat_001', 'chat_002', 'chat_003'])
    expect(result.chats?.map((c) => c.name)).toEqual(['Travel', 'Sports', 'Work'])
  })

  it('assigns globally unique IDs across chats', () => {
    const chatA = makeChat('A', [makeMessage({ text: 'one' }), makeMessage({ text: 'two' })])
    const chatB = makeChat('B', [makeMessage({ text: 'three' })])

    const result = parseIMessageJsonBundle(makeManifest({ chat_count: 2, total_messages: 3 }), [
      makeEntry('chat_001', chatA),
      makeEntry('chat_002', chatB)
    ])

    expect(result.messages.map((m) => m.id)).toEqual([0, 1, 2])
  })

  it('throws when manifest chat_count does not match entries', () => {
    expect(() =>
      parseIMessageJsonBundle(makeManifest({ chat_count: 2, total_messages: 1 }), [
        makeEntry('chat_001', makeChat('A', [makeMessage()]))
      ])
    ).toThrow(/chat_count=2/)
  })

  it('skips messages with empty text', () => {
    const chat = makeChat('A', [
      makeMessage({ text: '' }),
      makeMessage({ text: '   ' }),
      makeMessage({ text: 'real content' })
    ])
    const result = parseIMessageJsonBundle(makeManifest({ chat_count: 1 }), [
      makeEntry('chat_001', chat)
    ])
    expect(result.messageCount).toBe(1)
    expect(result.messages[0]?.content).toBe('real content')
  })

  it('skips messages with invalid timestamps', () => {
    const chat = makeChat('A', [
      makeMessage({ timestamp: 'not-a-date', text: 'broken' }),
      makeMessage({ timestamp: '2025-04-02T08:00:00Z', text: 'ok' })
    ])
    const result = parseIMessageJsonBundle(makeManifest({ chat_count: 1 }), [
      makeEntry('chat_001', chat)
    ])
    expect(result.messageCount).toBe(1)
    expect(result.messages[0]?.content).toBe('ok')
  })

  it('extracts URLs from message text', () => {
    const chat = makeChat('A', [
      makeMessage({ text: 'Check https://example.com/cafe and https://maps.app/x' })
    ])
    const result = parseIMessageJsonBundle(makeManifest({ chat_count: 1 }), [
      makeEntry('chat_001', chat)
    ])
    expect(result.messages[0]?.urls).toEqual(['https://example.com/cafe', 'https://maps.app/x'])
  })

  it('chunks long messages and propagates chatId to every chunk', () => {
    const longText = 'A'.repeat(700)
    const chat = makeChat('A', [makeMessage({ text: longText })])
    const result = parseIMessageJsonBundle(makeManifest({ chat_count: 1 }), [
      makeEntry('chat_001', chat)
    ])
    expect(result.messages.length).toBeGreaterThan(1)
    for (const msg of result.messages) {
      expect(msg.chatId).toBe('chat_001')
    }
  })

  it('uses "Me" sender label when is_from_me is true', () => {
    const chat = makeChat('A', [
      makeMessage({ sender: 'Some Name', is_from_me: true, text: 'mine' })
    ])
    const result = parseIMessageJsonBundle(makeManifest({ chat_count: 1 }), [
      makeEntry('chat_001', chat)
    ])
    expect(result.messages[0]?.sender).toBe('Me')
  })

  it('falls back to Unknown when sender is empty for non-self messages', () => {
    const chat = makeChat('A', [makeMessage({ sender: '   ', text: 'who?' })])
    const result = parseIMessageJsonBundle(makeManifest({ chat_count: 1 }), [
      makeEntry('chat_001', chat)
    ])
    expect(result.messages[0]?.sender).toBe('Unknown')
  })

  it('collects unique senders across chats', () => {
    const chatA = makeChat('A', [makeMessage({ sender: 'Alice' }), makeMessage({ sender: 'Bob' })])
    const chatB = makeChat('B', [makeMessage({ sender: 'Bob' }), makeMessage({ sender: 'Carol' })])
    const result = parseIMessageJsonBundle(makeManifest({ chat_count: 2 }), [
      makeEntry('chat_001', chatA),
      makeEntry('chat_002', chatB)
    ])
    expect(result.senders).toEqual(['Alice', 'Bob', 'Carol'])
  })

  it('computes a date range across all chats', () => {
    const chatA = makeChat('A', [makeMessage({ timestamp: '2025-04-02T08:00:00Z' })])
    const chatB = makeChat('B', [makeMessage({ timestamp: '2025-04-05T22:00:00Z' })])
    const result = parseIMessageJsonBundle(makeManifest({ chat_count: 2 }), [
      makeEntry('chat_001', chatA),
      makeEntry('chat_002', chatB)
    ])
    expect(result.dateRange.start.toISOString()).toBe('2025-04-02T08:00:00.000Z')
    expect(result.dateRange.end.toISOString()).toBe('2025-04-05T22:00:00.000Z')
  })

  it('returns empty result when all messages are filtered out', () => {
    const chat = makeChat('A', [makeMessage({ text: '' })])
    const result = parseIMessageJsonBundle(makeManifest({ chat_count: 1 }), [
      makeEntry('chat_001', chat)
    ])
    expect(result.messageCount).toBe(0)
    expect(result.chats).toHaveLength(1)
  })
})
