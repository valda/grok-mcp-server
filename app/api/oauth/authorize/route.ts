/**
 * OAuth 2.1 認可エンドポイント
 *
 * GET:  認可リクエストをバリデーションし、同意画面 HTML を返す
 * POST: ユーザーが許可ボタンを押した後、認可コードを発行してリダイレクト
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyClientRegistration, signAuthorizationCode } from "../jwt";
import { readEnv, listWhitespaceIssues } from "@/lib/env";

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
    whitespaceWarning: (names: string[]) =>
      `⚠ 以下の環境変数に前後の空白・改行が混入しています（自動 trim で動作中）: ${names.join(", ")}。Vercel ダッシュボードで値を修正してください。`,
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
    whitespaceWarning: (names: string[]) =>
      `⚠ The following environment variables have leading/trailing whitespace (auto-trimmed at runtime): ${names.join(", ")}. Please fix the values in the Vercel dashboard.`,
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

type ValidationResult =
  | { ok: true; clientName: string }
  | { ok: false; response: NextResponse };

/**
 * 共通バリデーション — GET / POST 両方で使う
 * 成功時は ok: true + clientName、失敗時は ok: false + NextResponse を返す
 */
async function validateParams(params: URLSearchParams): Promise<ValidationResult> {
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state") ?? undefined;

  // redirect_uri が無い場合はリダイレクトできないので JSON エラー
  if (!redirectUri) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid_request", error_description: "redirect_uri is required" },
        { status: 400 },
      ),
    };
  }

  // client_id チェック（JWT 署名検証 + 型・shape バリデーション）
  const clientId = params.get("client_id");
  if (!clientId) {
    return { ok: false, response: errorRedirect(redirectUri, "invalid_request", "client_id is required", state) };
  }

  const clientPayload = await verifyClientRegistration(clientId);
  if (!clientPayload) {
    return { ok: false, response: errorRedirect(redirectUri, "invalid_request", "Unknown client_id", state) };
  }

  // redirect_uri が登録済みか
  if (!clientPayload.redirect_uris.includes(redirectUri)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid_request", error_description: "redirect_uri not registered" },
        { status: 400 },
      ),
    };
  }

  // response_type
  if (params.get("response_type") !== "code") {
    return { ok: false, response: errorRedirect(redirectUri, "unsupported_response_type", "Only response_type=code is supported", state) };
  }

  // PKCE 必須
  // NOTE: code_challenge_method は検証していない。メタデータでは S256 のみ宣言しており、
  // token エンドポイントで常に SHA-256 検証を行うため、plain 等で送られても最終的に弾かれる。
  // クライアントは claude.ai 固定のため、早期エラーの実益が薄い。
  if (!params.get("code_challenge")) {
    return { ok: false, response: errorRedirect(redirectUri, "invalid_request", "code_challenge is required (PKCE)", state) };
  }

  return { ok: true, clientName: clientPayload.client_name };
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
    .join("\n            ");

  const passwordConfigured = !!readEnv("AUTHORIZE_PASSWORD").value;
  const whitespaceIssues = listWhitespaceIssues();
  const whitespaceBanner = whitespaceIssues.length > 0
    ? `<div class="warning-banner">${escapeHtml(t.whitespaceWarning(whitespaceIssues))}</div>`
    : "";

  const displayError = errorMessage;

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(t.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}

    :root {
      --bg: #0a0a0b;
      --bg-subtle: #111113;
      --surface: rgba(255,255,255,0.04);
      --surface-border: rgba(255,255,255,0.08);
      --surface-hover: rgba(255,255,255,0.06);
      --text: #e8e6e3;
      --text-muted: #8a877f;
      --text-dim: #5c5a54;
      --accent: #d4a04a;
      --accent-hover: #e2b35e;
      --accent-glow: rgba(212,160,74,0.15);
      --error: #e05252;
      --error-bg: rgba(224,82,82,0.08);
      --error-border: rgba(224,82,82,0.2);
      --warning-bg: rgba(212,160,74,0.06);
      --warning-border: rgba(212,160,74,0.15);
      --radius: 16px;
      --radius-sm: 10px;
      --font-display: 'DM Serif Display', Georgia, serif;
      --font-body: 'Outfit', system-ui, sans-serif;
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f4f2ee;
        --bg-subtle: #eae7e1;
        --surface: rgba(255,255,255,0.7);
        --surface-border: rgba(0,0,0,0.08);
        --surface-hover: rgba(255,255,255,0.9);
        --text: #1a1917;
        --text-muted: #6b6860;
        --text-dim: #9e9a91;
        --accent: #b8872e;
        --accent-hover: #a07626;
        --accent-glow: rgba(184,135,46,0.12);
        --error: #c93c3c;
        --error-bg: rgba(201,60,60,0.06);
        --error-border: rgba(201,60,60,0.15);
        --warning-bg: rgba(184,135,46,0.06);
        --warning-border: rgba(184,135,46,0.12);
      }
    }

    body {
      font-family: var(--font-body);
      background: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 1.5rem;
      position: relative;
      overflow: hidden;
    }

    /* Noise texture overlay */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      opacity: 0.35;
      pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
      background-size: 256px 256px;
    }

    /* Subtle ambient glow */
    body::after {
      content: '';
      position: fixed;
      top: -40%;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: var(--accent-glow);
      filter: blur(120px);
      pointer-events: none;
    }

    .card {
      position: relative;
      background: var(--surface);
      backdrop-filter: blur(40px) saturate(1.4);
      -webkit-backdrop-filter: blur(40px) saturate(1.4);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      padding: 2.5rem 2rem 2rem;
      max-width: 420px;
      width: 100%;
      text-align: center;
      animation: cardIn 0.6s cubic-bezier(0.16,1,0.3,1) both;
    }

    @keyframes cardIn {
      from { opacity: 0; transform: translateY(24px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Shield icon */
    .icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 1.25rem;
      border-radius: 12px;
      background: var(--accent-glow);
      border: 1px solid rgba(212,160,74,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: iconIn 0.6s 0.15s cubic-bezier(0.16,1,0.3,1) both;
    }
    @keyframes iconIn {
      from { opacity: 0; transform: scale(0.8); }
      to   { opacity: 1; transform: scale(1); }
    }
    .icon svg { width: 24px; height: 24px; color: var(--accent); }

    h1 {
      font-family: var(--font-display);
      font-weight: 400;
      font-size: 1.5rem;
      line-height: 1.3;
      letter-spacing: -0.01em;
      margin-bottom: 0.5rem;
      animation: textIn 0.6s 0.2s cubic-bezier(0.16,1,0.3,1) both;
    }

    @keyframes textIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .subtitle {
      font-size: 0.9rem;
      font-weight: 300;
      color: var(--text-muted);
      margin-bottom: 1.75rem;
      line-height: 1.5;
      animation: textIn 0.6s 0.25s cubic-bezier(0.16,1,0.3,1) both;
    }
    .client-name {
      font-weight: 500;
      color: var(--text);
    }

    .divider {
      height: 1px;
      background: var(--surface-border);
      margin: 0 -2rem 1.5rem;
      animation: textIn 0.6s 0.3s cubic-bezier(0.16,1,0.3,1) both;
    }

    /* Form elements */
    form {
      animation: textIn 0.6s 0.35s cubic-bezier(0.16,1,0.3,1) both;
    }

    .field {
      text-align: left;
      margin-bottom: 1.25rem;
    }
    .field label {
      display: block;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.4rem;
    }
    .field input[type="password"] {
      width: 100%;
      padding: 0.7rem 0.9rem;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-family: var(--font-body);
      font-size: 0.95rem;
      font-weight: 400;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .field input[type="password"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }
    .field input[type="password"]::placeholder {
      color: var(--text-dim);
      font-weight: 300;
    }

    .error-msg {
      background: var(--error-bg);
      border: 1px solid var(--error-border);
      border-radius: var(--radius-sm);
      padding: 0.6rem 0.8rem;
      margin-bottom: 1.25rem;
      font-size: 0.85rem;
      color: var(--error);
      text-align: left;
      animation: shake 0.4s cubic-bezier(0.36,0.07,0.19,0.97);
    }

    .warning-banner {
      background: var(--warning-bg);
      border: 1px solid var(--warning-border);
      border-radius: var(--radius-sm);
      padding: 0.6rem 0.8rem;
      margin-bottom: 1.25rem;
      font-size: 0.8rem;
      color: var(--accent);
      text-align: left;
      line-height: 1.5;
    }
    @keyframes shake {
      10%,90% { transform: translateX(-1px); }
      20%,80% { transform: translateX(2px); }
      30%,50%,70% { transform: translateX(-3px); }
      40%,60% { transform: translateX(3px); }
    }

    button[type="submit"] {
      width: 100%;
      padding: 0.75rem 1.5rem;
      background: var(--accent);
      color: #0a0a0b;
      font-family: var(--font-body);
      font-size: 0.9rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
    }
    button[type="submit"]:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 20px var(--accent-glow);
    }
    button[type="submit"]:active {
      transform: translateY(0);
    }

    /* Setup incomplete warning */
    .warning-box {
      background: var(--warning-bg);
      border: 1px solid var(--warning-border);
      border-radius: var(--radius-sm);
      padding: 1.25rem;
      text-align: left;
      animation: textIn 0.6s 0.35s cubic-bezier(0.16,1,0.3,1) both;
    }
    .warning-box .warning-title {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--accent);
      margin-bottom: 0.4rem;
    }
    .warning-box .warning-desc {
      font-size: 0.82rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 0.75rem;
    }
    .warning-box .warning-desc code {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      padding: 0.1em 0.35em;
      border-radius: 4px;
      font-size: 0.8rem;
    }
    .warning-box ol {
      font-size: 0.82rem;
      color: var(--text-muted);
      padding-left: 1.2rem;
      line-height: 1.7;
    }
    .warning-box ol code {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      padding: 0.1em 0.35em;
      border-radius: 4px;
      font-size: 0.78rem;
    }

    /* Footer */
    .footer {
      margin-top: 1.5rem;
      font-size: 0.72rem;
      color: var(--text-dim);
      letter-spacing: 0.04em;
      animation: textIn 0.6s 0.45s cubic-bezier(0.16,1,0.3,1) both;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    </div>
    <h1>${escapeHtml(t.heading)}</h1>
    <p class="subtitle">${t.requesting(escapeHtml(clientName))}</p>
    <div class="divider"></div>
    ${whitespaceBanner}
    ${displayError
      ? `<div class="error-msg">${escapeHtml(displayError)}</div>`
      : ""}
    ${passwordConfigured
      ? `<form method="POST" action="/api/oauth/authorize">
            ${hiddenInputs}
            <div class="field">
              <label for="password">${escapeHtml(t.passwordLabel)}</label>
              <input type="password" id="password" name="password" required placeholder="••••••••" autocomplete="current-password" />
            </div>
            <button type="submit">${escapeHtml(t.approve)}</button>
          </form>`
      : `<div class="warning-box">
            <div class="warning-title">${t.setupIncomplete}</div>
            <p class="warning-desc">${t.setupDesc}</p>
            <ol>
              ${t.setupSteps.map((step) => `<li>${step}</li>`).join("\n              ")}
            </ol>
          </div>`
    }
    <div class="footer">Grok MCP Server &middot; OAuth 2.1</div>
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
  const result = await validateParams(params);
  if (!result.ok) return result.response;

  const locale = detectLocale(request);
  return renderConsentPage(result.clientName, params, locale);
}

/** POST: パスワード検証 → 認可コードを発行してリダイレクト */
export async function POST(request: NextRequest) {
  const locale = detectLocale(request);
  const formData = await request.formData();
  const params = new URLSearchParams();
  for (const [key, value] of formData.entries()) {
    params.set(key, value.toString());
  }

  const result = await validateParams(params);
  if (!result.ok) return result.response;

  // パスワード検証（AUTHORIZE_PASSWORD 未設定時はブロック）
  // env 値は自動 trim（貼り付けによる改行・空白混入の吸収）。
  // フォーム入力側は trim しない — ユーザーのタイポを silent に通すとバグの温床になる。
  const expectedPassword = readEnv("AUTHORIZE_PASSWORD").value;
  if (!expectedPassword) {
    return renderConsentPage(result.clientName, params, locale);
  }
  const password = params.get("password") ?? "";
  if (password !== expectedPassword) {
    return renderConsentPage(result.clientName, params, locale, consentMessages[locale].wrongPassword);
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
