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
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "models/gemini-3.6-flash",
        store: false,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              vertical_match: { type: "BOOLEAN" },
              matched_vertical: {
                type: "STRING",
                nullable: true,
              },
              reasoning: { type: "STRING" },
            },
            required: ["vertical_match", "matched_vertical", "reasoning"],
          },
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Empty Gemini response");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON from Gemini");
  }

  const matchedVertical = parsed.matched_vertical;
  const validVerticals: readonly string[] = ICP_VERTICALS;

  const verticalExists =
    typeof matchedVertical === "string" &&
    matchedVertical !== "null" &&
    matchedVertical !== "None" &&
    matchedVertical.length > 0;

  const verticalInList = verticalExists
    ? validVerticals.includes(matchedVertical)
    : false;

  return {
    vertical_match:
      parsed.vertical_match === true && verticalExists && verticalInList,
    matched_vertical: verticalInList ? matchedVertical : null,
    reasoning: parsed.reasoning || "",
  };
}
