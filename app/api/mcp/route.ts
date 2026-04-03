/**
 * MCP サーバー本体 — POST-only JSON-RPC endpoint
 *
 * claude.ai からの MCP リクエストを受け付け、
 * Grok API（xAI）へプロキシする `x_search` ツールを公開する。
 *
 * Transport: Vercel Serverless 前提のため Streamable HTTP (SSE) は不採用。
 * セッション管理: Mcp-Session-Id は initialize 済みマーカーとして扱い、
 * 認証そのものは Bearer access token で行う。
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyJwt,
  type AccessTokenPayload,
} from "../oauth/jwt";
import { mcpCorsHeaders, mcpOptionsResponse } from "./cors";
import { X_SEARCH_TOOL, handleXSearchCall } from "@/lib/tools";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonRpcResult(id: string | number | null, result: unknown, extraHeaders?: Record<string, string>) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, result },
    { headers: { ...mcpCorsHeaders, ...extraHeaders } },
  );
}

function jsonRpcError(id: string | number | null, code: number, message: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { headers: mcpCorsHeaders },
  );
}

/** Bearer トークンを検証する。成功時は payload とトークン文字列、失敗時は NextResponse を返す */
async function authenticate(request: NextRequest): Promise<
  { ok: true; payload: AccessTokenPayload; token: string } | { ok: false; response: NextResponse }
> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: mcpCorsHeaders },
      ),
    };
  }

  const payload = await verifyJwt<AccessTokenPayload>(token);
  if (!payload || payload.type !== "access_token") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: mcpCorsHeaders },
      ),
    };
  }

  return { ok: true, payload, token };
}

/** initialize 済みかどうかをヘッダー有無で確認する */
function hasSessionHeader(request: NextRequest): boolean {
  return !!request.headers.get("mcp-session-id");
}

function sessionHeaders(accessToken: string): Record<string, string> {
  return { "Mcp-Session-Id": accessToken };
}

function toolResult(id: string | number | null, text: string, isError = false, extraHeaders?: Record<string, string>) {
  return jsonRpcResult(id, {
    content: [{ type: "text", text }],
    ...(isError && { isError: true }),
  }, extraHeaders);
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 認証
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  // ボディパース
  const body = await request.json().catch(() => null);
  console.log("[MCP] request:", JSON.stringify(body));

  if (!body || !body.method) {
    return jsonRpcError(body?.id ?? null, -32700, "Parse error");
  }

  const { method, id, params } = body;

  // --- initialize ---
  if (method === "initialize") {
    return jsonRpcResult(
      id,
      {
        protocolVersion: "2025-03-26",
        serverInfo: { name: "grok-mcp-server", version: "0.1.0" },
        capabilities: { tools: {} },
      },
      sessionHeaders(auth.token),
    );
  }

  // --- initialize 以降はセッションヘッダー必須 ---
  if (!hasSessionHeader(request)) {
    return jsonRpcError(id ?? null, -32000, "Missing Mcp-Session-Id");
  }

  // --- notifications ---
  if (typeof method === "string" && method.startsWith("notifications/")) {
    return new NextResponse(null, { status: 202, headers: mcpCorsHeaders });
  }

  const headers = sessionHeaders(auth.token);

  // --- tools/list ---
  if (method === "tools/list") {
    return jsonRpcResult(id, { tools: [X_SEARCH_TOOL] }, headers);
  }

  // --- tools/call ---
  if (method === "tools/call") {
    if (params?.name !== "x_search") {
      return jsonRpcError(id, -32602, `Unknown tool: ${params?.name}`);
    }

    const args = params.arguments ?? {};
    const result = await handleXSearchCall(args);
    return toolResult(id, result.content[0].text, result.isError ?? false, headers);
  }

  // --- 不明メソッド ---
  return jsonRpcError(id ?? null, -32601, `Method not found: ${method}`);
}

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405, headers: mcpCorsHeaders },
  );
}

export async function DELETE(_request: NextRequest) {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405, headers: mcpCorsHeaders },
  );
}

export async function OPTIONS() {
  return mcpOptionsResponse();
}
