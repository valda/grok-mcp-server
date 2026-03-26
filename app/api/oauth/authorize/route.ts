/**
 * OAuth 2.1 認可エンドポイント
 *
 * GET:  認可リクエストをバリデーションし、同意画面 HTML を返す
 * POST: ユーザーが許可ボタンを押した後、認可コードを発行してリダイレクト
 */

import { NextRequest, NextResponse } from "next/server";
import { clients } from "../clients";
import { signAuthorizationCode } from "../jwt";

type Locale = "ja" | "en";

function detectLocale(request: NextRequest): Locale {
  const accept = request.headers.get("accept-language") ?? "";
  return accept.split(",").some((l) => l.trim().startsWith("ja")) ? "ja" : "en";
}

const consentMessages = {
  ja: {
    title: "認可リクエスト - Grok MCP Server",
    heading: "Grok MCP Server へのアクセスを許可しますか？",
    requesting: (name: string) => `<span class="client-name">${name}</span> がアクセスを要求しています。`,
    passwordLabel: "パスワード",
    approve: "許可する",
    wrongPassword: "パスワードが正しくありません",
    setupIncomplete: "⚠ セットアップが未完了です",
    setupDesc: "環境変数 <code>AUTHORIZE_PASSWORD</code> が設定されていないため、認可を許可できません。",
    setupSteps: [
      "Vercel ダッシュボードでプロジェクトを開く",
      "<strong>Settings → Environment Variables</strong> へ移動",
      "<code>AUTHORIZE_PASSWORD</code> を追加し、任意のパスワードを設定",
      "プロジェクトを再デプロイ",
    ],
  },
  en: {
    title: "Authorization Request - Grok MCP Server",
    heading: "Allow access to Grok MCP Server?",
    requesting: (name: string) => `<span class="client-name">${name}</span> is requesting access.`,
    passwordLabel: "Password",
    approve: "Allow",
    wrongPassword: "Incorrect password",
    setupIncomplete: "⚠ Setup Incomplete",
    setupDesc: "Authorization is blocked because the <code>AUTHORIZE_PASSWORD</code> environment variable is not set.",
    setupSteps: [
      "Open your project in the Vercel dashboard",
      "Go to <strong>Settings → Environment Variables</strong>",
      "Add <code>AUTHORIZE_PASSWORD</code> with a password of your choice",
      "Redeploy the project",
    ],
  },
} as const;

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
function renderConsentPage(clientName: string, params: URLSearchParams, locale: Locale, errorMessage?: string): NextResponse {
  const t = consentMessages[locale];
  const hiddenInputs = FORWARD_PARAMS
    .map((key) => {
      const value = params.get(key);
      return value
        ? `<input type="hidden" name="${key}" value="${escapeHtml(value)}" />`
        : "";
    })
    .join("\n        ");

  const passwordConfigured = !!process.env.AUTHORIZE_PASSWORD;

  const passwordField = passwordConfigured
    ? `<div style="margin-bottom: 1rem; text-align: left;">
          <label for="password" style="display: block; font-size: 0.875rem; color: #555; margin-bottom: 0.25rem;">${escapeHtml(t.passwordLabel)}</label>
          <input type="password" id="password" name="password" required style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; box-sizing: border-box;" />
        </div>`
    : "";

  const displayError = errorMessage ?? (errorMessage === undefined ? undefined : errorMessage);
  const errorHtml = displayError
    ? `<p style="color: #dc2626; font-size: 0.875rem; margin: 0 0 1rem;">${escapeHtml(displayError)}</p>`
    : "";

  const setupStepsHtml = t.setupSteps.map((step) => `<li>${step}</li>`).join("\n          ");

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(t.title)}</title>
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
    <h1>${escapeHtml(t.heading)}</h1>
    <p>${t.requesting(escapeHtml(clientName))}</p>
    ${errorHtml}
    ${passwordConfigured
      ? `<form method="POST" action="/api/oauth/authorize">
        ${hiddenInputs}
        ${passwordField}
        <button type="submit">${escapeHtml(t.approve)}</button>
    </form>`
      : `<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 1rem; text-align: left;">
        <p style="color: #991b1b; font-weight: bold; margin: 0 0 0.5rem;">${t.setupIncomplete}</p>
        <p style="color: #991b1b; margin: 0 0 0.75rem; font-size: 0.875rem;">${t.setupDesc}</p>
        <ol style="color: #991b1b; font-size: 0.875rem; margin: 0; padding-left: 1.25rem; line-height: 1.6;">
          ${setupStepsHtml}
        </ol>
      </div>`
    }
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

  const locale = detectLocale(request);
  const client = clients.get(params.get("client_id")!)!;
  return renderConsentPage(client.client_name, params, locale);
}

/** POST: パスワード検証 → 認可コードを発行してリダイレクト */
export async function POST(request: NextRequest) {
  const locale = detectLocale(request);
  const formData = await request.formData();
  const params = new URLSearchParams();
  for (const [key, value] of formData.entries()) {
    params.set(key, value.toString());
  }

  const validationError = validateParams(params);
  if (validationError) return validationError;

  // パスワード検証（AUTHORIZE_PASSWORD 未設定時はブロック）
  const expectedPassword = process.env.AUTHORIZE_PASSWORD;
  if (!expectedPassword) {
    const client = clients.get(params.get("client_id")!)!;
    return renderConsentPage(client.client_name, params, locale);
  }
  const password = params.get("password") ?? "";
  if (password !== expectedPassword) {
    const client = clients.get(params.get("client_id")!)!;
    return renderConsentPage(client.client_name, params, locale, consentMessages[locale].wrongPassword);
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
