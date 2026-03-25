# AGENTS.md

## Project Overview

Grok API プロキシ MCP サーバー。claude.ai の Web 版から接続し、xAI の Grok モデルに質問できる。
Next.js App Router の Route Handlers として OAuth 2.1 認証フロー + MCP エンドポイントを実装。
デプロイ先は Vercel Serverless。

## Commands

- `npm run dev` — 開発サーバー起動（http://localhost:3000）
- `npm run build` — プロダクションビルド
- `npx tsc --noEmit` — 型チェック（lint 代わり、テストフレームワークは未導入）

## Environment Variables

| 変数 | 用途 |
|------|------|
| `BASE_URL` | サーバーの公開URL（未設定時 `http://localhost:3000`） |
| `JWT_SECRET` | JWT 署名鍵（**必須**、未設定時は起動時エラー） |
| `XAI_API_KEY` | xAI API キー（ツール呼び出し時に必要） |

## Architecture

### OAuth 2.1 フロー（`app/api/oauth/`）

```
Client → /.well-known/oauth-authorization-server  (メタデータ取得)
       → /api/oauth/register                      (Dynamic Client Registration)
       → /api/oauth/authorize  GET                 (同意画面表示)
       → /api/oauth/authorize  POST                (認可コード JWT 発行 → redirect)
       → /api/oauth/token                          (認可コード → アクセストークン JWT 交換、PKCE 検証)
```

- 認可コード・アクセストークン・MCPセッションはすべて **ステートレス JWT**（jose ライブラリ）
- クライアント登録情報のみインメモリ `Map`（`app/api/oauth/clients.ts`）
- JWT ユーティリティは `app/api/oauth/jwt.ts` に集約（`signAuthorizationCode`, `signAccessToken`, `signMcpSession`, `verifyJwt`）

### MCP エンドポイント（`app/api/mcp/route.ts`）

- **POST-only** の JSON-RPC endpoint（Vercel Serverless の制約で SSE 非対応）
- `initialize` → セッション JWT 発行（`Mcp-Session-Id` ヘッダー）
- `tools/list` → `ask_grok` ツール定義を返却
- `tools/call` → xAI API (`https://api.x.ai/v1/chat/completions`) へプロキシ
- GET / DELETE は 405

### CORS

OAuth 用（`app/api/oauth/cors.ts`）と MCP 用（`app/api/mcp/cors.ts`）を分離。
MCP 側は `Mcp-Session-Id` ヘッダーの送受信・Expose を許可。

## Design Decisions

- Vercel Serverless 前提のため、すべてのサーバー状態を JWT に埋め込むステートレス設計
- MCP SDK は使わず、薄い JSON-RPC ディスパッチャを自前実装
- Public client のみ対応（client_secret なし）
