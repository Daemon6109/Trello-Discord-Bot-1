# GRIDLOK Notion Discord bot

A standalone, read-only Discord slash-command bot for the GRIDLOK Notion task data source. No write operations, public endpoints, or message-content intent. Commands are inspired by the `/progress` board-view idea in [Spirast/Trello-Discord-Bot](https://github.com/Spirast/Trello-Discord-Bot) (MIT); this project is independently implemented and does not reuse its code.

## What it does

- `/gridlok list [status] [page]` — tasks grouped by status, 20 per page.
- `/gridlok search query [status] [page]` — case-insensitive task-title search.
- `/gridlok detail id` — properties of one task, using the full ID from list/search. Related tasks are shown by ID, not resolved titles.
- `/gridlok progress [page]` — **public** completion dashboard: overall and per Workstream, with counts and progress bars. Ten workstreams per page; run the command again with another page number to see more. Only tasks whose Status is exactly `Done` count as complete; missing Workstream values are grouped as Unassigned. Percentages are rounded to the nearest whole percent, with an empty board shown as 0% (0 / 0). Bar segments are rounded to the nearest 10 percentage points. This is a text embed, not an image.

**Warning: `/gridlok progress` reveals board data publicly**, including workstream names and task counts, to everyone who can view the channel. Restrict command and channel permissions accordingly. List, search and detail replies remain private (ephemeral) to the caller; mentions are disabled for all replies. Users can still copy or screenshot results. The bot exposes all tasks the integration can read to anyone allowed to invoke private commands, regardless of individual Notion permissions. Notion links only work for users with their own access. Do not enable this for an untrusted audience.

## Setup

Requires Node.js 20+ and npm; Node 22 LTS or later recommended. Outbound HTTPS to Discord and Notion is required.

1. In Notion, create **your own internal integration** at https://www.notion.so/profile/integrations and enable **Read content**. Copy its internal integration secret into your private `.env` later. An existing connector's OAuth session/token is not passed to this standalone bot and cannot substitute for its own integration token. Do not put tokens in chat, source control, or screenshots.
2. In Notion, share/connect the integration to the GRIDLOK parent page using `••• → Connections → Connect to` (wording may vary). Ensure the target database and data source are accessible, including any related databases if needed. Parent page: `40f337e2-d4b5-8062-8e43-c48e575935db`; database: `c7f3fa6f-4e6e-4091-8827-5ed82385fb61`; data source (used for querying): `c0f83a57-42a2-481c-a43d-88aad6bd734b`. A Notion 404 commonly means the integration has not been connected to the page.
3. Create a **separate Discord application** at https://discord.com/developers/applications, create its bot and obtain its token and Application ID. Invite it to your server with the `bot` and `applications.commands` OAuth2 scopes. No privileged gateway intents or administrative bot permissions are required. Ensure the app can be used in the intended channel and review server/channel integration permissions. Get the server ID by enabling Discord Developer Mode and copying the server ID.
4. From this directory:
   ```sh
   npm ci
   cp .env.example .env
   # Edit .env locally; populate DISCORD_TOKEN, APPLICATION_ID, GUILD_ID, NOTION_TOKEN.
   # Keep NOTION_DATA_SOURCE_ID at its default unless changing boards.
   npm run register
   npm start
   ```
   Registration replaces this application's existing **guild** command set for the specified guild. Use a dedicated app so other commands are not overwritten. Guild commands generally appear promptly; restart Discord if needed. To stop the bot, press Ctrl-C. Re-register after command schema changes. `npm test` runs offline unit and local HTTP integration tests.

## Operations and limits

All query requests use Notion API `2025-09-03`, `POST /v1/data_sources/{id}/query`; results are paginated using Notion cursors. Discord pagination is manual: run the command with the desired page number. Search and status filtering occur locally after fetching the board on every command, with no cache; large boards can be slow or rate-limited and Notion's own query-result limits apply. Requests time out after 15 seconds each; there is no automatic retry. If a board or title changes between invocations, page contents can shift. Progress is interpreted as a Notion fraction (0.5 = 50%). Missing properties display as `—`; relation and people properties may be truncated by Notion's API, and very long content is truncated for Discord. The bot does not read page bodies, resolve relation titles, or provide autocomplete, buttons, caching, scheduling, writes, or user-specific Notion authorization.

If commands are absent, check the application/server IDs, invite scopes, server permissions, and registration output. For `401` check the Notion secret; for `403`/`404` check integration capabilities and page connection; for `429` retry later. Other failures are deliberately generic to avoid exposing secrets. Check that Node is supported and outbound network access works. Never paste tokens into issue reports.
