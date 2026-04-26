import { describe, expect, it } from 'vitest'
import { detectChatSource, parseChat, parseChatStream } from './index'
import { isLineExport, parseLineChat } from './line'

const SAMPLE_EXPORT = `[LINE] Chat history with Travel Friends
Saved on: 26/04/2026, 04:36PM

Sun, 26/04/2026
04:35PM\tAlex\tLet's try the ramen place https://example.com.
04:36PM\tMaya\t[Sticker]
`

describe('LINE parser', () => {
  it('detects LINE text exports', () => {
    expect(isLineExport(SAMPLE_EXPORT)).toBe(true)
    expect(detectChatSource(SAMPLE_EXPORT)).toBe('line')
  })

  it('parses tab-separated LINE messages', () => {
    const messages = parseLineChat(SAMPLE_EXPORT)

    expect(messages).toHaveLength(2)
    expect(messages[0]?.id).toBe(0)
    expect(messages[0]?.sender).toBe('Alex')
    expect(messages[0]?.content).toBe("Let's try the ramen place https://example.com.")
    expect(messages[0]?.source).toBe('line')
    expect(messages[0]?.timestamp).toEqual(new Date(2026, 3, 26, 16, 35, 0))
    expect(messages[0]?.urls).toEqual(['https://example.com'])
  })

  it('detects LINE media placeholders', () => {
    const messages = parseLineChat(SAMPLE_EXPORT)

    expect(messages[1]?.content).toBe('[Sticker]')
    expect(messages[1]?.hasMedia).toBe(true)
    expect(messages[1]?.mediaType).toBe('sticker')
  })

  it('parses year-first date lines and 24-hour times', () => {
    const raw = `[LINE] Chat history with Travel Friends

2026.04.26 Sunday
16:35\tAlex\tDinner tomorrow?
`

    const messages = parseLineChat(raw)

    expect(messages).toHaveLength(1)
    expect(messages[0]?.timestamp).toEqual(new Date(2026, 3, 26, 16, 35, 0))
  })

  it('preserves continuation lines in multi-line messages', () => {
    const raw = `[LINE] Chat history with Travel Friends

Sun, 26/04/2026
04:35PM\tAlex\tFirst line
second line
04:36PM\tMaya\tNext message
`

    const messages = parseLineChat(raw)

    expect(messages).toHaveLength(2)
    expect(messages[0]?.content).toBe('First line\nsecond line')
    expect(messages[0]?.rawLine).toContain('second line')
  })

  it('routes LINE exports through parseChat auto-detection', () => {
    const messages = parseChat(SAMPLE_EXPORT)

    expect(messages).toHaveLength(2)
    expect(messages[0]?.source).toBe('line')
  })

  it('streams LINE messages', async () => {
    const lines = (async function* () {
      yield '[LINE] Chat history with Travel Friends'
      yield ''
      yield 'Sun, 26/04/2026'
      yield '04:35PM\tAlex\tOne'
      yield '04:36PM\tMaya\tTwo'
    })()
    const messages = []

    for await (const message of parseChatStream(lines, 'line')) {
      messages.push(message)
    }

    expect(messages).toHaveLength(2)
    expect(messages[0]?.content).toBe('One')
    expect(messages[1]?.sender).toBe('Maya')
  })

  it('does not detect generic text as LINE', () => {
    expect(isLineExport('Some random text')).toBe(false)
    expect(detectChatSource('Some random text')).toBe('whatsapp')
  })
})
