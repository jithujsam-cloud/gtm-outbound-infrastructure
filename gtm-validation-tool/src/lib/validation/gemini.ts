import { ICP_VERTICALS } from "@/types";

export interface GeminiIcpResponse {
  vertical_match: boolean;
  matched_vertical: string | null;
  reasoning: string;
}

export interface BatchLeadInput {
  leadId: string;
  leadBlock: string;
}

export interface BatchIcpResult extends GeminiIcpResponse {
  leadId: string;
}

export async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<GeminiIcpResponse> {
  if (!userPrompt || userPrompt.trim().length === 0) {
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
        system_instruction: systemPrompt,
        input: userPrompt,
        generation_config: {
          max_output_tokens: options?.maxTokens ?? 512,
          temperature: options?.temperature ?? 0.2,
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
  return parseSingleResponse(data);
}

export async function callGeminiBatch(
  apiKey: string,
  systemPrompt: string,
  userCriteria: string,
  leads: BatchLeadInput[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<BatchIcpResult[]> {
  if (leads.length === 0) return [];

  const leadEntries = leads
    .map((l) => l.leadBlock)
    .join("\n\n---\n\n");

  const batchPrompt = `${userCriteria.trim()}

LEADS TO CLASSIFY

${leadEntries}`;

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
        system_instruction: systemPrompt,
        input: batchPrompt,
        generation_config: {
          max_output_tokens: options?.maxTokens ?? 2048,
          temperature: options?.temperature ?? 0.2,
        },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                lead_id: { type: "string" },
                vertical_match: { type: "boolean" },
                matched_vertical: { type: ["string", "null"] },
                reasoning: { type: "string" },
              },
              required: ["lead_id", "vertical_match", "matched_vertical", "reasoning"],
            },
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini batch API error (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();

  if (data.status !== "completed") {
    throw new Error(`Gemini batch interaction not completed (status: ${data.status ?? "unknown"})`);
  }

  const modelOutput = data?.steps?.find((s: any) => s.type === "model_output");
  const text = modelOutput?.content?.[0]?.text;

  if (!text || typeof text !== "string") {
    throw new Error("Empty Gemini batch response");
  }

  let parsed: any[];
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON from Gemini batch");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini batch response is not an array");
  }

  if (parsed.length !== leads.length) {
    throw new Error(
      `Batch size mismatch: expected ${leads.length} results, got ${parsed.length}`
    );
  }

  const expectedIds = new Set(leads.map((l) => l.leadId));
  const seenIds = new Set<string>();
  const results: BatchIcpResult[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];

    if (!expectedIds.has(item.lead_id)) {
      throw new Error(`Unknown lead_id in batch response: ${item.lead_id}`);
    }

    if (seenIds.has(item.lead_id)) {
      throw new Error(`Duplicate lead_id in batch response: ${item.lead_id}`);
    }

    seenIds.add(item.lead_id);

    if (typeof item.vertical_match !== "boolean") {
      throw new Error(`Invalid vertical_match for lead ${item.lead_id}`);
    }

    if (typeof item.reasoning !== "string") {
      throw new Error(`Invalid reasoning for lead ${item.lead_id}`);
    }

    const matchedVertical = item.matched_vertical;
    const validVerticals: readonly string[] = ICP_VERTICALS;

    if (matchedVertical === null) {
      results.push({
        leadId: item.lead_id,
        vertical_match: false,
        matched_vertical: null,
        reasoning: item.reasoning,
      });
      continue;
    }

    if (typeof matchedVertical !== "string") {
      throw new Error(`Invalid matched_vertical for lead ${item.lead_id}`);
    }

    const isInList = validVerticals.includes(matchedVertical);

    results.push({
      leadId: item.lead_id,
      vertical_match: item.vertical_match === true && isInList,
      matched_vertical: isInList ? matchedVertical : null,
      reasoning: item.reasoning,
    });
  }

  for (const lead of leads) {
    if (!seenIds.has(lead.leadId)) {
      throw new Error(`Missing lead_id in batch response: ${lead.leadId}`);
    }
  }

  return results;
}

function parseSingleResponse(data: any): GeminiIcpResponse {
  if (data.status !== "completed") {
    throw new Error(`Gemini interaction not completed (status: ${data.status ?? "unknown"})`);
  }

  const modelOutput = data?.steps?.find((s: any) => s.type === "model_output");
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
    return { vertical_match: false, matched_vertical: null, reasoning: parsed.reasoning };
  }

  if (typeof matchedVertical !== "string") {
    throw new Error("Invalid Gemini response: matched_vertical must be a string or null");
  }

  const isInList = validVerticals.includes(matchedVertical);

  return {
    vertical_match: parsed.vertical_match === true && isInList,
    matched_vertical: isInList ? matchedVertical : null,
    reasoning: parsed.reasoning,
  };
}
