# grok-mcp-server

[日本語](README.ja.md)

A **Grok API proxy MCP server** that connects to claude.ai's web interface.

Ask questions to xAI's Grok model directly from claude.ai using the `ask_grok` tool.

## How It Works

```
claude.ai  ──OAuth 2.1──▶  grok-mcp-server (Vercel)  ──API──▶  xAI Grok API
```

- **OAuth 2.1** — PKCE required, Dynamic Client Registration supported
- **MCP** — POST-only JSON-RPC endpoint (exposes the `ask_grok` tool)
- **Stateless** — Authorization codes, access tokens, and sessions are all signed JWTs

## Setup

Run `npm install` followed by `npm run dev` to start the development server.

Set the following environment variables in your Vercel project settings (Settings > Environment Variables) and deploy via GitHub integration with `git push`. For local development, you can use `.env.local` instead.

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | JWT signing key (e.g., generate with `openssl rand -base64 32`) |
| `XAI_API_KEY` | Yes | xAI API key (obtain from [console.x.ai](https://console.x.ai)) |
| `BASE_URL` | No | Public URL of the server (default: `http://localhost:3000`) |
| `AUTHORIZE_PASSWORD` | No | Password for the authorization screen (if unset, authorization proceeds without a password) |

Set `BASE_URL` to the URL shown in your Vercel project's Settings > Domains after deployment (e.g., `https://your-project.vercel.app`).

> **Warning**: If `AUTHORIZE_PASSWORD` is not set, anyone who knows the URL can complete authorization, consuming your xAI API tokens. Always set this in production. Note that the password is compared in plaintext, so consider additional measures if stronger authentication is needed.

## Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/.well-known/oauth-authorization-server` | GET | OAuth metadata |
| `/api/oauth/register` | POST | Client registration |
| `/api/oauth/authorize` | GET/POST | Authorization (consent screen and code issuance) |
| `/api/oauth/token` | POST | Token issuance (PKCE verification) |
| `/api/mcp` | POST | MCP JSON-RPC endpoint |

## Usage with claude.ai (Web)

1. Log in to [claude.ai](https://claude.ai)
2. Go to Settings > Integrations > Add More
3. Enter the following:
   - **URL**: `https://your-project.vercel.app/api/mcp` (replace with your deployed URL)
4. Click "Add" to start the OAuth authorization flow
5. Enter the password set in `AUTHORIZE_PASSWORD` on the authorization screen and click "Allow"
6. The `ask_grok` tool is now available in your chats

Example: "Use ask_grok to search for recent AI-related posts on X"

## Tech Stack

- [Next.js](https://nextjs.org) 16 (App Router)
- [jose](https://github.com/panva/jose) — JWT signing and verification
- TypeScript 5

## License

MIT
