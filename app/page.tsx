import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type Locale = "ja" | "en";

function detectLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return "en";
  return acceptLanguage.split(",").some((l) => l.trim().startsWith("ja")) ? "ja" : "en";
}

interface EnvStatus {
  name: string;
  set: boolean;
  required: boolean;
  description: string;
}

const messages = {
  ja: {
    subtitle: "xAI Grok API へプロキシする MCP サーバーです。",
    setupComplete: "セットアップ完了",
    setupRequired: "セットアップが必要です",
    colVar: "変数",
    colStatus: "状態",
    colRequired: "必須",
    statusSet: "設定済み",
    statusUnset: "未設定",
    required: "必須",
    optional: "任意",
    jwtDesc: "JWT 署名鍵（下のジェネレーターで生成できます）",
    xaiDesc: "xAI API キー（https://console.x.ai で取得）",
    authDesc: "OAuth 認可画面のパスワード",
    generatorTitle: "JWT_SECRET ジェネレーター",
    generatorConfigured: "（設定済み）",
    generatorDesc: "ボタンを押すとブラウザ上で安全にランダムな鍵を生成します。サーバーには送信されません。",
    generatorPlaceholder: "ここに生成された鍵が表示されます",
    generate: "生成",
    copy: "コピー",
    copyDone: "OK!",
    vercelTitle: "Vercel での設定手順",
    vercelConfigured: "（設定完了）",
    vercelSteps: [
      "Vercel ダッシュボードでプロジェクトを開く",
      "<strong>Settings &rarr; Environment Variables</strong> へ移動",
      "上記の必須変数をすべて追加する",
      "<strong>Deployments</strong> から最新デプロイを <strong>Redeploy</strong>",
      "このページをリロードして、すべて「設定済み」になっていることを確認",
    ],
    claudeTitle: "Claude.ai での接続手順",
    claudeDesc: "以下の URL を Claude.ai に MCP サーバーとして登録してください。",
    claudeSteps: [
      '<a href="https://claude.ai" target="_blank" rel="noopener noreferrer">claude.ai</a> を開く',
      "画面左下の自分のアイコン &rarr; <strong>設定</strong> を開く",
      "左メニューから <strong>コネクタ</strong> を選択",
      '<strong>カスタムコネクタを追加</strong> をクリックし、<strong>名前</strong>に "grok-mcp-server"、<strong>リモートMCPサーバーURL</strong>に上記の URL を入力',
      "認可画面が表示されたら <code>AUTHORIZE_PASSWORD</code> に設定したパスワードを入力して許可",
      "チャットで <strong>x_search</strong> ツールが使えるようになります",
    ],
  },
  en: {
    subtitle: "An MCP server that proxies to the xAI Grok API.",
    setupComplete: "Setup Complete",
    setupRequired: "Setup Required",
    colVar: "Variable",
    colStatus: "Status",
    colRequired: "Required",
    statusSet: "Set",
    statusUnset: "Not set",
    required: "Yes",
    optional: "No",
    jwtDesc: "JWT signing key (generate below)",
    xaiDesc: "xAI API key (get one at https://console.x.ai)",
    authDesc: "Password for OAuth authorization screen",
    generatorTitle: "JWT_SECRET Generator",
    generatorConfigured: "(configured)",
    generatorDesc: "Click the button to securely generate a random key in your browser. Nothing is sent to the server.",
    generatorPlaceholder: "Generated key will appear here",
    generate: "Generate",
    copy: "Copy",
    copyDone: "OK!",
    vercelTitle: "Vercel Setup Instructions",
    vercelConfigured: "(complete)",
    vercelSteps: [
      "Open your project in the Vercel dashboard",
      "Go to <strong>Settings &rarr; Environment Variables</strong>",
      "Add all required variables listed above",
      "<strong>Redeploy</strong> from the <strong>Deployments</strong> tab",
      'Reload this page and confirm all variables show "Set"',
    ],
    claudeTitle: "Connecting from Claude.ai",
    claudeDesc: "Register the following URL as an MCP server in Claude.ai.",
    claudeSteps: [
      'Open <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">claude.ai</a>',
      "Click your avatar at the bottom left &rarr; <strong>Settings</strong>",
      "Select <strong>Integrations</strong> from the left menu",
      'Click <strong>Add More</strong>, enter "grok-mcp-server" as the <strong>Name</strong> and paste the URL above as the <strong>Remote MCP Server URL</strong>',
      "When the authorization screen appears, enter the password you set for <code>AUTHORIZE_PASSWORD</code>",
      "The <strong>x_search</strong> tool is now available in your chats",
    ],
  },
} as const;

