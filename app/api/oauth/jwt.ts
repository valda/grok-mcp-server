/**
 * JWT 署名・検証ユーティリティ
 *
 * 認可コードとアクセストークンを署名付き JWT で発行する。
 * 署名鍵は環境変数 JWT_SECRET から取得する。
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { readEnv } from "@/lib/env";

function getSecret(): Uint8Array {
  const secret = readEnv("JWT_SECRET").value;
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

export interface RefreshTokenPayload extends JWTPayload {
  type: "refresh_token";
  client_id: string;
}

export interface ClientRegistrationPayload extends JWTPayload {
  type: "client_registration";
  client_name: string;
  redirect_uris: string[];
}

/** クライアント登録 JWT を発行する（有効期限なし） */
export async function signClientRegistration(params: {
  client_name: string;
  redirect_uris: string[];
}): Promise<string> {
  return new SignJWT({
    type: "client_registration",
    client_name: params.client_name,
    redirect_uris: params.redirect_uris,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(getSecret());
}

/** client_id JWT を検証し、ClientRegistrationPayload を返す。失敗時は null */
export async function verifyClientRegistration(token: string): Promise<ClientRegistrationPayload | null> {
  const payload = await verifyJwt<ClientRegistrationPayload>(token);
  if (!payload) return null;
  if (payload.type !== "client_registration") return null;
  if (typeof payload.client_name !== "string") return null;
  if (!Array.isArray(payload.redirect_uris)) return null;
  if (!payload.redirect_uris.every((uri) => typeof uri === "string")) return null;
  return payload;
}

/** リフレッシュトークン JWT を発行する（有効期限 30 日） */
export async function signRefreshToken(clientId: string): Promise<string> {
  return new SignJWT({
    type: "refresh_token",
    client_id: clientId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
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
