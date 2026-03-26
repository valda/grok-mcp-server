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
    setupComplete: "\u2705 セットアップ完了",
    setupRequired: "\u26a0\ufe0f セットアップが必要です",
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
      '<a href="https://claude.ai" target="_blank" rel="noopener noreferrer" style="color: var(--accent)">claude.ai</a> を開く',
      "画面左下の自分のアイコン &rarr; <strong>設定</strong> を開く",
      "左メニューから <strong>コネクタ</strong> を選択",
      '<strong>カスタムコネクタを追加</strong> をクリックし、<strong>名前</strong>に "grok-mcp-server"、<strong>リモートMCPサーバーURL</strong>に上記の URL を入力',
      "認可画面が表示されたら <code style=\"background: var(--code-bg); padding: 0.1rem 0.3rem; border-radius: 3px\">AUTHORIZE_PASSWORD</code> に設定したパスワードを入力して許可",
      "チャットで <strong>ask_grok</strong> ツールが使えるようになります",
    ],
  },
  en: {
    subtitle: "An MCP server that proxies to the xAI Grok API.",
    setupComplete: "\u2705 Setup Complete",
    setupRequired: "\u26a0\ufe0f Setup Required",
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
      'Open <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" style="color: var(--accent)">claude.ai</a>',
      "Click your avatar at the bottom left &rarr; <strong>Settings</strong>",
      "Select <strong>Integrations</strong> from the left menu",
      'Click <strong>Add More</strong>, enter "grok-mcp-server" as the <strong>Name</strong> and paste the URL above as the <strong>Remote MCP Server URL</strong>',
      "When the authorization screen appears, enter the password you set for <code style=\"background: var(--code-bg); padding: 0.1rem 0.3rem; border-radius: 3px\">AUTHORIZE_PASSWORD</code>",
      "The <strong>ask_grok</strong> tool is now available in your chats",
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
    <div style={{ fontFamily: "system-ui, sans-serif", display: "flex", justifyContent: "center", minHeight: "100vh", margin: 0, padding: "2rem 1rem" }}>
      <main style={{ maxWidth: 600, width: "100%" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Grok MCP Server</h1>
        <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: "2rem" }}>{t.subtitle}</p>

        {/* ステータス */}
        <section style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 1rem" }}>
            {allRequiredSet ? t.setupComplete : t.setupRequired}
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--table-border)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0" }}>{t.colVar}</th>
                <th style={{ padding: "0.5rem 0" }}>{t.colStatus}</th>
                <th style={{ padding: "0.5rem 0" }}>{t.colRequired}</th>
              </tr>
            </thead>
            <tbody>
              {envVars.map((v) => (
                <tr key={v.name} style={{ borderBottom: "1px solid var(--table-border)" }}>
                  <td style={{ padding: "0.5rem 0" }}>
                    <code style={{ background: "var(--code-bg)", padding: "0.1rem 0.3rem", borderRadius: 3 }}>{v.name}</code>
                    <div style={{ color: "var(--muted-light)", fontSize: "0.75rem", marginTop: "0.15rem" }}>{v.description}</div>
                  </td>
                  <td style={{ padding: "0.5rem 0" }}>
                    {v.set
                      ? <span style={{ color: "var(--status-ok)", fontWeight: 600 }}>{t.statusSet}</span>
                      : <span style={{ color: "var(--status-ng)", fontWeight: 600 }}>{t.statusUnset}</span>
                    }
                  </td>
                  <td style={{ padding: "0.5rem 0" }}>{v.required ? t.required : t.optional}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* JWT_SECRET ジェネレーター */}
        <section style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, marginBottom: "1.5rem", overflow: "hidden" }}>
          <details open={!jwtSecretSet || undefined}>
            <summary style={{ padding: "1.5rem", cursor: "pointer", fontSize: "1.1rem", fontWeight: 600 }}>
              {t.generatorTitle} {jwtSecretSet && <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--muted)" }}>{t.generatorConfigured}</span>}
            </summary>
            <div style={{ padding: "0 1.5rem 1.5rem" }}>
              <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>{t.generatorDesc}</p>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="text"
                  id="jwt-secret"
                  readOnly
                  placeholder={t.generatorPlaceholder}
                  style={{ flex: 1, padding: "0.5rem", border: "1px solid var(--input-border)", borderRadius: 6, fontSize: "0.875rem", fontFamily: "monospace", background: "var(--input-bg)", color: "var(--foreground)" }}
                />
                <button
                  id="generate-btn"
                  style={{ padding: "0.5rem 1rem", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem", whiteSpace: "nowrap" }}
                >
                  {t.generate}
                </button>
                <button
                  id="copy-btn"
                  style={{ padding: "0.5rem 1rem", background: "var(--btn-secondary)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem", whiteSpace: "nowrap" }}
                >
                  {t.copy}
                </button>
              </div>
            </div>
          </details>
        </section>

        {/* 設定手順 */}
        <section style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, marginBottom: "1.5rem", overflow: "hidden" }}>
          <details open={!allRequiredSet || undefined}>
            <summary style={{ padding: "1.5rem", cursor: "pointer", fontSize: "1.1rem", fontWeight: 600 }}>
              {t.vercelTitle} {allRequiredSet && <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--muted)" }}>{t.vercelConfigured}</span>}
            </summary>
            <div style={{ padding: "0 1.5rem 1.5rem" }}>
              <ol style={{ color: "var(--foreground)", fontSize: "0.875rem", margin: 0, paddingLeft: "1.25rem", lineHeight: 1.8 }}>
                {t.vercelSteps.map((step, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
                ))}
              </ol>
            </div>
          </details>
        </section>

        {/* Claude.ai での接続手順 */}
        {allRequiredSet && (
          <section style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem" }}>{t.claudeTitle}</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 0.75rem" }}>{t.claudeDesc}</p>
            <code style={{ display: "block", background: "var(--code-bg)", padding: "0.75rem", borderRadius: 6, fontSize: "0.875rem", wordBreak: "break-all", marginBottom: "1rem" }}>
              {mcpUrl}
            </code>
            <ol style={{ color: "var(--foreground)", fontSize: "0.875rem", margin: 0, paddingLeft: "1.25rem", lineHeight: 1.8 }}>
              {t.claudeSteps.map((step, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
              ))}
            </ol>
          </section>
        )}

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
            `,
          }}
        />
      </main>
    </div>
  );
}
