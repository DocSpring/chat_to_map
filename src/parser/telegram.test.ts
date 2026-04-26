import { describe, expect, it } from 'vitest'
import { buildClassificationPrompt } from '../classifier/prompt'
import { extractCandidatesByHeuristics } from '../extraction'
import { detectChatSource, parseChat, parseChatStream } from './index'
import { isTelegramExport, parseTelegramExport } from './telegram'

function telegramExport(messages: readonly unknown[]): string {
  return JSON.stringify({
    id: 123,
    name: 'Planning chat',
    type: 'private_group',
    messages
  })
}

function telegramMessage(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 1,
    type: 'message',
    date: '2025-01-15T10:30:00',
    from: 'Alex',
    from_id: 'user123',
    text: 'Hello',
    text_entities: [],
    ...overrides
  }
}

function telegramResultJsonWithLateSuggestion(): string {
  return telegramExport([
    ...Array.from({ length: 79 }, (_, index) =>
      telegramMessage({
        id: 702 + index,
        date: `2026-04-26T12:${String(index % 60).padStart(2, '0')}:00`,
        from: 'Jill Bo',
        text: `OpenClaw access log ${index + 1}.`
      })
    ),
    telegramMessage({
      id: 5606,
      date: '2026-04-26T12:33:00',
      from: 'Jill Bo',
      text: 'Hello love. We should go to the moon'
    })
  ])
}

describe('Telegram parser', () => {
  it('detects Telegram Desktop JSON exports', () => {
    const raw = telegramExport([telegramMessage({ text: 'Hello' })])

    expect(isTelegramExport(raw)).toBe(true)
    expect(detectChatSource(raw)).toBe('telegram')
  })

  it('does not treat generic message JSON as Telegram', () => {
    const raw = JSON.stringify({ messages: [{ content: 'Hello' }] })

    expect(isTelegramExport(raw)).toBe(false)
    expect(detectChatSource(raw)).toBe('whatsapp')
  })

  it('skips service messages and parses message records', () => {
    const raw = telegramExport([
      {
        id: 0,
        type: 'service',
        date: '2025-01-15T10:00:00',
        actor: 'Alex',
        action: 'joined_telegram',
        text: ''
      },
      telegramMessage({
        id: 1,
        date_unixtime: '1736937000',
        from: 'Maya',
        text: 'Let us try the new ramen place'
      })
    ])

    const messages = parseTelegramExport(raw)

    expect(messages).toHaveLength(1)
    expect(messages[0]?.id).toBe(0)
    expect(messages[0]?.sender).toBe('Maya')
    expect(messages[0]?.content).toBe('Let us try the new ramen place')
    expect(messages[0]?.source).toBe('telegram')
    expect(messages[0]?.timestamp.toISOString()).toBe(new Date(1736937000 * 1000).toISOString())
  })

  it('flattens rich text arrays and extracts href URLs', () => {
    const raw = telegramExport([
      telegramMessage({
        text: [
          'Visit ',
          { type: 'text_link', text: 'Example Cafe', href: 'https://example.com/cafe' },
          ' and https://maps.example/place.'
        ],
        text_entities: [
          { type: 'text_link', text: 'Example Cafe', href: 'https://example.com/cafe' }
        ]
      })
    ])

    const messages = parseTelegramExport(raw)

    expect(messages[0]?.content).toBe('Visit Example Cafe and https://maps.example/place.')
    expect(messages[0]?.urls).toEqual(['https://maps.example/place', 'https://example.com/cafe'])
  })

  it('marks photo-only messages as media messages', () => {
    const raw = telegramExport([
      telegramMessage({
        text: '',
        photo: '(File not included. Change data exporting settings to download.)'
      })
    ])

    const messages = parseTelegramExport(raw)

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe('[image]')
    expect(messages[0]?.hasMedia).toBe(true)
    expect(messages[0]?.mediaType).toBe('image')
  })

  it('chunks long Telegram messages and keeps URLs on the first chunk only', () => {
    const longContent = `Check https://example.com ${'word '.repeat(100)}`
    const raw = telegramExport([telegramMessage({ text: longContent })])

    const messages = parseTelegramExport(raw)

    expect(messages.length).toBeGreaterThan(1)
    expect(messages[0]?.urls).toEqual(['https://example.com'])
    expect(messages[0]?.chunkIndex).toBe(0)
    expect(messages[1]?.chunkIndex).toBe(1)
    expect(messages[1]?.urls).toBeUndefined()
  })

  it('routes Telegram exports through parseChat auto-detection', () => {
    const raw = telegramExport([telegramMessage({ from: 'Sam', text: 'Coffee tomorrow?' })])

    const messages = parseChat(raw)

    expect(messages).toHaveLength(1)
    expect(messages[0]?.sender).toBe('Sam')
    expect(messages[0]?.source).toBe('telegram')
  })

  it('keeps late Telegram result.json candidate IDs explicit in classifier prompts', () => {
    const messages = parseChat(telegramResultJsonWithLateSuggestion())
    const result = extractCandidatesByHeuristics(messages)

    expect(messages).toHaveLength(80)
    expect(result.candidates.map((candidate) => candidate.messageId)).toEqual([79])

    const prompt = buildClassificationPrompt(result.candidates, {
      homeCountry: 'New Zealand',
      timezone: 'Pacific/Auckland'
    })

    expect(prompt).toContain('ID: 79 |')
    expect(prompt).toContain('>>> ID: 79 | Jill Bo: Hello love. We should go to the moon')
    expect(prompt).toContain('"msg": <exact ID from the >>> candidate line>')
  })

  it('rejects invalid Telegram JSON in the explicit parser', () => {
    expect(() => parseTelegramExport('{not valid json')).toThrow('Invalid Telegram export JSON')
  })

  it('rejects streaming Telegram JSON because it is document based', async () => {
    async function collect(): Promise<unknown[]> {
      const lines = (async function* () {
        yield telegramExport([])
      })()
      const messages: unknown[] = []
      for await (const message of parseChatStream(lines, 'telegram')) {
        messages.push(message)
      }
      return messages
    }

    await expect(collect()).rejects.toThrow('Telegram JSON exports must be parsed with parseChat')
  })
})
