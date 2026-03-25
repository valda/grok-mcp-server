# grok-mcp-server

[日本語](README.ja.md)

A **Grok API proxy MCP server** that connects to claude.ai's web interface.

Ask questions to xAI's Grok model directly from claude.ai using the `ask_grok` tool.

```
claude.ai  ──OAuth 2.1──▶  grok-mcp-server (Vercel)  ──API──▶  xAI Grok API
```

## Quick Start

### 1. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvalda%2Fgrok-mcp-server&env=JWT_SECRET,XAI_API_KEY,BASE_URL,AUTHORIZE_PASSWORD&envDescription=See%20README%20for%20details&envLink=https%3A%2F%2Fgithub.com%2Fvalda%2Fgrok-mcp-server%23environment-variables)

Click the button above. You'll be prompted to set environment variables — see [Environment Variables](#environment-variables) for what to enter.

After deployment, copy the domain from your Vercel dashboard (e.g., `https://your-project.vercel.app`) and update `BASE_URL` in Settings > Environment Variables, then redeploy.

### 2. Connect from claude.ai

1. Log in to [claude.ai](https://claude.ai)
2. Go to **Settings > Integrations > Add More**
3. Enter your MCP endpoint URL: `https://your-project.vercel.app/api/mcp`
4. Click **Add** — the OAuth authorization flow will start
5. Enter the password you set in `AUTHORIZE_PASSWORD` and click **Allow**
6. The `ask_grok` tool is now available in your chats!

Try it: *"Use ask_grok to search for recent AI-related posts on X"*

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | JWT signing key (generate with `openssl rand -base64 32`) |
| `XAI_API_KEY` | Yes | xAI API key (obtain from [console.x.ai](https://console.x.ai)) |
| `BASE_URL` | No | Public URL of the server (default: `http://localhost:3000`) |
| `AUTHORIZE_PASSWORD` | No | Password for the authorization screen (if unset, anyone with the URL can authorize) |

> **Warning**: If `AUTHORIZE_PASSWORD` is not set, anyone who knows the URL can complete authorization, consuming your xAI API tokens. Always set this in production. The password is compared in plaintext, so consider additional measures if stronger authentication is needed.

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
- **MCP** — POST-only JSON-RPC endpoint (exposes the `ask_grok` tool)
- **Stateless** — Authorization codes, access tokens, and sessions are all signed JWTs

### Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/.well-known/oauth-authorization-server` | GET | OAuth metadata |
| `/api/oauth/register` | POST | Client registration |
| `/api/oauth/authorize` | GET/POST | Authorization (consent screen and code issuance) |
| `/api/oauth/token` | POST | Token issuance (PKCE verification) |
| `/api/mcp` | POST | MCP JSON-RPC endpoint |

## Tech Stack

- [Next.js](https://nextjs.org) 16 (App Router)
- [jose](https://github.com/panva/jose) — JWT signing and verification
- TypeScript 5

## License

MIT
