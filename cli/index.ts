/**
 * stdio MCP サーバーエントリポイント
 *
 * npx / グローバルインストールで実行可能な MCP サーバー。
 * @modelcontextprotocol/sdk の McpServer + StdioServerTransport を使用。
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { X_SEARCH_TOOL, handleXSearchCall } from "../lib/tools.js";

const version = "0.1.0";

const server = new McpServer({
  name: "grok-mcp-server",
  version,
});

const schema = X_SEARCH_TOOL.inputSchema;

server.registerTool(
  X_SEARCH_TOOL.name,
  {
    description: X_SEARCH_TOOL.description,
    inputSchema: {
      prompt: z.string().describe(schema.properties.prompt.description),
      instructions: z
        .string()
        .optional()
        .describe(schema.properties.instructions.description),
      previous_response_id: z
        .string()
        .optional()
        .describe(schema.properties.previous_response_id.description),
      output_schema: z
        .record(z.string(), z.any())
        .optional()
        .describe("JSON Schema for structured output"),
      model: z
        .string()
        .optional()
        .describe(schema.properties.model.description),
    },
  },
  async (args) => {
    return await handleXSearchCall(args as Record<string, unknown>);
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
