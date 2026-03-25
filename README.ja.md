# grok-mcp-server

claude.ai の Web 版から接続できる **Grok API プロキシ MCP サーバー**。

xAI の Grok モデルに対して、claude.ai 上から `ask_grok` ツールで質問できる。

```
claude.ai  ──OAuth 2.1──▶  grok-mcp-server (Vercel)  ──API──▶  xAI Grok API
```

## クイックスタート

### 1. Vercel にデプロイ

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvalda%2Fgrok-mcp-server&env=JWT_SECRET,XAI_API_KEY,BASE_URL,AUTHORIZE_PASSWORD&envDescription=%E7%92%B0%E5%A2%83%E5%A4%89%E6%95%B0%E3%81%AE%E8%A9%B3%E7%B4%B0%E3%81%AF%20README%20%E3%82%92%E5%8F%82%E7%85%A7&envLink=https%3A%2F%2Fgithub.com%2Fvalda%2Fgrok-mcp-server%23%E7%92%B0%E5%A2%83%E5%A4%89%E6%95%B0)

ボタンをクリックすると環境変数の入力画面が表示される。設定値は[環境変数](#環境変数)を参照。

デプロイ完了後、Vercel ダッシュボードでドメイン（例: `https://your-project.vercel.app`）を確認し、Settings → Environment Variables の `BASE_URL` を更新して再デプロイする。

### 2. claude.ai から接続

1. [claude.ai](https://claude.ai) にログイン
2. **Settings → Integrations → Add More** を開く
3. MCP エンドポイント URL を入力: `https://your-project.vercel.app/api/mcp`
4. **Add** をクリック — OAuth 認可フローが始まる
5. `AUTHORIZE_PASSWORD` に設定したパスワードを入力し **許可する** を押す
6. チャットで `ask_grok` ツールが使えるようになる！

使用例: *「ask_grok を使って、最近の AI に関する X の投稿を検索して」*

## 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `JWT_SECRET` | Yes | JWT 署名鍵（`openssl rand -base64 32` で生成） |
| `XAI_API_KEY` | Yes | xAI API キー（[console.x.ai](https://console.x.ai) で取得） |
| `BASE_URL` | No | サーバーの公開 URL（デフォルト: `http://localhost:3000`） |
| `AUTHORIZE_PASSWORD` | No | 認可画面のパスワード（未設定時は URL を知っていれば誰でも認可できる） |

> **注意**: `AUTHORIZE_PASSWORD` を設定しないと、URL を知っている誰でも認可を通過でき、あなたの xAI API トークンが消費されます。本番環境では必ず設定してください。なお、パスワードは平文での突き合わせのため、強固な認証が必要な場合は別途対策を検討してください。

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
