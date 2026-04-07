# AGENTS.md

## Project Overview

Grok API プロキシ MCP サーバー。claude.ai の Web 版から接続し、xAI の Grok モデルに質問できる。
Next.js App Router の Route Handlers として OAuth 2.1 認証フロー + MCP エンドポイントを実装。
デプロイ先は Vercel Serverless。

## Commands

- `npm run dev` — 開発サーバー起動（http://localhost:3000）
- `npm run build` — プロダクションビルド
- `npm run build:cli` — CLI バンドルビルド（`dist/cli.js` 生成）
- `npm test` — Vitest でユニット・インテグレーションテスト実行
- `npx tsc --noEmit` — 型チェック

## Environment Variables

| 変数 | 用途 |
|------|------|
| `JWT_SECRET` | JWT 署名鍵（**必須**） |
| `XAI_API_KEY` | xAI API キー（**必須**、ツール呼び出し時に必要） |
| `AUTHORIZE_PASSWORD` | OAuth 認可画面のパスワード（**必須**、未設定時は認可ブロック） |
| `BASE_URL` | サーバーの公開URL（任意。未設定時は `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → `http://localhost:3000` の順にフォールバック） |

## Architecture

### 共通モジュール（`lib/`）

- `lib/xai.ts` — xAI Responses API 呼び出し（`callXai()`、モデル定数）
- `lib/tools.ts` — `X_SEARCH_TOOL` 定義と `handleXSearchCall()` ハンドラ

Remote 版（`app/api/mcp/route.ts`）と stdio 版（`cli/index.ts`）の両方から利用。

### stdio MCP サーバー（`cli/index.ts`）

- `@modelcontextprotocol/sdk` の `McpServer` + `StdioServerTransport` を使用
- OAuth 不要、`XAI_API_KEY` 環境変数のみ
- `npx grok-mcp-server` で実行可能
- tsup で `dist/cli.js` にバンドル

### OAuth 2.1 フロー（`app/api/oauth/`）

```
Client → /.well-known/oauth-authorization-server  (メタデータ取得)
       → /api/oauth/register                      (Dynamic Client Registration)
       → /api/oauth/authorize  GET                 (同意画面表示)
       → /api/oauth/authorize  POST                (認可コード JWT 発行 → redirect)
       → /api/oauth/token                          (認可コード → アクセストークン JWT 交換、PKCE 検証)
```

- 認可コード・アクセストークン・クライアント登録情報はすべて **ステートレス JWT**（jose ライブラリ）
- `client_id` は署名付き JWT で、登録情報（`redirect_uris`, `client_name`）を内包する（サーバー側状態なし）
- `Mcp-Session-Id` はアクセストークンをそのまま流用（独立したセッション JWT は廃止済み）
- JWT ユーティリティは `app/api/oauth/jwt.ts` に集約（`signClientRegistration`, `verifyClientRegistration`, `signAuthorizationCode`, `signAccessToken`, `signRefreshToken`, `verifyJwt`）

### MCP エンドポイント（`app/api/mcp/route.ts`）

- **POST-only** の JSON-RPC endpoint（Vercel Serverless の制約で SSE 非対応）
- 認証は Bearer access token で行い、`Mcp-Session-Id` は initialize 済みマーカーとして扱う
- `initialize` → アクセストークンを `Mcp-Session-Id` ヘッダーに返却
- `tools/list` → `x_search` ツール定義を返却
- `tools/call` → xAI API (`https://api.x.ai/v1/responses`) へプロキシ
  - `prompt`: 検索クエリ（必須）
  - `instructions`: Grok の振る舞い・出力スタイル制御（`previous_response_id` と排他）
  - `previous_response_id`: 前回の response_id を渡してチェーン検索（深掘り・フィルタ・要約）
  - `output_schema`: JSON Schema による構造化出力（センチメント分析、トピック抽出など）
- GET / DELETE は 405

### CORS

OAuth 用（`app/api/oauth/cors.ts`）と MCP 用（`app/api/mcp/cors.ts`）を分離。
MCP 側は `Mcp-Session-Id` ヘッダーの送受信・Expose を許可。

## Design Decisions

- Vercel Serverless 前提のため、すべてのサーバー状態を JWT に埋め込むステートレス設計
- `Mcp-Session-Id` にアクセストークンを流用し、期限の二重管理を排除（refresh token でアクセストークンを更新すればセッションも自然に延命される）
- Remote 版は自前 JSON-RPC（Vercel Serverless 向け最適化）、stdio 版は MCP SDK（標準準拠）と使い分け
- stdio 版は MCP SDK（`@modelcontextprotocol/sdk`）を使用し、標準的な MCP プロトコル実装に準拠
- Public client のみ対応（client_secret なし、`token_endpoint_auth_methods_supported: ["none"]`）
- デフォルトモデルは `grok-4-1-fast-non-reasoning`（最安: input $0.20 / output $0.50 per 1M tokens）。比較・因果関係・複数ステップの推論が必要なクエリには `grok-4-1-fast-reasoning`（同価格）を `model` パラメータで指定可能
