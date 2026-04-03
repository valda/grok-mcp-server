# grok-mcp-server

X（旧 Twitter）をリアルタイムに検索できる **Grok API プロキシ MCP サーバー**。

`x_search` ツールを使って、AI アシスタントから直接 X の投稿・トレンド・世論を検索できる。

```
MCP Client  ──stdio──▶  grok-mcp-server (npx)  ──API──▶  xAI Grok API
claude.ai   ──OAuth 2.1──▶  grok-mcp-server (Vercel)  ──API──▶  xAI Grok API
```

## クイックスタート

### Option A: npx で使う（Claude Code、LM Studio、Cursor など）

インストール不要。MCP クライアントの設定に以下を追加するだけ:

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

API キーは [console.x.ai](https://console.x.ai) で取得できる。

### Option B: Vercel にデプロイ（claude.ai Web 版）

#### 1. Vercel にデプロイ

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvalda%2Fgrok-mcp-server&env=JWT_SECRET,XAI_API_KEY,AUTHORIZE_PASSWORD&envDescription=%E7%92%B0%E5%A2%83%E5%A4%89%E6%95%B0%E3%81%AE%E8%A9%B3%E7%B4%B0%E3%81%AF%20README%20%E3%82%92%E5%8F%82%E7%85%A7&envLink=https%3A%2F%2Fgithub.com%2Fvalda%2Fgrok-mcp-server%23%E7%92%B0%E5%A2%83%E5%A4%89%E6%95%B0)

ボタンをクリックすると環境変数の入力画面が表示される。設定値は[環境変数](#環境変数)を参照。

デプロイ完了後、プロジェクトのルート URL を開いてセットアップ状況を確認する。**セットアップダッシュボード**で各変数の設定状況の確認、JWT 署名鍵の生成、残りの手順のガイドが表示される。

#### 2. claude.ai から接続

1. [claude.ai](https://claude.ai) にログイン
2. 画面左下の自分のアイコン → **設定** を開く
3. 左メニューから **コネクタ** を選択
4. **カスタムコネクタを追加** をクリックし、**名前**に "grok-mcp-server"、**リモートMCPサーバーURL**に `https://your-project.vercel.app/api/mcp` を入力
5. 認可画面が表示されたら `AUTHORIZE_PASSWORD` に設定したパスワードを入力して許可
6. チャットで `x_search` ツールが使えるようになる！

使用例: *「x_search を使って、AI コーディングに関する最新の X の投稿を検索して」*

## 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `JWT_SECRET` | Yes | JWT 署名鍵（セットアップダッシュボードで生成、または `openssl rand -base64 32`） |
| `XAI_API_KEY` | Yes | xAI API キー（[console.x.ai](https://console.x.ai) で取得） |
| `AUTHORIZE_PASSWORD` | Yes | 認可画面のパスワード（未設定時は認可がブロックされる） |
| `BASE_URL` | No | サーバーの公開 URL（任意）。Vercel 環境変数（`VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`）から自動取得。ローカルでは `http://localhost:3000`。 |

## 機能

- **リアルタイム X 検索** — Grok の X Search で投稿・トレンド・世論をリアルタイムに検索
- **構造化出力** — `output_schema` で任意の JSON Schema を定義し、必要なデータだけを取り出せる（センチメント、トピック、リアクションなど）
- **チェーン検索** — `previous_response_id` で前回の検索結果を引き継いだ追い検索。深掘り・フィルタリング・要約のワークフローを組める
- **スレッド取得** — 投稿 URL を渡すと、元投稿とエンゲージメント順にランク付けされた上位リプライを構造化出力で取得できる
- **デュアルトランスポート** — リモート MCP サーバー（URL を貼るだけ）としても、stdio（`npx`）でローカルでも使える
- **X API 開発者アカウント不要** — xAI の Grok API（X Search 込み）を利用するため、X API アクセスの申請や高額プランへの加入が不要
- **セットアップダッシュボード** — ルートページ（`/`）で環境変数の設定状況、JWT 署名鍵の生成、Vercel と claude.ai の設定手順を表示
- **日英切り替え** — セットアップダッシュボードと OAuth 認可画面は `Accept-Language` を検出し、日本語または英語で表示

## 料金

`x_search` の各呼び出しには xAI API の利用料金が発生する: **トークン料金** + **X Search ツール料金**（$0.005/回）。

デフォルトモデル `grok-4-1-fast-non-reasoning` が最もコスト効率が高い:

| モデル | Input | Cached Input | Output |
|--------|-------|-------------|--------|
| grok-4-1-fast-non-reasoning（**デフォルト**） | $0.20 / 1M tokens | $0.05 / 1M tokens | $0.50 / 1M tokens |
| grok-4-1-fast-reasoning | $0.20 / 1M tokens | $0.05 / 1M tokens | $0.50 / 1M tokens |
| grok-4.20-0309-non-reasoning | $2.00 / 1M tokens | $0.20 / 1M tokens | $6.00 / 1M tokens |
| grok-4.20-0309-reasoning | $2.00 / 1M tokens | $0.20 / 1M tokens | $6.00 / 1M tokens |

最新の料金は [xAI Models and Pricing](https://docs.x.ai/developers/models) を参照。

## ローカル開発

```bash
git clone https://github.com/valda/grok-mcp-server.git
cd grok-mcp-server
npm install
cp .env.local.example .env.local  # 値を編集する
npm run dev
```

開発サーバーが `http://localhost:3000` で起動する。

### CLI（stdio）開発

```bash
npm run build:cli        # dist/cli.js をビルド
npm test                 # 全テスト実行
```

stdio サーバーをローカルでテスト:

```bash
XAI_API_KEY=your-key node dist/cli.js
```

## アーキテクチャ

- **OAuth 2.1** — PKCE 必須、Dynamic Client Registration 対応
- **MCP** — POST-only JSON-RPC endpoint（`x_search` ツールを公開）
- **ステートレス** — 認可コード・アクセストークンは署名付き JWT、`Mcp-Session-Id` はアクセストークンを流用（独立したセッション JWT は不使用）

### エンドポイント

| パス | メソッド | 説明 |
|------|---------|------|
| `/` | GET | セットアップダッシュボード |
| `/.well-known/oauth-authorization-server` | GET | OAuth メタデータ |
| `/api/oauth/register` | POST | クライアント登録 |
| `/api/oauth/authorize` | GET/POST | 認可（同意画面 → コード発行） |
| `/api/oauth/token` | POST | トークン発行（PKCE 検証） |
| `/api/mcp` | POST | MCP JSON-RPC endpoint |

## 技術スタック

- [Next.js](https://nextjs.org) 16 (App Router)
- [jose](https://github.com/panva/jose) — JWT 署名・検証
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP SDK（stdio トランスポート）
- [zod](https://zod.dev) — スキーマバリデーション
- [tsup](https://tsup.egoist.dev) — CLI バンドラー
- [Vitest](https://vitest.dev) — ユニット・インテグレーションテスト
- TypeScript 5

## ライセンス

MIT
