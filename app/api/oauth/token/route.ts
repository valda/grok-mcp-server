/**
 * OAuth 2.1 トークン発行エンドポイント
 *
 * 認可コード（JWT）をアクセストークン（JWT）に交換する。
 * PKCE code_verifier の検証を行い、不正なリクエストを拒否する。
 * - POST: grant_type=authorization_code のみ対応
 */

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, optionsResponse } from "../cors";
import { verifyJwt, signAccessToken, type AuthorizationCodePayload } from "../jwt";

function oauthError(error: string, description: string) {
  return NextResponse.json(
    { error, error_description: description },
    { status: 400, headers: corsHeaders },
  );
}

/** BASE64URL(SHA256(code_verifier)) を計算 */
function computeCodeChallenge(codeVerifier: string): string {
  const digest = crypto.createHash("sha256").update(codeVerifier).digest();
  return digest.toString("base64url");
}

export async function POST(request: NextRequest) {
  const body = await request.formData().catch(() => null);
  if (!body) {
    return oauthError("invalid_request", "Request body is required");
  }

  const grantType = body.get("grant_type")?.toString();
  if (grantType !== "authorization_code") {
    return oauthError("unsupported_grant_type", "Only authorization_code is supported");
  }

  const code = body.get("code")?.toString();
  const clientId = body.get("client_id")?.toString();
  const redirectUri = body.get("redirect_uri")?.toString();
  const codeVerifier = body.get("code_verifier")?.toString();

  if (!code || !clientId || !redirectUri || !codeVerifier) {
    return oauthError("invalid_request", "code, client_id, redirect_uri, and code_verifier are required");
  }

  // JWT 署名検証・有効期限チェック
  const payload = await verifyJwt<AuthorizationCodePayload>(code);
  if (!payload) {
    return oauthError("invalid_grant", "Invalid or expired authorization code");
  }

  // type チェック
  if (payload.type !== "authorization_code") {
    return oauthError("invalid_grant", "Token is not an authorization code");
  }

  // client_id 一致
  if (payload.client_id !== clientId) {
    return oauthError("invalid_grant", "client_id mismatch");
  }

  // redirect_uri 一致
  if (payload.redirect_uri !== redirectUri) {
    return oauthError("invalid_grant", "redirect_uri mismatch");
  }

  // PKCE 検証
  const expectedChallenge = computeCodeChallenge(codeVerifier);
  if (expectedChallenge !== payload.code_challenge) {
    return oauthError("invalid_grant", "PKCE code_verifier verification failed");
  }

  // アクセストークン発行
  const accessToken = await signAccessToken(clientId);

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
    },
    { headers: corsHeaders },
  );
}

export async function OPTIONS() {
  return optionsResponse();
}
