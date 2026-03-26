/**
 * OAuth 2.1 認可エンドポイント
 *
 * GET:  認可リクエストをバリデーションし、同意画面 HTML を返す
 * POST: ユーザーが許可ボタンを押した後、認可コードを発行してリダイレクト
 */

import { NextRequest, NextResponse } from "next/server";
import { clients } from "../clients";
import { signAuthorizationCode } from "../jwt";

/** redirect_uri にエラーを返すリダイレクトレスポンス */
function errorRedirect(redirectUri: string, error: string, description: string, state?: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return NextResponse.redirect(url.toString(), 302);
}

/**
 * 共通バリデーション — GET / POST 両方で使う
 * 成功時は null、失敗時は NextResponse を返す
 */
function validateParams(params: URLSearchParams): NextResponse | null {
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state") ?? undefined;

  // redirect_uri が無い場合はリダイレクトできないので JSON エラー
  if (!redirectUri) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "redirect_uri is required" },
      { status: 400 },
    );
  }

  // client_id チェック
  const clientId = params.get("client_id");
  if (!clientId) {
    return errorRedirect(redirectUri, "invalid_request", "client_id is required", state);
  }

  const client = clients.get(clientId);
  if (!client) {
    return errorRedirect(redirectUri, "invalid_request", "Unknown client_id", state);
  }

  // redirect_uri が登録済みか
  if (!client.redirect_uris.includes(redirectUri)) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "redirect_uri not registered" },
      { status: 400 },
    );
  }

  // response_type
  if (params.get("response_type") !== "code") {
    return errorRedirect(redirectUri, "unsupported_response_type", "Only response_type=code is supported", state);
  }

  // PKCE 必須
  // NOTE: code_challenge_method は検証していない。メタデータでは S256 のみ宣言しており、
  // token エンドポイントで常に SHA-256 検証を行うため、plain 等で送られても最終的に弾かれる。
  // クライアントは claude.ai 固定のため、早期エラーの実益が薄い。
  if (!params.get("code_challenge")) {
    return errorRedirect(redirectUri, "invalid_request", "code_challenge is required (PKCE)", state);
  }

  return null;
}

const FORWARD_PARAMS = [
  "client_id",
  "redirect_uri",
  "response_type",
  "state",
  "code_challenge",
  "code_challenge_method",
] as const;

/** 同意画面 HTML を生成する */
function renderConsentPage(clientName: string, params: URLSearchParams, errorMessage?: string): NextResponse {
  const hiddenInputs = FORWARD_PARAMS
    .map((key) => {
      const value = params.get(key);
      return value
        ? `<input type="hidden" name="${key}" value="${escapeHtml(value)}" />`
        : "";
    })
    .join("\n        ");

  const needsPassword = !!process.env.AUTHORIZE_PASSWORD;

  const passwordField = needsPassword
    ? `<div style="margin-bottom: 1rem; text-align: left;">
          <label for="password" style="display: block; font-size: 0.875rem; color: #555; margin-bottom: 0.25rem;">パスワード</label>
          <input type="password" id="password" name="password" required style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; box-sizing: border-box;" />
        </div>`
    : "";

  const errorHtml = errorMessage
    ? `<p style="color: #dc2626; font-size: 0.875rem; margin: 0 0 1rem;">${escapeHtml(errorMessage)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>認可リクエスト - Grok MCP Server</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: #fff; border-radius: 12px; padding: 2rem; max-width: 400px; width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; }
    p { color: #555; margin: 0.5rem 0 1.5rem; }
    .client-name { font-weight: bold; color: #111; }
    button { background: #2563eb; color: #fff; border: none; border-radius: 8px; padding: 0.75rem 2rem; font-size: 1rem; cursor: pointer; }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Grok MCP Server へのアクセスを許可しますか？</h1>
    <p><span class="client-name">${escapeHtml(clientName)}</span> がアクセスを要求しています。</p>
    ${errorHtml}
    <form method="POST" action="/api/oauth/authorize">
        ${hiddenInputs}
        ${passwordField}
        <button type="submit">許可する</button>
    </form>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: errorMessage ? 403 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** GET: バリデーション → 同意画面を返す */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const validationError = validateParams(params);
  if (validationError) return validationError;

  const client = clients.get(params.get("client_id")!)!;
  return renderConsentPage(client.client_name, params);
}

/** POST: パスワード検証 → 認可コードを発行してリダイレクト */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params = new URLSearchParams();
  for (const [key, value] of formData.entries()) {
    params.set(key, value.toString());
  }

  const validationError = validateParams(params);
  if (validationError) return validationError;

  // パスワード検証（AUTHORIZE_PASSWORD 未設定時はスキップ）
  const expectedPassword = process.env.AUTHORIZE_PASSWORD;
  if (expectedPassword) {
    const password = params.get("password") ?? "";
    if (password !== expectedPassword) {
      const client = clients.get(params.get("client_id")!)!;
      return renderConsentPage(client.client_name, params, "パスワードが正しくありません");
    }
  }

  const redirectUri = params.get("redirect_uri")!;
  const state = params.get("state") ?? undefined;

  const code = await signAuthorizationCode({
    client_id: params.get("client_id")!,
    redirect_uri: redirectUri,
    code_challenge: params.get("code_challenge")!,
  });

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString(), 302);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
