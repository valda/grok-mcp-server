/**
 * JWT 署名・検証ユーティリティ
 *
 * 認可コードとアクセストークンを署名付き JWT で発行する。
 * 署名鍵は環境変数 JWT_SECRET から取得する。
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export interface AuthorizationCodePayload extends JWTPayload {
  type: "authorization_code";
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
}

export interface AccessTokenPayload extends JWTPayload {
  type: "access_token";
  client_id: string;
}

export interface McpSessionPayload extends JWTPayload {
  type: "mcp_session";
  client_id: string;
}

/** MCP セッション JWT を発行する（有効期限 1 時間） */
export async function signMcpSession(clientId: string): Promise<string> {
  return new SignJWT({
    type: "mcp_session",
    client_id: clientId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .setIssuedAt()
    .sign(getSecret());
}

/** 認可コード JWT を発行する（有効期限 10 分） */
export async function signAuthorizationCode(params: {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
}): Promise<string> {
  return new SignJWT({
    type: "authorization_code",
    client_id: params.client_id,
    redirect_uri: params.redirect_uri,
    code_challenge: params.code_challenge,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .setIssuedAt()
    .sign(getSecret());
}

/** アクセストークン JWT を発行する（有効期限 1 時間） */
export async function signAccessToken(clientId: string): Promise<string> {
  return new SignJWT({
    type: "access_token",
    client_id: clientId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .setIssuedAt()
    .sign(getSecret());
}

/** JWT を検証してペイロードを返す。失敗時は null */
export async function verifyJwt<T extends JWTPayload>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as T;
  } catch {
    return null;
  }
}
