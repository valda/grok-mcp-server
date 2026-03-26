import { describe, it, expect } from "vitest";
import { GET, POST } from "./route";
import { createRequest, registerTestClient, generatePkce } from "../../../../test-helpers";

function authorizeUrl(clientId: string, overrides?: Record<string, string>) {
  const base = new URL("http://localhost:3000/api/oauth/authorize");
  const { codeChallenge } = generatePkce();
  const defaults: Record<string, string> = {
    client_id: clientId,
    redirect_uri: "http://localhost:3000/callback",
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: "test-state",
  };
  const params = { ...defaults, ...overrides };
  for (const [k, v] of Object.entries(params)) {
    base.searchParams.set(k, v);
  }
  return base.toString();
}

describe("GET /api/oauth/authorize", () => {
  it("正常リクエストで同意画面 HTML を返す", async () => {
    const client = registerTestClient();
    const req = createRequest(authorizeUrl(client.client_id));
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain(client.client_name);
  });

  it("redirect_uri 未指定で 400 JSON を返す", async () => {
    const url = "http://localhost:3000/api/oauth/authorize?client_id=x&response_type=code";
    const req = createRequest(url);
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
  });

  it("未登録 client_id で 302 エラーリダイレクトする", async () => {
    const url = authorizeUrl("unknown-client");
    const req = createRequest(url);
    const res = await GET(req);
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("error=invalid_request");
  });

  it("code_challenge 未指定でエラーリダイレクトする", async () => {
    const client = registerTestClient();
    const url = new URL("http://localhost:3000/api/oauth/authorize");
    url.searchParams.set("client_id", client.client_id);
    url.searchParams.set("redirect_uri", client.redirect_uris[0]);
    url.searchParams.set("response_type", "code");
    // code_challenge を意図的に省略
    const req = createRequest(url.toString());
    const res = await GET(req);
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("error=invalid_request");
    expect(location).toContain("code_challenge");
  });
});

describe("POST /api/oauth/authorize", () => {
  it("正常送信で 302 + 認可コード付きリダイレクトする", async () => {
    const original = process.env.AUTHORIZE_PASSWORD;
    process.env.AUTHORIZE_PASSWORD = "test-password";
    try {
      const client = registerTestClient();
      const { codeChallenge } = generatePkce();
      const formData = new URLSearchParams({
        client_id: client.client_id,
        redirect_uri: client.redirect_uris[0],
        response_type: "code",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state: "mystate",
        password: "test-password",
      });

      const req = createRequest("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      const res = await POST(req);
      expect(res.status).toBe(302);
      const location = new URL(res.headers.get("location")!);
      expect(location.searchParams.get("code")).toBeDefined();
      expect(location.searchParams.get("state")).toBe("mystate");
    } finally {
      if (original) process.env.AUTHORIZE_PASSWORD = original;
      else delete process.env.AUTHORIZE_PASSWORD;
    }
  });

  it("AUTHORIZE_PASSWORD 未設定時にガイダンスを表示してブロックする", async () => {
    const original = process.env.AUTHORIZE_PASSWORD;
    delete process.env.AUTHORIZE_PASSWORD;
    try {
      const client = registerTestClient();
      const { codeChallenge } = generatePkce();
      const formData = new URLSearchParams({
        client_id: client.client_id,
        redirect_uri: client.redirect_uris[0],
        response_type: "code",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });

      const req = createRequest("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("AUTHORIZE_PASSWORD");
      expect(html).toContain("Environment Variables");
    } finally {
      if (original) process.env.AUTHORIZE_PASSWORD = original;
      else delete process.env.AUTHORIZE_PASSWORD;
    }
  });

  it("AUTHORIZE_PASSWORD 設定時に誤パスワードで 403 を返す", async () => {
    const original = process.env.AUTHORIZE_PASSWORD;
    process.env.AUTHORIZE_PASSWORD = "correct-password";
    try {
      const client = registerTestClient();
      const { codeChallenge } = generatePkce();
      const formData = new URLSearchParams({
        client_id: client.client_id,
        redirect_uri: client.redirect_uris[0],
        response_type: "code",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        password: "wrong-password",
      });

      const req = createRequest("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const html = await res.text();
      expect(html).toContain("password");
    } finally {
      if (original) process.env.AUTHORIZE_PASSWORD = original;
      else delete process.env.AUTHORIZE_PASSWORD;
    }
  });
});
