/**
 * OAuth 2.1 Authorization Server Metadata (RFC 8414)
 *
 * OAuth 認可サーバーのメタデータを JSON で返すエンドポイント。
 * クライアントはこのメタデータを取得して、各エンドポイントの URL や
 * サポートするグラントタイプ・PKCE 方式等を自動的に発見する。
 */

import { NextResponse } from "next/server";
import { corsHeaders, optionsResponse } from "../../api/oauth/cors";

function getBaseUrl(): string {
  const url =
    process.env.BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export async function GET() {
  const baseUrl = getBaseUrl();

  const metadata = {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/oauth/token`,
    registration_endpoint: `${baseUrl}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  };

  return NextResponse.json(metadata, { headers: corsHeaders });
}

export async function OPTIONS() {
  return optionsResponse();
}
