import { describe, expect, it } from 'vitest'
import {
  detectChatSource,
  normalizeApostrophes,
  parseChat,
  parseChatStream,
  parseChatWithStats
} from './index.js'

describe('Parser Module', () => {
  describe('normalizeApostrophes', () => {
    it('converts right single quotation mark (U+2019) to straight apostrophe', () => {
      const input = `Let\u2019s go to the café`
      const result = normalizeApostrophes(input)
      expect(result).toBe("Let's go to the café")
    })

    it('converts left single quotation mark (U+2018) to straight apostrophe', () => {
      const input = `\u2018twas the night before`
      const result = normalizeApostrophes(input)
      expect(result).toBe("'twas the night before")
    })

    it('converts modifier letter apostrophe (U+02BC) to straight apostrophe', () => {
      const input = `Let\u02BCs try this`
      const result = normalizeApostrophes(input)
      expect(result).toBe("Let's try this")
    })

    it('converts backtick to straight apostrophe', () => {
      const input = 'Let`s use backtick'
      const result = normalizeApostrophes(input)
      expect(result).toBe("Let's use backtick")
    })

    it('handles multiple apostrophe variants in one string', () => {
      const input = `Let\u2019s go, \u2018twas fun, let\u02BCs try it\`s great`
      const result = normalizeApostrophes(input)
      expect(result).toBe("Let's go, 'twas fun, let's try it's great")
    })

    it('preserves straight apostrophes', () => {
      const input = "Let's keep it simple"
      const result = normalizeApostrophes(input)
      expect(result).toBe("Let's keep it simple")
    })

    it('handles empty string', () => {
      expect(normalizeApostrophes('')).toBe('')
    })

    it('handles string with no apostrophes', () => {
      const input = 'No apostrophes here at all'
      expect(normalizeApostrophes(input)).toBe(input)
    })
  })

  describe('apostrophe normalization in parsing', () => {
    it('normalizes curly apostrophes in WhatsApp messages', () => {
      // Using curly apostrophe (U+2019) in the message
      const content = `[1/15/25, 10:30:00 AM] John: Let\u2019s go to the restaurant`
      const messages = parseChat(content)

      expect(messages).toHaveLength(1)
      expect(messages[0]?.content).toBe("Let's go to the restaurant")
      // Verify it's a straight apostrophe (U+0027)
      expect(messages[0]?.content.includes("'")).toBe(true)
    })

    it('normalizes curly apostrophes in iMessage messages', () => {
      // Using curly apostrophe (U+2019) in the message
      const content = `Jan 15, 2025  10:30:00 AM
John Doe
Let\u2019s check out that café`

      const messages = parseChat(content)

      expect(messages).toHaveLength(1)
      expect(messages[0]?.content).toBe("Let's check out that café")
    })

    it('normalizes multiple apostrophe variants in a message', () => {
      // Mix of curly right (U+2019), curly left (U+2018), modifier (U+02BC), and backtick
      const content = `[1/15/25, 10:30:00 AM] John: Let\u2019s go, \u2018twas fun, let\u02BCs try it\`s great`
      const messages = parseChat(content)

      expect(messages).toHaveLength(1)
      expect(messages[0]?.content).toBe("Let's go, 'twas fun, let's try it's great")
    })
  })

  describe('detectChatSource', () => {
    it('detects WhatsApp iOS format (brackets)', () => {
      const content = '[1/15/25, 10:30:00 AM] John: Hello'

      const source = detectChatSource(content)

      expect(source).toBe('whatsapp')
    })

    it('detects WhatsApp iOS format with 4-digit year', () => {
      const content = '[15/01/2025, 10:30:00] John: Hello'

      const source = detectChatSource(content)

      expect(source).toBe('whatsapp')
    })

    it('detects WhatsApp Android format (no brackets)', () => {
      const content = '1/15/25, 10:30 AM - John: Hello'

      const source = detectChatSource(content)

      expect(source).toBe('whatsapp')
    })

    it('detects iMessage format', () => {
      const content = 'Jan 15, 2025  10:30:00 AM'

      const source = detectChatSource(content)

      expect(source).toBe('imessage')
    })

    it('defaults to whatsapp for unknown format', () => {
      const content = 'Some random text that does not match any pattern'

      const source = detectChatSource(content)

      expect(source).toBe('whatsapp')
    })

    it('handles empty content', () => {
      const source = detectChatSource('')

      expect(source).toBe('whatsapp')
    })
  })

  describe('parseChat', () => {
    it('parses WhatsApp iOS messages', () => {
      const content = `[1/15/25, 10:30:00 AM] John: Hello
[1/15/25, 10:31:00 AM] Jane: Hi there!`

      const messages = parseChat(content)

      expect(messages).toHaveLength(2)
      expect(messages[0]?.sender).toBe('John')
      expect(messages[0]?.content).toBe('Hello')
      expect(messages[1]?.sender).toBe('Jane')
      expect(messages[1]?.content).toBe('Hi there!')
    })

    it('parses iMessage format', () => {
      const content = `Jan 15, 2025  10:30:00 AM
John Doe
Hello world

Jan 15, 2025  10:31:00 AM
Jane Smith
Hi there!`

      const messages = parseChat(content)

      expect(messages).toHaveLength(2)
      expect(messages[0]?.sender).toBe('John Doe')
      expect(messages[0]?.content).toBe('Hello world')
      expect(messages[1]?.sender).toBe('Jane Smith')
    })

    it('handles empty content', () => {
      const messages = parseChat('')

      expect(messages).toHaveLength(0)
    })

    it('passes options to WhatsApp parser', () => {
      const content = `[1/15/25, 10:30:00 AM] John: Hello
[1/15/25, 10:31:00 AM] John: World`

      const messages = parseChat(content, { format: 'ios' })

      // Implementation depends on parser behavior
      expect(messages.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('parseChatWithStats', () => {
    it('returns messages array', () => {
      const content = '[1/15/25, 10:30:00 AM] John: Hello'

      const result = parseChatWithStats(content)

      expect(result.messages).toHaveLength(1)
    })

    it('extracts unique senders', () => {
      const content = `[1/15/25, 10:30:00 AM] John: Hello
[1/15/25, 10:31:00 AM] Jane: Hi
[1/15/25, 10:32:00 AM] John: How are you?`

      const result = parseChatWithStats(content)

      expect(result.senders).toContain('John')
      expect(result.senders).toContain('Jane')
      expect(result.senders).toHaveLength(2)
    })

    it('calculates date range', () => {
      const content = `[1/10/25, 10:30:00 AM] John: First
[1/15/25, 10:30:00 AM] John: Last`

      const result = parseChatWithStats(content)

      expect(result.dateRange.start.getDate()).toBe(10)
      expect(result.dateRange.end.getDate()).toBe(15)
    })

    it('counts messages', () => {
      const content = `[1/15/25, 10:30:00 AM] John: One
[1/15/25, 10:31:00 AM] John: Two
[1/15/25, 10:32:00 AM] John: Three`

      const result = parseChatWithStats(content)

      expect(result.messageCount).toBe(3)
    })

    it('counts URLs', () => {
      const content = `[1/15/25, 10:30:00 AM] John: Check this https://example.com
[1/15/25, 10:31:00 AM] John: And this https://test.com and https://other.com`

      const result = parseChatWithStats(content)

      expect(result.urlCount).toBe(3)
    })

    it('handles empty content', () => {
      const result = parseChatWithStats('')

      expect(result.messages).toHaveLength(0)
      expect(result.senders).toHaveLength(0)
      expect(result.messageCount).toBe(0)
      expect(result.urlCount).toBe(0)
    })

    it('handles messages without URLs', () => {
      const content = '[1/15/25, 10:30:00 AM] John: No URLs here'

      const result = parseChatWithStats(content)

      expect(result.urlCount).toBe(0)
    })
  })

  describe('parseChatStream', () => {
    it('yields messages for WhatsApp source', async () => {
      const lines = (async function* () {
        yield '[1/15/25, 10:30:00 AM] John: Hello'
        yield '[1/15/25, 10:31:00 AM] Jane: Hi'
      })()

      const messages = []
      for await (const msg of parseChatStream(lines, 'whatsapp')) {
        messages.push(msg)
      }

      expect(messages).toHaveLength(2)
      expect(messages[0]?.sender).toBe('John')
      expect(messages[1]?.sender).toBe('Jane')
    })

    it('yields messages for iMessage source', async () => {
      const lines = (async function* () {
        yield 'Jan 15, 2025  10:30:00 AM'
        yield 'John Doe'
        yield 'Hello world'
        yield ''
        yield 'Jan 15, 2025  10:31:00 AM'
        yield 'Jane Smith'
        yield 'Hi there'
        yield ''
      })()

      const messages = []
      for await (const msg of parseChatStream(lines, 'imessage')) {
        messages.push(msg)
      }

      expect(messages.length).toBeGreaterThanOrEqual(1)
    })

    it('handles empty stream', async () => {
      const lines = (async function* (): AsyncIterable<string> {
        // Empty stream - yields nothing
      })()

      const messages = []
      for await (const msg of parseChatStream(lines, 'whatsapp')) {
        messages.push(msg)
      }

      expect(messages).toHaveLength(0)
    })

    it('passes options to WhatsApp stream parser', async () => {
      const lines = (async function* () {
        yield '[1/15/25, 10:30:00 AM] John: Hello'
      })()

      const messages = []
      for await (const msg of parseChatStream(lines, 'whatsapp', { format: 'ios' })) {
        messages.push(msg)
      }

      expect(messages).toHaveLength(1)
    })
  })
})
