/**
 * MCP ツール定義とハンドラ — x_search ツール
 *
 * xAI の Grok X Search を MCP ツールとして公開する。
 * ツール定義 (X_SEARCH_TOOL) とバリデーション込みの呼び出しハンドラ (handleXSearchCall) を提供する。
 */

import { callXai, DEFAULT_MODEL, REASONING_MODEL } from "./xai";

export type ToolCallResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export const X_SEARCH_TOOL = {
  name: "x_search",
  description: `Search X (formerly Twitter) in real-time using Grok's X Search.
Supports structured output via JSON Schema and multi-turn chaining via response IDs.

Use this tool when you need:
- Real-time posts, trends, or public opinion from X
- Fetching a specific post and its thread/replies by URL
- Structured extraction of X data (topics, sentiment, reactions, etc.)
- Follow-up searches that build on a previous result (drill-down, filtering, summarization)

Workflow for deep research:
1. First call: use output_schema to get structured data + capture response_id
2. Follow-up calls: pass previous_response_id to continue with context

Workflow for thread extraction:
1. Pass the post URL as prompt with output_schema to get structured thread data (original post + top replies ranked by engagement)
2. Use the returned structured data for analysis, commentary, or conversation`,
  inputSchema: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string" as const,
        description: `Search query or question about X posts/trends.
Can also be a direct URL to an X post to fetch its content and thread.
Examples:
- "latest posts about AI coding"
- "what is trending on X right now"
- "public reaction from Japanese users to Anthropic's latest announcement"
- "https://x.com/username/status/123456789 — fetch this post and its replies"`,
      },
      instructions: {
        type: "string" as const,
        description: `System-level instructions for Grok's behavior and output style.
Use to specify language, tone, or formatting constraints.
Controls HOW Grok responds, not WHAT to search (that belongs in prompt).
Examples:
- "Respond in Japanese"
- "Be concise, max 2 sentences per item"
- "Return only a JSON-ready summary with no commentary"
- "Quote post text exactly and do not infer missing facts"
Mutually exclusive with previous_response_id.`,
      },
      previous_response_id: {
        type: "string" as const,
        description: `Response ID from a previous x_search call.
Use for follow-up searches that continue from prior context — e.g. drill down into a specific topic, filter results, or ask a follow-up question.
The response_id is returned in every x_search result.
Mutually exclusive with instructions.`,
      },
      output_schema: {
        type: "object" as const,
        description: `JSON Schema for structured output. When specified, Grok returns JSON conforming to this schema.
Use enums to constrain categorical values and reduce hallucination.
The result field in the response will contain the JSON string.

Thread extraction example schema:
{ "type": "object", "properties": { "original_post": { "type": "object", "properties": { "author": { "type": "string" }, "content": { "type": "string" }, "likes": { "type": "integer" }, "views": { "type": "integer" } }, "required": ["author", "content"], "additionalProperties": false }, "top_replies": { "type": "array", "items": { "type": "object", "properties": { "author": { "type": "string" }, "content": { "type": "string" }, "likes": { "type": "integer" }, "rank": { "type": "integer" }, "sentiment": { "type": "string", "enum": ["positive", "negative", "neutral", "mixed"] } }, "required": ["author", "content", "likes", "rank", "sentiment"], "additionalProperties": false } } }, "required": ["original_post", "top_replies"], "additionalProperties": false }`,
      },
      model: {
        type: "string" as const,
        description: `Model to use. Prefer default for speed. Use ${REASONING_MODEL} when the query involves comparison, causality, or multiple logical steps. Same price.`,
        default: DEFAULT_MODEL,
      },
    },
    required: ["prompt"],
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResult(text: string): ToolCallResult {
  return { content: [{ type: "text", text }], isError: true };
}

/**
 * x_search ツールの引数をバリデートして xAI API を呼び出す。
 * バリデーションエラーや API エラーは isError: true で返す。
 */
export async function handleXSearchCall(args: Record<string, unknown>): Promise<ToolCallResult> {
  const prompt = args.prompt;
  if (!prompt || typeof prompt !== "string") {
    return errorResult("prompt is required");
  }

  if (args.model != null && typeof args.model !== "string") {
    return errorResult("model must be a string");
  }
  const model = (args.model as string | undefined) || DEFAULT_MODEL;

  if (args.instructions != null && typeof args.instructions !== "string") {
    return errorResult("instructions must be a string");
  }

  if (args.previous_response_id != null && typeof args.previous_response_id !== "string") {
    return errorResult("previous_response_id must be a string");
  }

  if (args.output_schema != null && !isPlainObject(args.output_schema)) {
    return errorResult("output_schema must be an object");
  }

  if (args.instructions && args.previous_response_id) {
    return errorResult("instructions and previous_response_id are mutually exclusive");
  }

  try {
    const result = await callXai({
      prompt,
      model,
      instructions: args.instructions as string | undefined,
      previous_response_id: args.previous_response_id as string | undefined,
      output_schema: args.output_schema as object | undefined,
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ result: result.text, response_id: result.response_id }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResult(message);
  }
}
