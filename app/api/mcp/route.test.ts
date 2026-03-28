import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET, DELETE, OPTIONS } from "./route";
import { signAccessToken } from "../oauth/jwt";
import { createRequest, createJsonRequest } from "../../../test-helpers";

function mcpRequest(
  method: string,
  params: unknown,
  accessToken: string,
  extraHeaders?: Record<string, string>,
) {
  const body = { jsonrpc: "2.0", id: 1, method, params };
  return createJsonRequest("/api/mcp", body, {
    Authorization: `Bearer ${accessToken}`,
    ...extraHeaders,
  });
}

describe("POST /api/mcp", () => {
  let token: string;

  beforeEach(async () => {
    token = await signAccessToken("test-client");
    vi.restoreAllMocks();
  });

  it("認証なしで 401 を返す", async () => {
    const req = createJsonRequest("/api/mcp", { jsonrpc: "2.0", id: 1, method: "initialize" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  describe("initialize", () => {
    it("serverInfo と Mcp-Session-Id ヘッダーを返す", async () => {
      const req = mcpRequest("initialize", {}, token);
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.result.serverInfo.name).toBe("grok-mcp-server");
      expect(body.result.protocolVersion).toBeDefined();
      expect(res.headers.get("mcp-session-id")).toBeDefined();
    });
  });

  describe("tools/list", () => {
    it("ask_grok ツール定義を返す", async () => {
      const req = mcpRequest("tools/list", {}, token, {
        "Mcp-Session-Id": token,
      });
      const res = await POST(req);
      const body = await res.json();
      expect(body.result.tools).toHaveLength(1);
      expect(body.result.tools[0].name).toBe("ask_grok");
    });

    it("Mcp-Session-Id なしで -32000 エラーを返す", async () => {
      const req = mcpRequest("tools/list", {}, token);
      const res = await POST(req);
      const body = await res.json();
      expect(body.error.code).toBe(-32000);
    });
  });

  describe("tools/call ask_grok", () => {
    it("xAI API を呼び出して結果を返す", async () => {
      process.env.XAI_API_KEY = "test-xai-key";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "resp_123",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Grok says hello" }],
            },
          ],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const req = mcpRequest(
        "tools/call",
        { name: "ask_grok", arguments: { prompt: "test query" } },
        token,
        { "Mcp-Session-Id": token },
      );

      const res = await POST(req);
      const body = await res.json();
      const parsed = JSON.parse(body.result.content[0].text);
      expect(parsed.result).toBe("Grok says hello");
      expect(parsed.response_id).toBe("resp_123");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.x.ai/v1/responses",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-xai-key",
          }),
        }),
      );
    });

    it("xAI API エラー時に isError レスポンスを返す", async () => {
      process.env.XAI_API_KEY = "test-xai-key";

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      }));

      const req = mcpRequest(
        "tools/call",
        { name: "ask_grok", arguments: { prompt: "test" } },
        token,
        { "Mcp-Session-Id": token },
      );

      const res = await POST(req);
      const body = await res.json();
      expect(body.result.isError).toBe(true);
      expect(body.result.content[0].text).toContain("xAI API error");
    });

    it("未知のツールで -32602 エラーを返す", async () => {
      const req = mcpRequest(
        "tools/call",
        { name: "unknown_tool", arguments: {} },
        token,
        { "Mcp-Session-Id": token },
      );
      const res = await POST(req);
      const body = await res.json();
      expect(body.error.code).toBe(-32602);
    });
  });

  describe("未知メソッド", () => {
    it("-32601 エラーを返す", async () => {
      const req = mcpRequest("foo/bar", {}, token, { "Mcp-Session-Id": token });
      const res = await POST(req);
      const body = await res.json();
      expect(body.error.code).toBe(-32601);
    });
  });

  describe("notifications", () => {
    it("202 を返す", async () => {
      const req = mcpRequest("notifications/initialized", {}, token, {
        "Mcp-Session-Id": token,
      });
      const res = await POST(req);
      expect(res.status).toBe(202);
    });
  });
});

describe("GET /api/mcp", () => {
  it("405 を返す", async () => {
    const req = createRequest("/api/mcp");
    const res = await GET(req);
    expect(res.status).toBe(405);
  });
});

describe("DELETE /api/mcp", () => {
  it("405 を返す", async () => {
    const req = createRequest("/api/mcp", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(405);
  });
});

describe("OPTIONS /api/mcp", () => {
  it("204 と正しい CORS ヘッダーを返す", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-headers")).toContain("Mcp-Session-Id");
    expect(res.headers.get("access-control-expose-headers")).toContain("Mcp-Session-Id");
  });
});
