# grok-mcp-server

[日本語版はこちら](README.ja.md)

Search X (formerly Twitter) in real-time from your AI assistant — powered by xAI's Grok API.

- **No X API account needed** — just an xAI API key
- **Quick setup** — `npx` with one env var, or deploy to Vercel and connect from claude.ai
- **Wide compatibility** — Claude Code, claude.ai, Cursor, LM Studio, and other MCP clients

```
MCP Client  ──stdio──▶  grok-mcp-server (npx)  ──API──▶  xAI Grok API
claude.ai   ──OAuth 2.1──▶  grok-mcp-server (Vercel)  ──API──▶  xAI Grok API
```

## What You Can Do

- **Search recent posts** — Find what people are saying about any topic right now
- **Summarize discussions** — Get AI-curated summaries of trends, opinions, and reactions
- **Extract structured data** — Define a JSON Schema to pull exactly what you need (sentiment, topics, key quotes)
- **Drill down with follow-ups** — Chain searches to filter, compare, or dig deeper into results
- **Analyze threads** — Pass a post URL to get the original post and top replies ranked by engagement

## Quick Start

### Option A: Use via npx (Claude Code, LM Studio, Cursor, etc.)

No installation required. Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "grok-mcp-server": {
      "command": "npx",
      "args": ["-y", "grok-mcp-server"],
      "env": {
        "XAI_API_KEY": "your-xai-api-key"
      }
    }
  }
}
```

Get your API key at [console.x.ai](https://console.x.ai).

Try it: *"Use x_search to find recent posts about MCP servers and summarize the top opinions"*

### Option B: Deploy to Vercel (claude.ai web / Claude Code)

#### 1. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvalda%2Fgrok-mcp-server&env=JWT_SECRET,XAI_API_KEY,AUTHORIZE_PASSWORD&envDescription=See%20README%20for%20details&envLink=https%3A%2F%2Fgithub.com%2Fvalda%2Fgrok-mcp-server%23environment-variables)

Click the button above. You'll be prompted to set environment variables — see [Environment Variables](#environment-variables) for what to enter.

After deployment, open your project's root URL to verify the setup. The **setup dashboard** shows the status of each variable, provides a JWT secret generator, and guides you through any remaining steps.

#### 2. Connect from claude.ai

1. Log in to [claude.ai](https://claude.ai)
2. Go to **Settings > Integrations > Add More**
3. Enter your MCP endpoint URL: `https://your-project.vercel.app/api/mcp`
4. Click **Add** — the OAuth authorization flow will start
5. Enter the password you set in `AUTHORIZE_PASSWORD` and click **Allow**
6. The `x_search` tool is now available in your chats!

Once registered on claude.ai, the remote MCP server is also available from **Claude Code** (CLI / IDE extensions) under the same account.

Try it: *"Search X for reactions to the latest Grok release and return JSON with positive and negative themes"*

## Why grok-mcp-server?

**Best for:** real-time search, trend analysis, sentiment extraction, topic summarization — any read-only X research workflow.

**Not for:** posting, retweeting, DMs, follows, or any write operation. Use the [official X MCP server (xmcp)](https://github.com/xdevplatform/xmcp) for those.

Compared to the official X API / xmcp:

| | grok-mcp-server | Official X API (xmcp) |
|---|---|---|
| X API account | **Not required** | Required ($200+/month) |
| Search results | AI-interpreted summaries & analysis | Raw API data |
| Structured output | Any JSON Schema | Not built-in |
| Full archive search | **Available** (via Grok) | Pro ($5,000/month) |
| Setup | `npx` + 1 env var, or Vercel deploy | Local server + X Developer app + OAuth callback setup |
| Write operations | Not supported | Supported |

For cost details, see [Pricing](#pricing) below.

## Pricing

Each `x_search` call incurs xAI API costs: **token fees** + **X Search tool fee** ($0.005/call).

The default model `grok-4-1-fast-non-reasoning` is the most cost-effective option:

| Model | Input | Cached Input | Output |
|-------|-------|-------------|--------|
| grok-4-1-fast-non-reasoning (**default**) | $0.20 / 1M tokens | $0.05 / 1M tokens | $0.50 / 1M tokens |
| grok-4-1-fast-reasoning | $0.20 / 1M tokens | $0.05 / 1M tokens | $0.50 / 1M tokens |
| grok-4.20-0309-non-reasoning | $2.00 / 1M tokens | $0.20 / 1M tokens | $6.00 / 1M tokens |
| grok-4.20-0309-reasoning | $2.00 / 1M tokens | $0.20 / 1M tokens | $6.00 / 1M tokens |

See [xAI Models and Pricing](https://docs.x.ai/developers/models) for the latest rates.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | JWT signing key (generate via the setup dashboard or `openssl rand -base64 32`) |
| `XAI_API_KEY` | Yes | xAI API key (obtain from [console.x.ai](https://console.x.ai)) |
| `AUTHORIZE_PASSWORD` | Yes | Password for the authorization screen (authorization is blocked if unset) |
| `BASE_URL` | No | Public URL override. Auto-detected from Vercel environment variables (`VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`). Defaults to `http://localhost:3000` locally. |

## Local Development

```bash
git clone https://github.com/valda/grok-mcp-server.git
cd grok-mcp-server
npm install
cp .env.local.example .env.local  # edit with your values
npm run dev
```

The dev server starts at `http://localhost:3000`.

### CLI (stdio) development

```bash
npm run build:cli        # Build dist/cli.js
npm test                 # Run all tests
```

Test the stdio server locally:

```bash
XAI_API_KEY=your-key node dist/cli.js
```

## Architecture

- **OAuth 2.1** — PKCE required, Dynamic Client Registration supported
- **MCP** — POST-only JSON-RPC endpoint (exposes the `x_search` tool)
- **Stateless** — Authorization codes, access tokens, and client registrations are all signed JWTs; `Mcp-Session-Id` reuses the access token (no separate session JWT)

### Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/` | GET | Setup dashboard |
| `/.well-known/oauth-authorization-server` | GET | OAuth metadata |
| `/api/oauth/register` | POST | Client registration |
| `/api/oauth/authorize` | GET/POST | Authorization (consent screen and code issuance) |
| `/api/oauth/token` | POST | Token issuance (PKCE verification) |
| `/api/mcp` | POST | MCP JSON-RPC endpoint |

## Tech Stack

- [Next.js](https://nextjs.org) 16 (App Router)
- [jose](https://github.com/panva/jose) — JWT signing and verification
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP SDK (stdio transport)
- [zod](https://zod.dev) — Schema validation
- [tsup](https://tsup.egoist.dev) — CLI bundler
- [Vitest](https://vitest.dev) — Unit and integration tests
- TypeScript 5

## License

MIT
