# ChatToMap

Transform chat exports into geocoded activity suggestions.

[![License](https://img.shields.io/badge/License-AGPL--3.0-blue)](LICENSE)

## Overview

ChatToMap extracts "things to do" from WhatsApp, iMessage, Telegram, Facebook Messenger, and LINE exports - restaurants to try, places to visit, trips to take. It finds suggestions buried in years of chat history and puts them on a map.

**Features:**
- Parse WhatsApp (iOS/Android), iMessage, Telegram Desktop JSON, Facebook Messenger JSON, and LINE text exports
- Extract suggestions using multilingual regex patterns, embeddings, and URL detection
- Classify with AI (activity vs errand, mappable vs general)
- Scrape metadata from TikTok and YouTube links
- Geocode locations to coordinates
- Export to CSV, Excel, JSON, PDF, and interactive HTML map

`chat_to_map` is the free and open source engine that powers [ChatToMap.com](https://chattomap.com). If you are not comfortable with command-line tools or managing API tokens, you can use the [ChatToMap web app](https://chattomap.com) and pay a small fee to analyze your chat exports.

## Installation

```bash
# Run directly with npx (zero install)
npx chat-to-map scan "WhatsApp Chat.zip"

# Or install globally
npm install -g chat-to-map

# Or as a library
npm install chat-to-map
```

## CLI Usage

```bash
# Free scan - find patterns without API calls
chat-to-map scan <input>

# AI preview - classify top candidates (~$0.01)
chat-to-map preview <input>

# Full analysis with exports
chat-to-map analyze <input>

# Telegram Desktop exports
chat-to-map analyze "/path/to/ChatExport_2026-04-26/result.json"

# Facebook Messenger exports (one chat JSON at a time, extracted from messages.zip)
chat-to-map analyze "/path/to/messages/Friend Name_15.json"

# LINE text exports
chat-to-map analyze "/path/to/[LINE] Chat with Friends.txt"

# List previously processed chats
chat-to-map list
```

### Options

```
-o, --output-dir <dir>    Output directory (default: ./chat-to-map/output)
-f, --format <formats>    Output formats: csv,excel,json,map,pdf
-r, --region <code>       Region bias for geocoding (e.g., NZ, US, UK)
-n, --limit <num>         Max results for preview/scan
--min-confidence <0-1>    Minimum confidence threshold
--activities-only         Exclude errands (activity_score > 0.5)
--category <cat>          Filter by category
--skip-geocoding          Skip geocoding step
-q, --quiet               Minimal output
-v, --verbose             Verbose output
```

### API Keys

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # Required for classification
export GOOGLE_MAPS_API_KEY=AIza...    # Required for geocoding
export OPENAI_API_KEY=sk-...          # Optional for embeddings
export PIXABAY_API_KEY=...            # Optional for images
```

### Images (Opt-In)

Images are **not fetched by default**. Use `--images` to enable:

```bash
chat-to-map analyze <input> --images
```

Or fetch images separately for existing results:

```bash
chat-to-map fetch-images <input>
```

**Tip:** To always fetch images, set it in your config:

```bash
chat-to-map config set fetchImages true
```

**Why opt-in?**
- Most external APIs don't allow automated scraping or rate-limit heavily
- Fetching can take a long time with thousands of activities
- Google Places photo lookups can be expensive
- The CLI works perfectly without images

**Where images are used:**
- Interactive map HTML (pin details on hover)
- Activity list view in map export
- Thumbnails in exported PDFs

### Configuration

Configuration is managed in `~/.config/chat-to-map/config.json`. `homeCountry` and `timezone` are auto-detected from your system and persisted for future runs. Other settings can be set via the `config` command.

**Available settings:**
- `homeCountry` - Your home country (auto-detected from IP if not set)
- `timezone` - Your timezone (auto-detected from system if not set)
- `fetchImages` - Whether to fetch images by default
- `cacheDir` - Custom cache directory
- `outputDir` - Default output directory
- `formats` - Default export formats

**Manage settings with the `config` command:**

```bash
# List all settings
chat-to-map config

# Set a value
chat-to-map config set homeCountry "New Zealand"
chat-to-map config set fetchImages true
chat-to-map config set formats csv,json,map

# Unset a value
chat-to-map config unset cacheDir
```

**Custom config file:**

```bash
# Use a different config file
chat-to-map analyze <input> --config-file /path/to/config.json

# Or via environment variable
export CHAT_TO_MAP_CONFIG=/path/to/config.json
```

## Library Usage

```typescript
import {
  parseChat,
  extractCandidatesByHeuristics,
  extractCandidates,  // combined: heuristics + embeddings
  classifyMessages,
  geocodeActivities,
  exportToMapHTML,
  quickScan
} from 'chat-to-map'

// Quick scan (zero API cost)
const scan = quickScan(chatText)
console.log(`Found ${scan.candidates.length} candidates`)

// Parse messages
const messages = parseChat(chatText)

// Extract candidates (heuristics only - sync, free)
const { candidates } = extractCandidatesByHeuristics(messages)

// Or with embeddings (async, requires OpenAI key)
// const result = await extractCandidates(messages, {
//   embeddings: { config: { apiKey: process.env.OPENAI_API_KEY } }
// })
// if (result.ok) candidates = result.value.candidates

// Classify with AI
const result = await classifyMessages(candidates, {
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY
})

// Geocode and export
if (result.ok) {
  const geocoded = await geocodeSuggestions(
    result.value.filter(s => s.isMappable),
    { apiKey: process.env.GOOGLE_MAPS_API_KEY }
  )
  const html = exportToMapHTML(geocoded)
}
```

### Social Media Scraping

Extract metadata from TikTok and YouTube links found in chats:

```typescript
import { scrapeUrl, scrapeTikTok, scrapeYouTube } from 'chat-to-map'

// Auto-detect platform
const result = await scrapeUrl('https://youtu.be/abc123')

// Or use platform-specific scrapers
const tiktok = await scrapeTikTok('https://vt.tiktok.com/xxx/')
const youtube = await scrapeYouTube('https://youtube.com/watch?v=xxx')

if (result.ok) {
  console.log(result.metadata.title)
  console.log(result.metadata.description)
  console.log(result.metadata.hashtags)
}
```

## Modules

| Module | Purpose |
|--------|---------|
| `parser` | Parse WhatsApp/iMessage exports |
| `extractor` | Find candidates via regex and URLs |
| `classifier` | AI classification (Claude/OpenAI) |
| `embeddings` | Semantic search with embeddings |
| `geocoder` | Convert locations to coordinates |
| `scraper` | Extract metadata from social URLs |
| `export` | CSV, Excel, JSON, PDF, HTML map |
| `scanner` | Zero-cost heuristic scanning |
| `cache` | API response caching |

## Export Formats

| Format | Description |
|--------|-------------|
| CSV | All fields, spreadsheet-compatible |
| Excel | Formatted .xlsx with filters |
| JSON | Machine-readable with full metadata |
| Map | Interactive Leaflet.js HTML |
| PDF | Printable report with summary |

## How to Export Your Chats

Each messaging app has its own export flow. ChatToMap only needs the message **text** —
always pick the "without media" option when offered, both because ChatToMap doesn't use
photos/videos and because it keeps the export much smaller.

### WhatsApp

**iPhone / iPad**
1. Open WhatsApp and tap the chat you want to analyze.
2. Tap the chat name at the top to open chat info.
3. Scroll down and tap **Export Chat**.
4. Choose **Without Media**.
5. Save or share the resulting `.zip` file.

**Android**
1. Open the chat in WhatsApp.
2. Tap the ⋮ menu in the top-right.
3. Tap **More** → **Export chat**.
4. Choose **Without media**.
5. Save or share the resulting `.zip` file.

**Desktop (macOS / Windows)**
1. Open WhatsApp Desktop and right-click the chat.
2. Choose **Export chat** from the context menu.
3. Choose **Without media**.
4. The `.zip` file is saved to your Downloads folder.

```bash
chat-to-map analyze "WhatsApp Chat - Friends.zip"
```

### iMessage

iMessage has no built-in export. The cleanest path is the open-source
[`imessage-exporter`](https://github.com/ReagentX/imessage-exporter) tool, which reads
your local iMessage database (or an iPhone backup) and writes one `.txt` file per
conversation that ChatToMap can parse directly.

1. Install `imessage-exporter` via Homebrew or Cargo:
   ```bash
   brew install imessage-exporter
   # or
   cargo install imessage-exporter
   ```
2. Grant your terminal **Full Disk Access** in System Settings → Privacy & Security so it
   can read `~/Library/Messages/chat.db`.
3. Run the exporter in `txt` format:
   ```bash
   imessage-exporter -f txt -o ~/imessage_export
   ```
   On macOS this reads the local database. To export from an iPhone backup instead:
   ```bash
   imessage-exporter -f txt -p ~/iphone_backup_latest -a iOS -o ~/imessage_export
   ```
4. The output folder contains one `.txt` file per chat, named after the contact or group.
   Pass any one of those files to ChatToMap:

```bash
chat-to-map analyze "~/imessage_export/Friend Name.txt"
```

Your messages never leave your computer — both `imessage-exporter` and `chat-to-map` run
locally.

### Telegram

Telegram chat exports are **only available from Telegram Desktop**. Mobile Telegram apps
(iOS / Android) cannot export chat history. On macOS the App Store version is called
**Telegram Lite** — install from <https://desktop.telegram.org/>, *not* the older
`macos.telegram.org` build, which doesn't support export.

1. Open Telegram Desktop and sign in to the account that has the chat.
2. Open the private chat, group, or channel you want to export.
3. Use the chat menu → **Export chat history**.
4. Choose the **machine-readable JSON** format when prompted.
5. Telegram writes a `result.json` file and any selected media into an export folder. Keep
   the folder intact or zip it up.

```bash
chat-to-map analyze "/path/to/ChatExport_2026-04-26/result.json"
# or a zipped folder
chat-to-map analyze "telegram-export.zip"
```

### Facebook Messenger

Messenger exports `messages.zip`, which contains every conversation as separate JSON files.
Extract it locally and pass one chat at a time.

1. On a computer, visit <https://www.messenger.com/secure_storage/dyi>.
2. **Uncheck "Media"** — ChatToMap only uses message text and leaving it on makes the
   export 10× larger.
3. Pick your date range (e.g. **All time**).
4. Click **Download file** and wait. Messenger needs to assemble the archive — this can
   take **5–10 minutes** for large accounts.
5. When the file is ready, save `messages.zip` to your computer.
6. Double-click `messages.zip` to extract it. You'll see one `.json` file per conversation,
   named like `Friend Name_15.json`.

```bash
chat-to-map analyze "messages/Friend Name_15.json"
```

### LINE

1. In LINE, open the chat you want to analyze.
2. Use **Settings → Export chat history** for that conversation.
3. Save the resulting `.txt` file (or the folder/zip if LINE includes media).
4. Don't edit the exported text before passing it in — the parser reads LINE's original
   format.

```bash
chat-to-map analyze "[LINE] Chat with Friends.txt"
```

## Supported Languages

ChatToMap supports multilingual chats across heuristic extraction, semantic search queries, and
AI classification. It can process mixed-language conversations and preserves proper nouns,
venues, media titles, and place names in their original script when appropriate.

Current first-class language coverage: Arabic, Bulgarian, Chinese (Simplified), Chinese (Traditional), Czech, Danish, Dutch, English, Finnish, French, German, Greek, Hebrew, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Norwegian Bokmål, Persian, Polish, Portuguese, Romanian, Russian, Slovak, Spanish, Swedish, Thai, Turkish, Ukrainian, Vietnamese

## Privacy

**This library and CLI have zero telemetry.** We do not collect any data about your usage.

- No analytics or tracking
- No phone-home behavior
- No usage statistics
- Your chat data stays on your machine

The only network requests are to APIs you explicitly configure (Anthropic/OpenAI for classification, Google Maps for geocoding). These are direct calls to third-party services using your own API keys.

## License

AGPL-3.0 - See [LICENSE](LICENSE)

---

[ChatToMap.com](https://chattomap.com)
