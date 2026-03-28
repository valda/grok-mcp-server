/**
 * MCP サーバー本体 — POST-only JSON-RPC endpoint
 *
 * claude.ai からの MCP リクエストを受け付け、
 * Grok API（xAI）へプロキシする `ask_grok` ツールを公開する。
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

export const maxDuration = 60;

const XAI_API_URL = "https://api.x.ai/v1/responses";
const DEFAULT_MODEL = "grok-4-1-fast-non-reasoning";

const ASK_GROK_TOOL = {
  name: "ask_grok",
  description: "Search and retrieve posts from X (formerly Twitter). Uses Grok's X Search to fetch real-time posts and trends from X.",
  inputSchema: {
    type: "object" as const,
    properties: {
      prompt: { type: "string" as const, description: "Search query or question (e.g. \"latest posts about AI coding\", \"what is trending on X right now\")" },
      model: {
        type: "string" as const,
        description: `Model to use (default: ${DEFAULT_MODEL})`,
        default: DEFAULT_MODEL,
      },
      instructions: {
        type: "string" as const,
        description: "Instructions to control Grok's behavior and response style. Mutually exclusive with previous_response_id.",
      },
      previous_response_id: {
        type: "string" as const,
        description: "ID of a previous response to continue the conversation. Mutually exclusive with instructions.",
      },
      output_schema: {
        type: "object" as const,
        description: "JSON Schema for structured output. Grok will return JSON conforming to this schema.",
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** xAI API を呼び出す */
async function callXai(options: {
  prompt: string;
  model: string;
  instructions?: string;
  previous_response_id?: string;
  output_schema?: object;
}): Promise<{ text: string; response_id: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY environment variable is not set");
  }

  const requestBody: Record<string, unknown> = {
    model: options.model,
    input: [{ role: "user", content: options.prompt }],
    tools: [{ type: "x_search" }],
  };

  if (options.instructions) {
    requestBody.instructions = options.instructions;
  }
  if (options.previous_response_id) {
    requestBody.previous_response_id = options.previous_response_id;
  }
  if (options.output_schema) {
    requestBody.text = {
      format: {
        type: "json_schema",
        name: "output",
        schema: options.output_schema,
        strict: true,
      },
    };
  }

  console.log("[xAI] request:", JSON.stringify(requestBody));

  const response = await fetch(XAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const body = await response.text();
    console.log("[xAI] error:", response.status, body);
    throw new Error(`xAI API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  console.log("[xAI] response:", JSON.stringify(data));

  // output 配列から type: "message" の content を取り出す
  for (const item of data.output ?? []) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (block.type === "output_text" && block.text) {
          return { text: block.text, response_id: data.id };
        }
      }
    }
  }

  throw new Error("No text content in xAI API response");
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
    return jsonRpcResult(id, { tools: [ASK_GROK_TOOL] }, headers);
  }

  // --- tools/call ---
  if (method === "tools/call") {
    if (params?.name !== "ask_grok") {
      return jsonRpcError(id, -32602, `Unknown tool: ${params?.name}`);
    }

    const args = params.arguments ?? {};

    const prompt = args.prompt;
    if (!prompt || typeof prompt !== "string") {
      return toolResult(id, "prompt is required", true, headers);
    }

    if (args.model != null && typeof args.model !== "string") {
      return toolResult(id, "model must be a string", true, headers);
    }
    const model = args.model || DEFAULT_MODEL;

    if (args.instructions != null && typeof args.instructions !== "string") {
      return toolResult(id, "instructions must be a string", true, headers);
    }

    if (args.previous_response_id != null && typeof args.previous_response_id !== "string") {
      return toolResult(id, "previous_response_id must be a string", true, headers);
    }

    if (args.output_schema != null && !isPlainObject(args.output_schema)) {
      return toolResult(id, "output_schema must be an object", true, headers);
    }

    if (args.instructions && args.previous_response_id) {
      return toolResult(id, "instructions and previous_response_id are mutually exclusive", true, headers);
    }

    try {
      const result = await callXai({
        prompt,
        model,
        instructions: args.instructions,
        previous_response_id: args.previous_response_id,
        output_schema: args.output_schema,
      });
      return toolResult(id, JSON.stringify({ result: result.text, response_id: result.response_id }), false, headers);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return toolResult(id, message, true, headers);
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
