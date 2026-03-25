/**
 * MCP エンドポイント専用の CORS ヘッダー
 *
 * OAuth 用とは分離。Mcp-Session-Id ヘッダーの送受信を許可する。
 */

import { NextResponse } from "next/server";

export const mcpCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

export function mcpOptionsResponse() {
  return new NextResponse(null, { status: 204, headers: mcpCorsHeaders });
}
