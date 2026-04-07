import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { signClientRegistration } from "./app/api/oauth/jwt";

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

/** テスト用クライアントを JWT client_id で生成して返す */
export async function registerTestClient(overrides?: {
  client_name?: string;
  redirect_uris?: string[];
}): Promise<{ client_id: string; client_name: string; redirect_uris: string[] }> {
  const client_name = overrides?.client_name ?? "Test Client";
  const redirect_uris = overrides?.redirect_uris ?? ["http://localhost:3000/callback"];
  const client_id = await signClientRegistration({ client_name, redirect_uris });
  return { client_id, client_name, redirect_uris };
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
