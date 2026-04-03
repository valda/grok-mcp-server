# grok-mcp-server

[日本語](README.ja.md)

A **Grok API proxy MCP server** for searching X (formerly Twitter) in real-time.

Search posts, trends, and public opinion on X directly from your AI assistant using the `x_search` tool.

```
MCP Client  ──stdio──▶  grok-mcp-server (npx)  ──API──▶  xAI Grok API
claude.ai   ──OAuth 2.1──▶  grok-mcp-server (Vercel)  ──API──▶  xAI Grok API
```

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

### Option B: Deploy to Vercel (claude.ai web)

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

Try it: *"Use x_search to search for recent AI coding posts on X"*

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | JWT signing key (generate via the setup dashboard or `openssl rand -base64 32`) |
| `XAI_API_KEY` | Yes | xAI API key (obtain from [console.x.ai](https://console.x.ai)) |
| `AUTHORIZE_PASSWORD` | Yes | Password for the authorization screen (authorization is blocked if unset) |
| `BASE_URL` | No | Public URL override. Auto-detected from Vercel environment variables (`VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`). Defaults to `http://localhost:3000` locally. |

## Features

- **Real-time X Search** — Search posts, trends, and public opinion on X via Grok's X Search
- **Structured Output** — Define any JSON Schema via `output_schema` to extract exactly the data you need (sentiment, topics, reactions, etc.)
- **Multi-turn Chaining** — Use `previous_response_id` to build follow-up searches with context for drill-down, filtering, and summarization workflows
- **Thread Extraction** — Pass a post URL to retrieve the original post and top replies ranked by engagement, with structured output
- **Dual Transport** — Use as a remote MCP server (zero-install, just paste a URL) or locally via stdio (`npx`)
- **No X API Developer Account Required** — Uses xAI's Grok API, which includes X Search. No need to apply for X API access or pay for expensive tiers
- **Setup Dashboard** — The root page (`/`) shows environment variable status, a JWT secret generator, and step-by-step instructions
- **i18n** — The setup dashboard and OAuth authorization screen detect `Accept-Language` and display in English or Japanese

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

## Local Development

```bash
git clone https://github.com/valda/grok-mcp-server.git
cd grok-mcp-server
npm install
cp .env.local.example .env.local  # edit with your values
npm run dev
```

The dev server starts at `http://localhost:3000`.

## Architecture

- **OAuth 2.1** — PKCE required, Dynamic Client Registration supported
- **MCP** — POST-only JSON-RPC endpoint (exposes the `x_search` tool)
- **Stateless** — Authorization codes and access tokens are signed JWTs; `Mcp-Session-Id` reuses the access token (no separate session JWT)

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
