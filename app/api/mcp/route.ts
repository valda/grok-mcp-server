/**
 * MCP サーバー本体 — POST-only JSON-RPC endpoint
 *
 * claude.ai からの MCP リクエストを受け付け、
 * Grok API（xAI）へプロキシする `ask_grok` ツールを公開する。
 *
 * Transport: Vercel Serverless 前提のため Streamable HTTP (SSE) は不採用。
 * セッション管理: Mcp-Session-Id を署名付き JWT で発行（ステートレス）。
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyJwt,
  signMcpSession,
  type AccessTokenPayload,
  type McpSessionPayload,
} from "../oauth/jwt";
import { mcpCorsHeaders, mcpOptionsResponse } from "./cors";

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const DEFAULT_MODEL = "grok-4-1-fast-non-reasoning";

const ASK_GROK_TOOL = {
  name: "ask_grok",
  description: "X（旧Twitter）の投稿を検索・読み出しする。Grok の X Search 機能を使い、X 上の投稿やトレンドをリアルタイムに取得できる。",
  inputSchema: {
    type: "object" as const,
    properties: {
      prompt: { type: "string" as const, description: "検索クエリや質問（例: 「Next.js 15 に関する最新の投稿」「@elonmusk の最近の発言」）" },
      model: {
        type: "string" as const,
        description: `使用するモデル（省略時: ${DEFAULT_MODEL}）`,
        default: DEFAULT_MODEL,
      },
    },
    required: ["prompt"],
  },
};

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

function toolResult(id: string | number | null, text: string, isError = false) {
  return jsonRpcResult(id, {
    content: [{ type: "text", text }],
    ...(isError && { isError: true }),
  });
}

/** Bearer トークンを検証する。成功時は payload、失敗時は NextResponse を返す */
async function authenticate(request: NextRequest): Promise<
  { ok: true; payload: AccessTokenPayload } | { ok: false; response: NextResponse }
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

  return { ok: true, payload };
}

/** Mcp-Session-Id ヘッダーの JWT を検証する */
async function verifySession(request: NextRequest): Promise<McpSessionPayload | null> {
  const sessionToken = request.headers.get("mcp-session-id");
  if (!sessionToken) return null;

  const payload = await verifyJwt<McpSessionPayload>(sessionToken);
  if (!payload || payload.type !== "mcp_session") return null;

  return payload;
}

/** xAI API を呼び出す */
async function callXai(prompt: string, model: string): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY environment variable is not set");
  }

  const response = await fetch(XAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`xAI API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
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
  if (!body || !body.method) {
    return jsonRpcError(body?.id ?? null, -32700, "Parse error");
  }

  const { method, id, params } = body;

  // --- initialize ---
  if (method === "initialize") {
    const sessionId = await signMcpSession(auth.payload.client_id);

    return jsonRpcResult(
      id,
      {
        protocolVersion: "2025-03-26",
        serverInfo: { name: "grok-mcp-server", version: "0.1.0" },
        capabilities: { tools: {} },
      },
      { "Mcp-Session-Id": sessionId },
    );
  }

  // --- initialize 以降はセッション検証必須 ---
  const session = await verifySession(request);
  if (!session) {
    return jsonRpcError(id ?? null, -32000, "Missing or invalid Mcp-Session-Id");
  }

  // --- notifications ---
  if (typeof method === "string" && method.startsWith("notifications/")) {
    return new NextResponse(null, { status: 202, headers: mcpCorsHeaders });
  }

  // --- tools/list ---
  if (method === "tools/list") {
    return jsonRpcResult(id, { tools: [ASK_GROK_TOOL] });
  }

  // --- tools/call ---
  if (method === "tools/call") {
    if (params?.name !== "ask_grok") {
      return jsonRpcError(id, -32602, `Unknown tool: ${params?.name}`);
    }

    const prompt = params.arguments?.prompt;
    if (!prompt || typeof prompt !== "string") {
      return toolResult(id, "prompt is required", true);
    }

    const model = params.arguments?.model || DEFAULT_MODEL;

    try {
      const result = await callXai(prompt, model);
      return toolResult(id, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return toolResult(id, message, true);
    }
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
