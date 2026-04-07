import { describe, it, expect } from "vitest";
import { POST, OPTIONS } from "./route";
import { verifyClientRegistration } from "../jwt";
import { createJsonRequest, createRequest } from "../../../../test-helpers";

describe("POST /api/oauth/register", () => {
  it("正常にクライアントを登録できる", async () => {
    const req = createJsonRequest("/api/oauth/register", {
      client_name: "My App",
      redirect_uris: ["http://localhost:3000/callback"],
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.client_id).toBeDefined();
    expect(body.client_name).toBe("My App");
    expect(body.redirect_uris).toEqual(["http://localhost:3000/callback"]);

    // client_id が有効な JWT であることを検証
    const payload = await verifyClientRegistration(body.client_id);
    expect(payload).not.toBeNull();
    expect(payload!.type).toBe("client_registration");
    expect(payload!.client_name).toBe("My App");
    expect(payload!.redirect_uris).toEqual(["http://localhost:3000/callback"]);
  });

  it("redirect_uris 未指定で 400 を返す", async () => {
    const req = createJsonRequest("/api/oauth/register", {});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_client_metadata");
  });

  it("redirect_uris が空配列で 400 を返す", async () => {
    const req = createJsonRequest("/api/oauth/register", { redirect_uris: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("client_name 省略時にデフォルト値が設定される", async () => {
    const req = createJsonRequest("/api/oauth/register", {
      redirect_uris: ["http://example.com/cb"],
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.client_name).toBe("Unknown Client");
  });

  it("redirect_uris に非文字列が含まれると 400 を返す", async () => {
    const req = createJsonRequest("/api/oauth/register", {
      client_name: "Bad App",
      redirect_uris: ["http://localhost:3000/callback", {}],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_client_metadata");
    expect(body.error_description).toContain("strings");
  });

  it("client_name が非文字列だと 400 を返す", async () => {
    const req = createJsonRequest("/api/oauth/register", {
      client_name: { name: "bad" },
      redirect_uris: ["http://localhost:3000/callback"],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_client_metadata");
    expect(body.error_description).toContain("string");
  });

  it("ペイロードが大きすぎる場合に 400 を返す", async () => {
    // MAX_CLIENT_ID_BYTES を超える redirect_uris を生成
    const longUris = Array.from({ length: 20 }, (_, i) =>
      `https://example-${i}.com/${"a".repeat(100)}/callback`,
    );
    const req = createJsonRequest("/api/oauth/register", {
      client_name: "Large Client",
      redirect_uris: longUris,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_client_metadata");
    expect(body.error_description).toContain("too large");
  });
});

describe("OPTIONS /api/oauth/register", () => {
  it("204 と CORS ヘッダーを返す", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
