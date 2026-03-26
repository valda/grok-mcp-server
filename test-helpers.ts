import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { clients, type ClientInfo } from "./app/api/oauth/clients";

/** NextRequest を生成する */
export function createRequest(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

/** JSON POST リクエストを生成する */
export function createJsonRequest(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): NextRequest {
  return createRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** テスト用クライアントを clients Map に登録して返す */
export function registerTestClient(overrides?: Partial<ClientInfo>): ClientInfo {
  const clientId = crypto.randomUUID();
  const info: ClientInfo = {
    client_id: clientId,
    client_name: "Test Client",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    ...overrides,
  };
  clients.set(clientId, info);
  return info;
}

/** PKCE code_verifier / code_challenge ペアを生成する */
export function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}
