/**
 * OAuth エンドポイント共通の CORS ヘッダー
 */

import { NextResponse } from "next/server";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function optionsResponse() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
