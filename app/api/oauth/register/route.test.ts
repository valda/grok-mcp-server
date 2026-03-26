import { describe, it, expect } from "vitest";
import { POST, OPTIONS } from "./route";
import { clients } from "../clients";
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
    expect(clients.has(body.client_id)).toBe(true);
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
});

describe("OPTIONS /api/oauth/register", () => {
  it("204 と CORS ヘッダーを返す", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
