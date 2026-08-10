import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callGemini } from "@/lib/validation/gemini";
import { resolvePrompt } from "@/lib/validation/variables";
import { saveValidationPrompt } from "@/lib/validation-prompts";

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

  let body: { leadIds: string[]; prompt?: string };
  try {
    body = await _request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { leadIds, prompt } = body;
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
    .eq("user_id", user.id)
    .in("id", leadIds);

  if (fetchErr || !leads) {
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }

  const verifiedIds = new Set(leads.map((l) => l.id));
  for (const id of leadIds) {
    if (!verifiedIds.has(id)) {
      return NextResponse.json(
        { error: `Lead ${id} does not belong to this project` },
        { status: 403 }
      );
    }
  }

  if (prompt) {
    await saveValidationPrompt(user.id, projectId, "icp", prompt).catch(() => {});
  }

  let processed = 0;
  let matched = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    try {
      const resolved = prompt
        ? resolvePrompt(prompt, lead)
        : resolvePrompt("", lead);

      const result = await callGemini(geminiKey, resolved);

      await supabase
        .from("leads")
        .update({
          vertical_match: result.vertical_match,
          matched_vertical: result.matched_vertical,
          reasoning: result.reasoning,
          ai_response: JSON.stringify(result),
        })
        .eq("id", lead.id);

      processed++;
      if (result.vertical_match) matched++;
    } catch (err: any) {
      errors.push(`${lead.full_name}: ${err.message}`);
    }
  }

  return NextResponse.json({
    processed,
    matched,
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
  });
}
