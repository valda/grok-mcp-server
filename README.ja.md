# grok-mcp-server

claude.ai の Web 版から接続できる **Grok API プロキシ MCP サーバー**。

xAI の Grok モデルに対して、claude.ai 上から `ask_grok` ツールで質問できる。

```
claude.ai  ──OAuth 2.1──▶  grok-mcp-server (Vercel)  ──API──▶  xAI Grok API
```

## クイックスタート

### 1. Vercel にデプロイ

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvalda%2Fgrok-mcp-server&env=JWT_SECRET,XAI_API_KEY,AUTHORIZE_PASSWORD&envDescription=%E7%92%B0%E5%A2%83%E5%A4%89%E6%95%B0%E3%81%AE%E8%A9%B3%E7%B4%B0%E3%81%AF%20README%20%E3%82%92%E5%8F%82%E7%85%A7&envLink=https%3A%2F%2Fgithub.com%2Fvalda%2Fgrok-mcp-server%23%E7%92%B0%E5%A2%83%E5%A4%89%E6%95%B0)

ボタンをクリックすると環境変数の入力画面が表示される。設定値は[環境変数](#環境変数)を参照。

デプロイ完了後、プロジェクトのルート URL を開いてセットアップ状況を確認する。**セットアップダッシュボード**で各変数の設定状況の確認、JWT 署名鍵の生成、残りの手順のガイドが表示される。

### 2. claude.ai から接続

1. [claude.ai](https://claude.ai) にログイン
2. 画面左下の自分のアイコン → **設定** を開く
3. 左メニューから **コネクタ** を選択
4. **カスタムコネクタを追加** をクリックし、**名前**に "grok-mcp-server"、**リモートMCPサーバーURL**に `https://your-project.vercel.app/api/mcp` を入力
5. 認可画面が表示されたら `AUTHORIZE_PASSWORD` に設定したパスワードを入力して許可
6. チャットで `ask_grok` ツールが使えるようになる！

使用例: *「ask_grok を使って、AI コーディングに関する最新の X の投稿を検索して」*

## 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `JWT_SECRET` | Yes | JWT 署名鍵（セットアップダッシュボードで生成、または `openssl rand -base64 32`） |
| `XAI_API_KEY` | Yes | xAI API キー（[console.x.ai](https://console.x.ai) で取得） |
| `AUTHORIZE_PASSWORD` | Yes | 認可画面のパスワード（未設定時は認可がブロックされる） |
| `BASE_URL` | No | サーバーの公開 URL（任意）。Vercel 環境変数（`VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`）から自動取得。ローカルでは `http://localhost:3000`。 |

## 機能

- **リアルタイム X 検索** — Grok の X Search で投稿・トレンド・世論をリアルタイムに検索
- **構造化出力** — `output_schema` に JSON Schema を渡して構造化データを抽出（センチメント、トピック、リアクションなど）
- **チェーン検索** — `previous_response_id` で前回の検索結果を引き継いだ追い検索（深掘り、フィルタ、要約）
- **セットアップダッシュボード** — ルートページ（`/`）で環境変数の設定状況、JWT 署名鍵の生成、Vercel と claude.ai の設定手順を表示
- **日英切り替え** — セットアップダッシュボードと OAuth 認可画面は `Accept-Language` を検出し、日本語または英語で表示

## ローカル開発

```bash
git clone https://github.com/valda/grok-mcp-server.git
cd grok-mcp-server
npm install
cp .env.local.example .env.local  # 値を編集する
npm run dev
```

開発サーバーが `http://localhost:3000` で起動する。

## アーキテクチャ

- **OAuth 2.1** — PKCE 必須、Dynamic Client Registration 対応
- **MCP** — POST-only JSON-RPC endpoint（`ask_grok` ツールを公開）
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
- [Vitest](https://vitest.dev) — ユニット・インテグレーションテスト
- TypeScript 5

## ライセンス

MIT
