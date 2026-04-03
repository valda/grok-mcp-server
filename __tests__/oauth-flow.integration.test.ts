import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as registerPost } from "../app/api/oauth/register/route";
import { POST as authorizePost } from "../app/api/oauth/authorize/route";
import { POST as tokenPost } from "../app/api/oauth/token/route";
import { POST as mcpPost } from "../app/api/mcp/route";
import { createJsonRequest, createRequest, generatePkce } from "../test-helpers";

describe("OAuth フロー一気通貫テスト", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AUTHORIZE_PASSWORD = "integration-test-password";
  });

  it("register → authorize → token → MCP initialize → tools/list → tools/call", async () => {
    // Step 1: クライアント登録
    const regRes = await registerPost(
      createJsonRequest("/api/oauth/register", {
        client_name: "Integration Test",
        redirect_uris: ["http://localhost:3000/callback"],
      }),
    );
    expect(regRes.status).toBe(201);
    const { client_id } = await regRes.json();

    // Step 2: PKCE ペア生成
    const { codeVerifier, codeChallenge } = generatePkce();

    // Step 3: 認可（POST — フォーム送信シミュレート）
    const authForm = new URLSearchParams({
      client_id,
      redirect_uri: "http://localhost:3000/callback",
      response_type: "code",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state: "integration-test",
      password: "integration-test-password",
    });

    const authRes = await authorizePost(
      createRequest("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: authForm.toString(),
      }),
    );
    expect(authRes.status).toBe(302);
    const location = new URL(authRes.headers.get("location")!);
    const code = location.searchParams.get("code")!;
    expect(code).toBeDefined();
    expect(location.searchParams.get("state")).toBe("integration-test");

    // Step 4: トークン交換
    const tokenForm = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id,
      redirect_uri: "http://localhost:3000/callback",
      code_verifier: codeVerifier,
    });

    const tokenRes = await tokenPost(
      createRequest("/api/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenForm.toString(),
      }),
    );
    expect(tokenRes.status).toBe(200);
    const { access_token, refresh_token } = await tokenRes.json();
    expect(access_token).toBeDefined();
    expect(refresh_token).toBeDefined();

    // Step 5: MCP initialize
    const initRes = await mcpPost(
      createJsonRequest(
        "/api/mcp",
        { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
        { Authorization: `Bearer ${access_token}` },
      ),
    );
    expect(initRes.status).toBe(200);
    const initBody = await initRes.json();
    expect(initBody.result.serverInfo.name).toBe("grok-mcp-server");
    const sessionId = initRes.headers.get("mcp-session-id")!;
    expect(sessionId).toBeDefined();

    // Step 6: tools/list
    const listRes = await mcpPost(
      createJsonRequest(
        "/api/mcp",
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        {
          Authorization: `Bearer ${access_token}`,
          "Mcp-Session-Id": sessionId,
        },
      ),
    );
    const listBody = await listRes.json();
    expect(listBody.result.tools[0].name).toBe("x_search");

    // Step 7: tools/call（xAI API モック）
    process.env.XAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "resp_integration",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Integration test response" }],
            },
          ],
        }),
      }),
    );

    const callRes = await mcpPost(
      createJsonRequest(
        "/api/mcp",
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "x_search", arguments: { prompt: "hello" } },
        },
        {
          Authorization: `Bearer ${access_token}`,
          "Mcp-Session-Id": sessionId,
        },
      ),
    );
    const callBody = await callRes.json();
    const parsed = JSON.parse(callBody.result.content[0].text);
    expect(parsed.result).toBe("Integration test response");
    expect(parsed.response_id).toBe("resp_integration");
  });
});
