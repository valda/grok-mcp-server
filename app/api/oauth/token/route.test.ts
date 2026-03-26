import { describe, it, expect } from "vitest";
import { POST, OPTIONS } from "./route";
import { signAuthorizationCode, signRefreshToken } from "../jwt";
import { createRequest, registerTestClient, generatePkce } from "../../../../test-helpers";

function tokenRequest(data: Record<string, string>) {
  const body = new URLSearchParams(data);
  return createRequest("/api/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

describe("POST /api/oauth/token", () => {
  describe("authorization_code grant", () => {
    it("正常に認可コードをトークンに交換できる", async () => {
      const client = registerTestClient();
      const { codeVerifier, codeChallenge } = generatePkce();
      const redirectUri = client.redirect_uris[0];

      const code = await signAuthorizationCode({
        client_id: client.client_id,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
      });

      const req = tokenRequest({
        grant_type: "authorization_code",
        code,
        client_id: client.client_id,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
      expect(body.token_type).toBe("Bearer");
      expect(body.expires_in).toBe(3600);
    });

    it("code_verifier 不一致で 400 を返す", async () => {
      const client = registerTestClient();
      const { codeChallenge } = generatePkce();
      const redirectUri = client.redirect_uris[0];

      const code = await signAuthorizationCode({
        client_id: client.client_id,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
      });

      const req = tokenRequest({
        grant_type: "authorization_code",
        code,
        client_id: client.client_id,
        redirect_uri: redirectUri,
        code_verifier: "wrong-verifier",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("invalid_grant");
    });

    it("client_id 不一致で 400 を返す", async () => {
      const client = registerTestClient();
      const { codeVerifier, codeChallenge } = generatePkce();

      const code = await signAuthorizationCode({
        client_id: client.client_id,
        redirect_uri: client.redirect_uris[0],
        code_challenge: codeChallenge,
      });

      const req = tokenRequest({
        grant_type: "authorization_code",
        code,
        client_id: "different-client",
        redirect_uri: client.redirect_uris[0],
        code_verifier: codeVerifier,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("invalid_grant");
    });
  });

  describe("refresh_token grant", () => {
    it("リフレッシュトークンから新しいアクセストークンを発行できる", async () => {
      const client = registerTestClient();
      const refreshToken = await signRefreshToken(client.client_id);

      const req = tokenRequest({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: client.client_id,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBe(refreshToken);
    });
  });

  describe("未対応 grant_type", () => {
    it("unsupported_grant_type エラーを返す", async () => {
      const req = tokenRequest({ grant_type: "client_credentials" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("unsupported_grant_type");
    });
  });
});

describe("OPTIONS /api/oauth/token", () => {
  it("204 と CORS ヘッダーを返す", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
