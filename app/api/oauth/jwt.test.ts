import { describe, it, expect } from "vitest";
import {
  signAuthorizationCode,
  signAccessToken,
  signRefreshToken,
  verifyJwt,
  type AuthorizationCodePayload,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from "./jwt";

describe("jwt utilities", () => {
  describe("signAccessToken / verifyJwt", () => {
    it("ラウンドトリップで正しいペイロードを返す", async () => {
      const token = await signAccessToken("client-123");
      const payload = await verifyJwt<AccessTokenPayload>(token);
      expect(payload).not.toBeNull();
      expect(payload!.type).toBe("access_token");
      expect(payload!.client_id).toBe("client-123");
      expect(payload!.exp).toBeDefined();
    });
  });

  describe("signAuthorizationCode / verifyJwt", () => {
    it("ラウンドトリップで正しいペイロードを返す", async () => {
      const token = await signAuthorizationCode({
        client_id: "client-456",
        redirect_uri: "http://example.com/callback",
        code_challenge: "abc123",
      });
      const payload = await verifyJwt<AuthorizationCodePayload>(token);
      expect(payload).not.toBeNull();
      expect(payload!.type).toBe("authorization_code");
      expect(payload!.client_id).toBe("client-456");
      expect(payload!.redirect_uri).toBe("http://example.com/callback");
      expect(payload!.code_challenge).toBe("abc123");
    });
  });

  describe("signRefreshToken / verifyJwt", () => {
    it("ラウンドトリップで正しいペイロードを返す", async () => {
      const token = await signRefreshToken("client-789");
      const payload = await verifyJwt<RefreshTokenPayload>(token);
      expect(payload).not.toBeNull();
      expect(payload!.type).toBe("refresh_token");
      expect(payload!.client_id).toBe("client-789");
    });
  });

  describe("verifyJwt 異常系", () => {
    it("不正なトークンで null を返す", async () => {
      expect(await verifyJwt("not-a-jwt")).toBeNull();
    });

    it("改ざんされたトークンで null を返す", async () => {
      const token = await signAccessToken("client-1");
      const tampered = token.slice(0, -5) + "XXXXX";
      expect(await verifyJwt(tampered)).toBeNull();
    });
  });

  describe("getSecret", () => {
    it("JWT_SECRET 未設定で throw する", async () => {
      const original = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      try {
        await expect(signAccessToken("x")).rejects.toThrow("JWT_SECRET");
      } finally {
        process.env.JWT_SECRET = original;
      }
    });
  });
});
