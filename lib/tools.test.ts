import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleXSearchCall, X_SEARCH_TOOL } from "./tools";

describe("X_SEARCH_TOOL", () => {
  it("ツール名が x_search である", () => {
    expect(X_SEARCH_TOOL.name).toBe("x_search");
  });

  it("prompt が required である", () => {
    expect(X_SEARCH_TOOL.inputSchema.required).toContain("prompt");
  });
});

describe("handleXSearchCall", () => {
  const originalEnv = process.env.XAI_API_KEY;

  beforeEach(() => {
    process.env.XAI_API_KEY = "test-key";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.XAI_API_KEY = originalEnv;
    } else {
      delete process.env.XAI_API_KEY;
    }
  });

  it("正常な呼び出しで結果を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_123",
        output: [{ type: "message", content: [{ type: "output_text", text: "result text" }] }],
      }),
    }));

    const result = await handleXSearchCall({ prompt: "test query" });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.result).toBe("result text");
    expect(parsed.response_id).toBe("resp_123");
  });

  it("prompt が未指定で isError を返す", async () => {
    const result = await handleXSearchCall({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("prompt is required");
  });

  it("instructions と previous_response_id の同時指定で isError を返す", async () => {
    const result = await handleXSearchCall({
      prompt: "test",
      instructions: "foo",
      previous_response_id: "bar",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("mutually exclusive");
  });

  it("model が文字列でなければ isError を返す", async () => {
    const result = await handleXSearchCall({ prompt: "test", model: 123 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("model must be a string");
  });

  it("output_schema がオブジェクトでなければ isError を返す", async () => {
    const result = await handleXSearchCall({ prompt: "test", output_schema: "not-object" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("output_schema must be an object");
  });

  it("xAI API エラー時に isError を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Server Error",
    }));

    const result = await handleXSearchCall({ prompt: "test" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("xAI API error");
  });
});
