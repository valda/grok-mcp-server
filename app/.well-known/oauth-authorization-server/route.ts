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
  return process.env.BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";
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
    code_challenge_methods_supported: ["S256"],
  };

  return NextResponse.json(metadata, { headers: corsHeaders });
}

export async function OPTIONS() {
  return optionsResponse();
}
