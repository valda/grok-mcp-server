import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callXai } from "./xai";

describe("callXai", () => {
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

  it("正常なレスポンスからテキストと response_id を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_abc",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "hello from grok" }],
          },
        ],
      }),
    }));

    const result = await callXai({ prompt: "test", model: "grok-4-1-fast-non-reasoning" });
    expect(result).toEqual({ text: "hello from grok", response_id: "resp_abc" });
  });

  it("XAI_API_KEY 未設定でエラーを投げる", async () => {
    delete process.env.XAI_API_KEY;
    await expect(callXai({ prompt: "test", model: "grok-4-1-fast-non-reasoning" }))
      .rejects.toThrow("XAI_API_KEY");
  });

  it("xAI API エラー時にエラーを投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    }));

    await expect(callXai({ prompt: "test", model: "grok-4-1-fast-non-reasoning" }))
      .rejects.toThrow("xAI API error (429)");
  });

  it("instructions を送信する", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_1",
        output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await callXai({ prompt: "test", model: "grok-4-1-fast-non-reasoning", instructions: "Respond in Japanese" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.instructions).toBe("Respond in Japanese");
  });

  it("output_schema を送信する", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_2",
        output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const schema = { type: "object", properties: { x: { type: "string" } }, required: ["x"], additionalProperties: false };
    await callXai({ prompt: "test", model: "grok-4-1-fast-non-reasoning", output_schema: schema });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.schema).toEqual(schema);
  });
});
