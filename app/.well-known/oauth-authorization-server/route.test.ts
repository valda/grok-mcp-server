import { describe, it, expect } from "vitest";
import { GET, OPTIONS } from "./route";

describe("GET /.well-known/oauth-authorization-server", () => {
  it("正しいメタデータ構造を返す", async () => {
    process.env.BASE_URL = "https://example.com";
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.issuer).toBe("https://example.com");
    expect(body.authorization_endpoint).toBe("https://example.com/api/oauth/authorize");
    expect(body.token_endpoint).toBe("https://example.com/api/oauth/token");
    expect(body.registration_endpoint).toBe("https://example.com/api/oauth/register");
    expect(body.code_challenge_methods_supported).toEqual(["S256"]);
    expect(body.response_types_supported).toEqual(["code"]);
    expect(body.grant_types_supported).toContain("authorization_code");
    expect(body.grant_types_supported).toContain("refresh_token");
  });

  it("BASE_URL 未設定時にデフォルト値を使う", async () => {
    delete process.env.BASE_URL;
    const res = await GET();
    const body = await res.json();
    expect(body.issuer).toBe("http://localhost:3000");
  });
});

describe("OPTIONS /.well-known/oauth-authorization-server", () => {
  it("204 と CORS ヘッダーを返す", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
