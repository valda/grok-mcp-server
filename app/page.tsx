export const dynamic = "force-dynamic";

interface EnvStatus {
  name: string;
  set: boolean;
  required: boolean;
  description: string;
}

export default function Home() {
  const envVars: EnvStatus[] = [
    {
      name: "JWT_SECRET",
      set: !!process.env.JWT_SECRET,
      required: true,
      description: "JWT 署名鍵（下のジェネレーターで生成できます）",
    },
    {
      name: "XAI_API_KEY",
      set: !!process.env.XAI_API_KEY,
      required: true,
      description: "xAI API キー（https://console.x.ai で取得）",
    },
    {
      name: "AUTHORIZE_PASSWORD",
      set: !!process.env.AUTHORIZE_PASSWORD,
      required: true,
      description: "OAuth 認可画面のパスワード",
    },
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
        <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: "2rem" }}>
          xAI Grok API へプロキシする MCP サーバーです。
        </p>

        {/* ステータス */}
        <section style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 1rem" }}>
            {allRequiredSet ? "\u2705 セットアップ完了" : "\u26a0\ufe0f セットアップが必要です"}
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--table-border)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0" }}>変数</th>
                <th style={{ padding: "0.5rem 0" }}>状態</th>
                <th style={{ padding: "0.5rem 0" }}>必須</th>
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
                      ? <span style={{ color: "var(--status-ok)", fontWeight: 600 }}>設定済み</span>
                      : <span style={{ color: "var(--status-ng)", fontWeight: 600 }}>未設定</span>
                    }
                  </td>
                  <td style={{ padding: "0.5rem 0" }}>{v.required ? "必須" : "任意"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* JWT_SECRET ジェネレーター */}
        <section style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, marginBottom: "1.5rem", overflow: "hidden" }}>
          <details open={!jwtSecretSet || undefined}>
            <summary style={{ padding: "1.5rem", cursor: "pointer", fontSize: "1.1rem", fontWeight: 600 }}>
              JWT_SECRET ジェネレーター {jwtSecretSet && <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--muted)" }}>（設定済み）</span>}
            </summary>
            <div style={{ padding: "0 1.5rem 1.5rem" }}>
              <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
                ボタンを押すとブラウザ上で安全にランダムな鍵を生成します。サーバーには送信されません。
              </p>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="text"
                  id="jwt-secret"
                  readOnly
                  placeholder="ここに生成された鍵が表示されます"
                  style={{ flex: 1, padding: "0.5rem", border: "1px solid var(--input-border)", borderRadius: 6, fontSize: "0.875rem", fontFamily: "monospace", background: "var(--input-bg)", color: "var(--foreground)" }}
                />
                <button
                  id="generate-btn"
                  style={{ padding: "0.5rem 1rem", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem", whiteSpace: "nowrap" }}
                >
                  生成
                </button>
                <button
                  id="copy-btn"
                  style={{ padding: "0.5rem 1rem", background: "var(--btn-secondary)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem", whiteSpace: "nowrap" }}
                >
                  コピー
                </button>
              </div>
            </div>
          </details>
        </section>

        {/* 設定手順 */}
        <section style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, marginBottom: "1.5rem", overflow: "hidden" }}>
          <details open={!allRequiredSet || undefined}>
            <summary style={{ padding: "1.5rem", cursor: "pointer", fontSize: "1.1rem", fontWeight: 600 }}>
              Vercel での設定手順 {allRequiredSet && <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--muted)" }}>（設定完了）</span>}
            </summary>
            <div style={{ padding: "0 1.5rem 1.5rem" }}>
              <ol style={{ color: "var(--foreground)", fontSize: "0.875rem", margin: 0, paddingLeft: "1.25rem", lineHeight: 1.8 }}>
                <li>Vercel ダッシュボードでプロジェクトを開く</li>
                <li><strong>Settings &rarr; Environment Variables</strong> へ移動</li>
                <li>上記の必須変数をすべて追加する</li>
                <li><strong>Deployments</strong> から最新デプロイを <strong>Redeploy</strong></li>
                <li>このページをリロードして、すべて「設定済み」になっていることを確認</li>
              </ol>
            </div>
          </details>
        </section>

        {/* Claude.ai での接続手順 */}
        {allRequiredSet && (
          <section style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem" }}>Claude.ai での接続手順</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 0.75rem" }}>
              以下の URL を Claude.ai に MCP サーバーとして登録してください。
            </p>
            <code style={{ display: "block", background: "var(--code-bg)", padding: "0.75rem", borderRadius: 6, fontSize: "0.875rem", wordBreak: "break-all", marginBottom: "1rem" }}>
              {mcpUrl}
            </code>
            <ol style={{ color: "var(--foreground)", fontSize: "0.875rem", margin: 0, paddingLeft: "1.25rem", lineHeight: 1.8 }}>
              <li><a href="https://claude.ai" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>claude.ai</a> を開く</li>
              <li>画面左下の自分のアイコン &rarr; <strong>Settings</strong> を開く</li>
              <li>左メニューから <strong>Integrations</strong> を選択</li>
              <li><strong>Add More</strong> をクリックし、上記の URL を入力</li>
              <li>認可画面が表示されたら <code style={{ background: "var(--code-bg)", padding: "0.1rem 0.3rem", borderRadius: 3 }}>AUTHORIZE_PASSWORD</code> に設定したパスワードを入力して許可</li>
              <li>チャットで <strong>ask_grok</strong> ツールが使えるようになります</li>
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
                  this.textContent = "OK!";
                  var btn = this;
                  setTimeout(function() { btn.textContent = "コピー"; }, 1500);
                }
              });
            `,
          }}
        />
      </main>
    </div>
  );
}
