# grok-mcp-server

claude.ai の Web 版から接続できる **Grok API プロキシ MCP サーバー**。

xAI の Grok モデルに対して、claude.ai 上から `ask_grok` ツールで質問できる。

## 仕組み

```
claude.ai  ──OAuth 2.1──▶  grok-mcp-server (Vercel)  ──API──▶  xAI Grok API
```

- **OAuth 2.1** — PKCE 必須、Dynamic Client Registration 対応
- **MCP** — POST-only JSON-RPC endpoint（`ask_grok` ツールを公開）
- **ステートレス** — 認可コード・アクセストークン・セッションすべて署名付き JWT

## セットアップ

`npm install` → `npm run dev` で開発サーバーが起動する。

Vercel のプロジェクト設定（Settings → Environment Variables）で以下を設定し、GitHub 連携で `git push` すればデプロイされる。ローカル開発時は `.env.local` でも可。

| 変数 | 必須 | 説明 |
|------|------|------|
| `JWT_SECRET` | Yes | JWT 署名鍵（例: `openssl rand -base64 32` で生成） |
| `XAI_API_KEY` | Yes | xAI API キー（[console.x.ai](https://console.x.ai) で取得） |
| `BASE_URL` | No | サーバーの公開 URL（デフォルト: `http://localhost:3000`） |

`BASE_URL` は Vercel デプロイ後、プロジェクトの Settings → Domains で確認できる URL（例: `https://your-project.vercel.app`）を設定する。

## エンドポイント

| パス | メソッド | 説明 |
|------|---------|------|
| `/.well-known/oauth-authorization-server` | GET | OAuth メタデータ |
| `/api/oauth/register` | POST | クライアント登録 |
| `/api/oauth/authorize` | GET/POST | 認可（同意画面 → コード発行） |
| `/api/oauth/token` | POST | トークン発行（PKCE 検証） |
| `/api/mcp` | POST | MCP JSON-RPC endpoint |

## 技術スタック

- [Next.js](https://nextjs.org) 16 (App Router)
- [jose](https://github.com/panva/jose) — JWT 署名・検証
- TypeScript 5

## ライセンス

MIT
