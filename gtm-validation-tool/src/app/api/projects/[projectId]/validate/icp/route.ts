import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { leadIds: string[] };
  try {
    body = await _request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { leadIds } = body;
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds required" }, { status: 400 });
  }

  const { data: settings } = await supabase
    .from("integration_settings")
    .select("gemini_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  const geminiKey = settings?.gemini_api_key;
  if (!geminiKey) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 400 });
  }

  const { data: leads, error: fetchErr } = await supabase
    .from("leads")
    .select("*")
    .eq("project_id", projectId)
    .in("id", leadIds);

  if (fetchErr || !leads) {
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }

  let processed = 0;
  let matched = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    try {
      const prompt = buildIcpPrompt(lead);
      const result = await callGemini(geminiKey, prompt);

      const parsed = parseIcpResponse(result);
      if (parsed.error) {
        errors.push(`${lead.full_name}: ${parsed.error}`);
        continue;
      }

      await supabase
        .from("leads")
        .update({
          vertical_match: parsed.vertical_match,
          matched_vertical: parsed.matched_vertical,
          reasoning: parsed.reasoning,
          ai_summary: parsed.ai_summary,
        })
        .eq("id", lead.id);

      processed++;
      if (parsed.vertical_match) matched++;
    } catch (err: any) {
      errors.push(`${lead.full_name}: ${err.message}`);
    }
  }

  return NextResponse.json({ processed, matched, errors: errors.length > 0 ? errors.slice(0, 5) : undefined });
}

const ICP_VERTICALS = [
  "D2C / E-commerce",
  "Defense / Aviation",
  "Fintech",
  "Pharma",
  "Semiconductor / Data Center",
];

function buildIcpPrompt(lead: any): string {
  return `You are a B2B lead validation engine for a recruitment firm.
Given a lead record, determine if the company belongs to any of these ICP verticals:
${ICP_VERTICALS.map((v) => `- ${v}`).join("\n")}

Use broad matching — include adjacent and enabling companies.

Company: ${lead.company_name}
Industry: ${lead.industry}
Description: ${lead.company_description}
Domain: ${lead.domain}
Position: ${lead.position}

Return ONLY valid JSON, no markdown:
{
  "vertical_match": true/false,
  "matched_vertical": "vertical name or null",
  "reasoning": "2-3 sentence ICP reasoning",
  "ai_summary": "1 sentence summary of the company"
}`;
}

function parseIcpResponse(text: string): {
  vertical_match: boolean;
  matched_vertical: string | null;
  reasoning: string | null;
  ai_summary: string | null;
  error?: string;
} {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    const json = JSON.parse(cleaned);
    const matched = json.matched_vertical;
    const verticalExists = typeof matched === "string" && matched !== "null" && matched !== "None";
    return {
      vertical_match: json.vertical_match === true && verticalExists,
      matched_vertical: verticalExists ? matched : null,
      reasoning: json.reasoning || null,
      ai_summary: json.ai_summary || null,
    };
  } catch {
    return {
      vertical_match: false,
      matched_vertical: null,
      reasoning: null,
      ai_summary: null,
      error: "Invalid JSON from Gemini",
    };
  }
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  return text;
}
