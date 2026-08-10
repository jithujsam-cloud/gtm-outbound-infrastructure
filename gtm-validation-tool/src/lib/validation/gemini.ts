import { ICP_VERTICALS } from "@/types";

export interface GeminiIcpResponse {
  vertical_match: boolean;
  matched_vertical: string | null;
  reasoning: string;
}

export async function callGemini(
  apiKey: string,
  prompt: string
): Promise<GeminiIcpResponse> {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error("Prompt cannot be empty");
  }

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "gemini-3.6-flash",
        store: false,
        input: prompt,
        generation_config: {
          max_output_tokens: 512,
          temperature: 0.2,
        },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: {
            type: "object",
            properties: {
              vertical_match: {
                type: "boolean",
                description: "Whether the company matches a target ICP vertical",
              },
              matched_vertical: {
                type: ["string", "null"],
                description: "The matched vertical name or null if no match",
              },
              reasoning: {
                type: "string",
                description: "Short explanation of the ICP classification",
              },
            },
            required: ["vertical_match", "matched_vertical", "reasoning"],
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();

  if (data.status !== "completed") {
    throw new Error(
      `Gemini interaction not completed (status: ${data.status ?? "unknown"})`
    );
  }

  const modelOutput = data?.steps?.find(
    (s: any) => s.type === "model_output"
  );
  const text = modelOutput?.content?.[0]?.text;

  if (!text || typeof text !== "string") {
    throw new Error("Empty Gemini response");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON from Gemini");
  }

  if (typeof parsed.vertical_match !== "boolean") {
    throw new Error("Invalid Gemini response: vertical_match must be a boolean");
  }

  if (typeof parsed.reasoning !== "string") {
    throw new Error("Invalid Gemini response: reasoning must be a string");
  }

  const matchedVertical = parsed.matched_vertical;
  const validVerticals: readonly string[] = ICP_VERTICALS;

  if (matchedVertical === null) {
    return {
      vertical_match: false,
      matched_vertical: null,
      reasoning: parsed.reasoning,
    };
  }

  if (typeof matchedVertical !== "string") {
    throw new Error(
      "Invalid Gemini response: matched_vertical must be a string or null"
    );
  }

  const isInList = validVerticals.includes(matchedVertical);

  return {
    vertical_match: parsed.vertical_match === true && isInList,
    matched_vertical: isInList ? matchedVertical : null,
    reasoning: parsed.reasoning,
  };
}
