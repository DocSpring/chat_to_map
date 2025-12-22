import { describe, expect, it } from 'vitest'
import { detectFormat, parseWhatsAppChat } from './whatsapp'

describe('WhatsApp Parser', () => {
  describe('detectFormat', () => {
    it('detects iOS format', () => {
      const content = `[1/15/24, 10:30:45 AM] John: Hello
[1/15/24, 10:31:02 AM] Jane: Hi there!`
      expect(detectFormat(content)).toBe('ios')
    })

    it('detects Android format', () => {
      const content = `1/15/24, 10:30 - John: Hello
1/15/24, 10:31 - Jane: Hi there!`
      expect(detectFormat(content)).toBe('android')
    })

    it('defaults to iOS when unclear', () => {
      const content = 'Random text without patterns'
      expect(detectFormat(content)).toBe('ios')
    })
  })

  describe('parseWhatsAppChat - iOS format', () => {
    it('parses simple messages', () => {
      const content = `[1/15/24, 10:30:45 AM] John: Hello
[1/15/24, 10:31:02 AM] Jane: Hi there!`

      const messages = parseWhatsAppChat(content)

      expect(messages).toHaveLength(2)
      expect(messages[0]?.sender).toBe('John')
      expect(messages[0]?.content).toBe('Hello')
      expect(messages[1]?.sender).toBe('Jane')
      expect(messages[1]?.content).toBe('Hi there!')
    })

    it('parses multi-line messages', () => {
      const content = `[1/15/24, 10:30:45 AM] John: This is line one
and this is line two
and line three
[1/15/24, 10:31:02 AM] Jane: Single line`

      const messages = parseWhatsAppChat(content)

      expect(messages).toHaveLength(2)
      expect(messages[0]?.content).toBe('This is line one\nand this is line two\nand line three')
      expect(messages[1]?.content).toBe('Single line')
    })

    it('extracts URLs from messages', () => {
      const content = `[1/15/24, 10:30:45 AM] John: Check out https://example.com/page`

      const messages = parseWhatsAppChat(content)

      expect(messages[0]?.urls).toEqual(['https://example.com/page'])
    })

    it('detects media placeholders', () => {
      const content = `[1/15/24, 10:30:45 AM] John: image omitted`

      const messages = parseWhatsAppChat(content)

      expect(messages[0]?.hasMedia).toBe(true)
      expect(messages[0]?.mediaType).toBe('image')
    })

    it('skips system messages', () => {
      const content = `[1/15/24, 10:30:45 AM] John: Hello
[1/15/24, 10:31:02 AM] Jane: Messages and calls are end-to-end encrypted
[1/15/24, 10:32:00 AM] Bob: Hi`

      const messages = parseWhatsAppChat(content)

      expect(messages).toHaveLength(2)
      expect(messages[0]?.sender).toBe('John')
      expect(messages[1]?.sender).toBe('Bob')
    })

    it('parses timestamps correctly', () => {
      const content = `[12/31/23, 11:59:59 PM] John: New Year's Eve`

      const messages = parseWhatsAppChat(content)

      expect(messages[0]?.timestamp.getFullYear()).toBe(2023)
      expect(messages[0]?.timestamp.getMonth()).toBe(11) // December (0-indexed)
      expect(messages[0]?.timestamp.getDate()).toBe(31)
      expect(messages[0]?.timestamp.getHours()).toBe(23)
    })

    it('handles AM/PM correctly', () => {
      const content = `[1/15/24, 12:30:00 AM] John: Midnight-ish
[1/15/24, 12:30:00 PM] Jane: Noon-ish`

      const messages = parseWhatsAppChat(content)

      expect(messages[0]?.timestamp.getHours()).toBe(0)
      expect(messages[1]?.timestamp.getHours()).toBe(12)
    })
  })

  describe('parseWhatsAppChat - Android format', () => {
    it('parses simple messages', () => {
      const content = `1/15/24, 10:30 - John: Hello
1/15/24, 10:31 - Jane: Hi there!`

      const messages = parseWhatsAppChat(content, { format: 'android' })

      expect(messages).toHaveLength(2)
      expect(messages[0]?.sender).toBe('John')
      expect(messages[0]?.content).toBe('Hello')
    })

    it('parses multi-line messages', () => {
      const content = `1/15/24, 10:30 - John: Line one
Line two
1/15/24, 10:31 - Jane: Single`

      const messages = parseWhatsAppChat(content, { format: 'android' })

      expect(messages).toHaveLength(2)
      expect(messages[0]?.content).toBe('Line one\nLine two')
    })
  })

  describe('edge cases', () => {
    it('message content should NOT contain subsequent message timestamps', () => {
      // This is a regression test for a critical bug where the parser
      // included multiple messages in a single content field
      const content = `[1/15/24, 10:30:45 AM] John: Check this out
https://example.com
[1/15/24, 10:31:02 AM] John: What do you think?
[1/15/24, 10:32:00 AM] Jane: Looks good!`

      const messages = parseWhatsAppChat(content)

      expect(messages).toHaveLength(3)
      // First message content should NOT contain the next timestamp
      expect(messages[0]?.content).toBe('Check this out\nhttps://example.com')
      expect(messages[0]?.content).not.toContain('[1/15/24')
      expect(messages[0]?.content).not.toContain('What do you think')
      // Each message should be properly separated
      expect(messages[1]?.content).toBe('What do you think?')
      expect(messages[2]?.content).toBe('Looks good!')
    })

    it('splits messages correctly after multi-line content', () => {
      // Real-world example: long message followed by quick replies
      const content = `[6/3/25, 12:51:20 PM] Alice: Final Thought:
Planning strategically will give you both financial freedom and room to grow.
[6/3/25, 12:51:28 PM] Alice: that's a nice position to be
[6/3/25, 12:51:33 PM] Alice: I'LL STOP
[6/3/25, 12:51:35 PM] Bob: we can talk about it later`

      const messages = parseWhatsAppChat(content)

      expect(messages).toHaveLength(4)
      expect(messages[0]?.content).toBe(
        'Final Thought:\nPlanning strategically will give you both financial freedom and room to grow.'
      )
      expect(messages[0]?.content).not.toContain('[6/3/25')
      expect(messages[1]?.content).toBe("that's a nice position to be")
      expect(messages[2]?.content).toBe("I'LL STOP")
      expect(messages[3]?.content).toBe('we can talk about it later')
    })

    it('splits rapid-fire messages correctly', () => {
      const content = `[11/23/23, 10:49:42 AM] Bob: Event tomorrow
[11/23/23, 10:49:54 AM] Bob: We should visit to see it
[11/23/23, 10:51:02 AM] Alice: Yeah! We can also watch it online
[11/23/23, 10:51:07 AM] Alice: But yeah!
[11/23/23, 10:51:10 AM] Alice: Must visit`

      const messages = parseWhatsAppChat(content)

      expect(messages).toHaveLength(5)
      expect(messages[0]?.content).toBe('Event tomorrow')
      expect(messages[1]?.content).toBe('We should visit to see it')
      expect(messages[2]?.content).toBe('Yeah! We can also watch it online')
      expect(messages[3]?.content).toBe('But yeah!')
      expect(messages[4]?.content).toBe('Must visit')
    })

    it('handles message with URL followed by more messages', () => {
      const content = `[11/23/23, 10:49:00 AM] Bob: I like this one
https://www.example.com/listing/12345
[11/23/23, 10:49:42 AM] Bob: Event tomorrow
[11/23/23, 10:49:54 AM] Bob: We should visit`

      const messages = parseWhatsAppChat(content)

      expect(messages).toHaveLength(3)
      expect(messages[0]?.content).toBe('I like this one\nhttps://www.example.com/listing/12345')
      expect(messages[0]?.content).not.toContain('[11/23/23')
      expect(messages[1]?.content).toBe('Event tomorrow')
      expect(messages[2]?.content).toBe('We should visit')
    })

    it('no message content should ever contain a timestamp pattern', () => {
      // Ultimate sanity check - if ANY content contains a timestamp, parsing is broken
      const content = `[5/22/24, 11:26:20 AM] Alice: Would you like to go there for your birthday?
https://www.example.com/restaurant/review
[5/22/24, 11:26:30 AM] Alice: The cat is acting strange
[5/22/24, 11:26:43 AM] Alice: And he attacked the dog
[5/22/24, 11:26:51 AM] Bob: ohhhh
[5/22/24, 11:26:53 AM] Alice: And was grumpy with me`

      const messages = parseWhatsAppChat(content)
      const timestampPattern = /\[\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}:\d{2}\s*[AP]M\]/

      expect(messages).toHaveLength(5)
      for (const msg of messages) {
        expect(msg.content).not.toMatch(timestampPattern)
      }
    })

    it('handles empty input', () => {
      const messages = parseWhatsAppChat('')
      expect(messages).toHaveLength(0)
    })

    it('handles input with no valid messages', () => {
      const content = 'Just some random text\nwith no timestamps'
      const messages = parseWhatsAppChat(content)
      expect(messages).toHaveLength(0)
    })

    it('handles messages with colons in content', () => {
      const content = `[1/15/24, 10:30:45 AM] John: Time is 3:30 PM`

      const messages = parseWhatsAppChat(content)

      expect(messages[0]?.content).toBe('Time is 3:30 PM')
    })

    it('handles messages with special characters', () => {
      const content = `[1/15/24, 10:30:45 AM] John: Hello! How are you? 😀`

      const messages = parseWhatsAppChat(content)

      expect(messages[0]?.content).toBe('Hello! How are you? 😀')
    })

    it('cleans trailing punctuation from URLs', () => {
      const content = `[1/15/24, 10:30:45 AM] John: Check this: https://example.com.`

      const messages = parseWhatsAppChat(content)

      expect(messages[0]?.urls).toEqual(['https://example.com'])
    })

    it('assigns sequential IDs', () => {
      const content = `[1/15/24, 10:30:45 AM] John: First
[1/15/24, 10:31:02 AM] Jane: Second
[1/15/24, 10:32:00 AM] Bob: Third`

      const messages = parseWhatsAppChat(content)

      expect(messages[0]?.id).toBe(0)
      expect(messages[1]?.id).toBe(1)
      expect(messages[2]?.id).toBe(2)
    })

    it('sets source to whatsapp', () => {
      const content = `[1/15/24, 10:30:45 AM] John: Hello`

      const messages = parseWhatsAppChat(content)

      expect(messages[0]?.source).toBe('whatsapp')
    })

    it('handles CRLF line endings', () => {
      const content = `[1/15/24, 10:30:45 AM] John: Hello\r\n[1/15/24, 10:31:02 AM] Jane: Hi there!\r\n`

      const messages = parseWhatsAppChat(content)

      expect(messages).toHaveLength(2)
      expect(messages[0]?.content).toBe('Hello')
      expect(messages[1]?.content).toBe('Hi there!')
    })

    it('handles mixed CRLF and LF line endings', () => {
      const content = `[1/15/24, 10:30:45 AM] John: First\r\n[1/15/24, 10:31:02 AM] Jane: Second\n[1/15/24, 10:32:00 AM] Bob: Third\r\n`

      const messages = parseWhatsAppChat(content)

      expect(messages).toHaveLength(3)
      expect(messages[0]?.content).toBe('First')
      expect(messages[1]?.content).toBe('Second')
      expect(messages[2]?.content).toBe('Third')
    })

    it('handles narrow no-break space (U+202F) between time and AM/PM', () => {
      // WhatsApp iOS exports use narrow no-break space
      const content = `[1/15/24, 10:30:45\u202FAM] John: Hello\n[1/15/24, 10:31:02\u202FPM] Jane: Hi!`

      const messages = parseWhatsAppChat(content)

      expect(messages).toHaveLength(2)
      expect(messages[0]?.content).toBe('Hello')
      expect(messages[1]?.content).toBe('Hi!')
    })

    it('handles left-to-right mark (U+200E) at start of lines', () => {
      // WhatsApp iOS exports include LTR mark before some lines
      const content = `\u200E[1/15/24, 10:30:45 AM] John: Hello\n\u200E[1/15/24, 10:31:02 AM] Jane: Hi!`

      const messages = parseWhatsAppChat(content)

      expect(messages).toHaveLength(2)
      expect(messages[0]?.content).toBe('Hello')
      expect(messages[1]?.content).toBe('Hi!')
    })

    it('handles real WhatsApp iOS format with all quirks', () => {
      // Combination of CRLF, narrow no-break space, and LTR marks
      const content = `[10/10/23, 2:16:41\u202FPM] Alice: First message\r\n\u200E[10/10/23, 2:16:44\u202FPM] Bob: Second\r\n[10/10/23, 2:16:57\u202FPM] Alice: Third`

      const messages = parseWhatsAppChat(content)

      expect(messages).toHaveLength(3)
      expect(messages[0]?.content).toBe('First message')
      expect(messages[1]?.content).toBe('Second')
      expect(messages[2]?.content).toBe('Third')
    })
  })
})
