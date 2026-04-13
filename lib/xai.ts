export const XAI_API_URL = "https://api.x.ai/v1/responses";
export const DEFAULT_MODEL = "grok-4-1-fast-non-reasoning";
export const REASONING_MODEL = "grok-4-1-fast-reasoning";

export interface CallXaiOptions {
  prompt: string;
  model: string;
  instructions?: string;
  previous_response_id?: string;
  output_schema?: object;
}

export async function callXai(options: CallXaiOptions): Promise<{ text: string; response_id: string }> {
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

  console.error("[xAI] request:", options.model);

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
    console.error("[xAI] error:", response.status);
    throw new Error(`xAI API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  console.error("[xAI] response:", data.id);

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