export default async function Home() {
  const headerList = await headers();
  const locale = detectLocale(headerList.get("accept-language"));
  const t = messages[locale];

  const envVars: EnvStatus[] = [
    { name: "JWT_SECRET", set: !!process.env.JWT_SECRET, required: true, description: t.jwtDesc },
    { name: "XAI_API_KEY", set: !!process.env.XAI_API_KEY, required: true, description: t.xaiDesc },
    { name: "AUTHORIZE_PASSWORD", set: !!process.env.AUTHORIZE_PASSWORD, required: true, description: t.authDesc },
  ];

  const allRequiredSet = envVars.filter((v) => v.required).every((v) => v.set);
  const jwtSecretSet = !!process.env.JWT_SECRET;

  const baseUrl =
    process.env.BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    "http://localhost:3000";
  const mcpUrl = `${baseUrl.replace(/\/$/, "")}/api/mcp`;

  return (
    <div className="page-root">
      <main className="main-content">
        {/* Header */}
        <header className="page-header">
          <div className="logo-icon">
            <img src="/icon.svg" alt="Grok MCP Server" width="36" height="36" />
          </div>
          <h1 className="page-title">Grok MCP Server</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </header>

        {/* Status Section */}
        <section className="card card-animate" style={{ animationDelay: "0.1s" }}>
          <div className="section-header">
            <div className={`status-badge ${allRequiredSet ? "status-ok" : "status-warn"}`}>
              <span className="status-dot" />
              {allRequiredSet ? t.setupComplete : t.setupRequired}
            </div>
          </div>
          <div className="env-list">
            {envVars.map((v) => (
              <div key={v.name} className="env-row">
                <div className="env-info">
                  <code className="env-name">{v.name}</code>
                  <span className="env-desc">{v.description}</span>
                </div>
                <div className="env-status-col">
                  {v.set
                    ? <span className="env-badge env-badge-set">{t.statusSet}</span>
                    : <span className="env-badge env-badge-unset">{t.statusUnset}</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* JWT Generator */}
        <section className="card card-animate" style={{ animationDelay: "0.2s" }}>
          <details open={!jwtSecretSet || undefined}>
            <summary className="card-summary">
              <span className="summary-title">
                {t.generatorTitle}
                {jwtSecretSet && <span className="summary-tag">{t.generatorConfigured}</span>}
              </span>
              <span className="chevron" />
            </summary>
            <div className="card-detail">
              <p className="detail-desc">{t.generatorDesc}</p>
              <div className="generator-row">
                <input
                  type="text"
                  id="jwt-secret"
                  readOnly
                  placeholder={t.generatorPlaceholder}
                  className="gen-input"
                />
                <button id="generate-btn" className="btn btn-accent">{t.generate}</button>
                <button id="copy-btn" className="btn btn-ghost">{t.copy}</button>
              </div>
            </div>
          </details>
        </section>

        {/* Vercel Setup */}
        <section className="card card-animate" style={{ animationDelay: "0.3s" }}>
          <details open={!allRequiredSet || undefined}>
            <summary className="card-summary">
              <span className="summary-title">
                {t.vercelTitle}
                {allRequiredSet && <span className="summary-tag">{t.vercelConfigured}</span>}
              </span>
              <span className="chevron" />
            </summary>
            <div className="card-detail">
              <ol className="steps-list">
                {t.vercelSteps.map((step, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
                ))}
              </ol>
            </div>
          </details>
        </section>

        {/* Claude.ai Connection */}
        {allRequiredSet && (
          <section className="card card-animate" style={{ animationDelay: "0.4s" }}>
            <h2 className="card-heading">{t.claudeTitle}</h2>
            <p className="card-desc">{t.claudeDesc}</p>
            <div className="url-display">
              <code>{mcpUrl}</code>
              <button
                id="copy-url-btn"
                className="btn-copy-url"
                aria-label="Copy URL"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" width="16" height="16">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                </svg>
              </button>
            </div>
            <ol className="steps-list">
              {t.claudeSteps.map((step, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
              ))}
            </ol>
          </section>
        )}

        {/* Footer */}
        <footer className="page-footer card-animate" style={{ animationDelay: "0.5s" }}>
          Grok MCP Server &middot; OAuth 2.1
        </footer>
      </main>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.getElementById("generate-btn").addEventListener("click", function() {
              var arr = new Uint8Array(32);
              crypto.getRandomValues(arr);
              var hex = Array.from(arr).map(function(b) { return b.toString(16).padStart(2, "0"); }).join("");
              document.getElementById("jwt-secret").value = hex;
            });
            document.getElementById("copy-btn").addEventListener("click", function() {
              var input = document.getElementById("jwt-secret");
              if (input.value) {
                navigator.clipboard.writeText(input.value);
                this.textContent = ${JSON.stringify(t.copyDone)};
                var btn = this;
                var label = ${JSON.stringify(t.copy)};
                setTimeout(function() { btn.textContent = label; }, 1500);
              }
            });
            var copyUrlBtn = document.getElementById("copy-url-btn");
            if (copyUrlBtn) {
              copyUrlBtn.addEventListener("click", function() {
                navigator.clipboard.writeText(${JSON.stringify(mcpUrl)});
                this.classList.add("copied");
                var btn = this;
                setTimeout(function() { btn.classList.remove("copied"); }, 1500);
              });
            }
          `,
        }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .page-root {
              position: relative;
              z-index: 1;
              display: flex;
              justify-content: center;
              min-height: 100vh;
              padding: 3rem 1.5rem;
            }

            .main-content {
              max-width: 580px;
              width: 100%;
            }

            /* Header */
            .page-header {
              text-align: center;
              margin-bottom: 2.5rem;
              animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both;
            }

            .logo-icon {
              width: 56px;
              height: 56px;
              margin: 0 auto 1rem;
              border-radius: 14px;
              background: var(--accent-glow);
              border: 1px solid rgba(212,160,74,0.2);
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--accent);
            }

            .page-title {
              font-family: var(--font-display);
              font-weight: 400;
              font-size: 2rem;
              letter-spacing: -0.02em;
              line-height: 1.2;
              margin-bottom: 0.4rem;
            }

            .page-subtitle {
              font-size: 0.9rem;
              font-weight: 300;
              color: var(--text-muted);
              line-height: 1.5;
            }

            /* Cards */
            .card {
              background: var(--surface);
              backdrop-filter: blur(40px) saturate(1.4);
              -webkit-backdrop-filter: blur(40px) saturate(1.4);
              border: 1px solid var(--surface-border);
              border-radius: var(--radius);
              padding: 1.5rem;
              margin-bottom: 1rem;
            }

            .card-animate {
              animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both;
            }

            @keyframes fadeUp {
              from { opacity: 0; transform: translateY(20px); }
              to   { opacity: 1; transform: translateY(0); }
            }

            /* Status Badge */
            .section-header {
              margin-bottom: 1.25rem;
            }

            .status-badge {
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
              font-size: 0.85rem;
              font-weight: 500;
              padding: 0.35rem 0.75rem;
              border-radius: 20px;
            }

            .status-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              flex-shrink: 0;
            }

            .status-ok {
              background: var(--success-bg);
              border: 1px solid var(--success-border);
              color: var(--success);
            }
            .status-ok .status-dot {
              background: var(--success);
              box-shadow: 0 0 8px var(--success);
            }

            .status-warn {
              background: var(--warning-bg);
              border: 1px solid var(--warning-border);
              color: var(--accent);
            }
            .status-warn .status-dot {
              background: var(--accent);
              box-shadow: 0 0 8px var(--accent);
              animation: pulse 2s infinite;
            }

            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }

            /* Env Rows */
            .env-list {
              display: flex;
              flex-direction: column;
              gap: 0;
            }

            .env-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 1rem;
              padding: 0.75rem 0;
              border-bottom: 1px solid var(--surface-border);
            }
            .env-row:last-child {
              border-bottom: none;
              padding-bottom: 0;
            }
            .env-row:first-child {
              padding-top: 0;
            }

            .env-info {
              display: flex;
              flex-direction: column;
              gap: 0.2rem;
              min-width: 0;
            }

            .env-name {
              font-family: var(--font-mono);
              font-size: 0.82rem;
              font-weight: 500;
              color: var(--text);
              background: var(--code-bg);
              border: 1px solid var(--code-border);
              padding: 0.15rem 0.4rem;
              border-radius: 5px;
              width: fit-content;
            }

            .env-desc {
              font-size: 0.72rem;
              color: var(--text-dim);
              font-weight: 300;
            }

            .env-status-col {
              flex-shrink: 0;
            }

            .env-badge {
              font-size: 0.72rem;
              font-weight: 500;
              padding: 0.2rem 0.55rem;
              border-radius: 12px;
              white-space: nowrap;
            }

            .env-badge-set {
              background: var(--success-bg);
              border: 1px solid var(--success-border);
              color: var(--success);
            }

            .env-badge-unset {
              background: var(--error-bg);
              border: 1px solid var(--error-border);
              color: var(--error);
            }

            /* Details / Summary */
            details summary {
              list-style: none;
            }
            details summary::-webkit-details-marker {
              display: none;
            }

            .card-summary {
              display: flex;
              align-items: center;
              justify-content: space-between;
              cursor: pointer;
              padding: 0;
              user-select: none;
            }

            .summary-title {
              font-family: var(--font-display);
              font-size: 1.15rem;
              font-weight: 400;
              display: flex;
              align-items: baseline;
              gap: 0.5rem;
            }

            .summary-tag {
              font-family: var(--font-body);
              font-size: 0.72rem;
              font-weight: 400;
              color: var(--text-dim);
            }

            .chevron {
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: var(--surface);
              border: 1px solid var(--surface-border);
              position: relative;
              flex-shrink: 0;
              transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
            }
            .chevron::before {
              content: '';
              position: absolute;
              top: 50%;
              left: 50%;
              width: 6px;
              height: 6px;
              border-right: 1.5px solid var(--text-muted);
              border-bottom: 1.5px solid var(--text-muted);
              transform: translate(-50%, -60%) rotate(45deg);
              transition: transform 0.3s;
            }
            details[open] .chevron {
              transform: rotate(180deg);
            }

            .card-detail {
              padding-top: 1.25rem;
            }

            .detail-desc {
              font-size: 0.82rem;
              font-weight: 300;
              color: var(--text-muted);
              line-height: 1.5;
              margin-bottom: 1rem;
            }

            /* Generator */
            .generator-row {
              display: flex;
              gap: 0.5rem;
              align-items: center;
            }

            .gen-input {
              flex: 1;
              min-width: 0;
              padding: 0.6rem 0.8rem;
              background: var(--surface);
              border: 1px solid var(--surface-border);
              border-radius: var(--radius-sm);
              color: var(--text);
              font-family: var(--font-mono);
              font-size: 0.82rem;
              font-weight: 400;
              outline: none;
              transition: border-color 0.2s, box-shadow 0.2s;
            }
            .gen-input:focus {
              border-color: var(--accent);
              box-shadow: 0 0 0 3px var(--accent-glow);
            }
            .gen-input::placeholder {
              color: var(--text-dim);
              font-weight: 300;
            }

            /* Buttons */
            .btn {
              padding: 0.55rem 0.9rem;
              border: none;
              border-radius: var(--radius-sm);
              font-family: var(--font-body);
              font-size: 0.82rem;
              font-weight: 600;
              cursor: pointer;
              white-space: nowrap;
              transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
            }
            .btn:active {
              transform: translateY(0) !important;
            }

            .btn-accent {
              background: var(--accent);
              color: var(--accent-text);
            }
            .btn-accent:hover {
              background: var(--accent-hover);
              transform: translateY(-1px);
              box-shadow: 0 4px 16px var(--accent-glow);
            }

            .btn-ghost {
              background: var(--surface);
              border: 1px solid var(--surface-border);
              color: var(--text-muted);
            }
            .btn-ghost:hover {
              background: var(--surface-hover);
              color: var(--text);
              transform: translateY(-1px);
            }

            /* Steps */
            .steps-list {
              font-size: 0.85rem;
              font-weight: 300;
              color: var(--text-muted);
              margin: 0;
              padding-left: 1.25rem;
              line-height: 1.9;
            }
            .steps-list strong {
              font-weight: 500;
              color: var(--text);
            }
            .steps-list code {
              background: var(--code-bg);
              border: 1px solid var(--code-border);
              padding: 0.1rem 0.35rem;
              border-radius: 4px;
              font-size: 0.78rem;
            }

            /* Card heading / desc */
            .card-heading {
              font-family: var(--font-display);
              font-weight: 400;
              font-size: 1.15rem;
              margin-bottom: 0.35rem;
            }

            .card-desc {
              font-size: 0.85rem;
              font-weight: 300;
              color: var(--text-muted);
              margin-bottom: 1rem;
              line-height: 1.5;
            }

            /* URL display */
            .url-display {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              background: var(--code-bg);
              border: 1px solid var(--code-border);
              border-radius: var(--radius-sm);
              padding: 0.65rem 0.9rem;
              margin-bottom: 1.25rem;
            }
            .url-display code {
              flex: 1;
              font-family: var(--font-mono);
              font-size: 0.82rem;
              color: var(--accent);
              word-break: break-all;
              line-height: 1.4;
            }
            .btn-copy-url {
              flex-shrink: 0;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: transparent;
              border: 1px solid var(--surface-border);
              border-radius: 8px;
              color: var(--text-dim);
              cursor: pointer;
              transition: color 0.2s, border-color 0.2s, background 0.2s;
            }
            .btn-copy-url:hover {
              color: var(--text);
              border-color: var(--text-dim);
              background: var(--surface-hover);
            }
            .btn-copy-url.copied {
              color: var(--success);
              border-color: var(--success-border);
              background: var(--success-bg);
            }

            /* Footer */
            .page-footer {
              text-align: center;
              font-size: 0.72rem;
              color: var(--text-dim);
              letter-spacing: 0.04em;
              padding: 1.5rem 0 0;
            }

            /* Responsive */
            @media (max-width: 480px) {
              .page-root { padding: 2rem 1rem; }
              .page-title { font-size: 1.6rem; }
              .generator-row { flex-wrap: wrap; }
              .gen-input { width: 100%; }
              .env-row { flex-direction: column; align-items: flex-start; gap: 0.4rem; }
            }
          `,
        }}
      />
    </div>
  );
}
