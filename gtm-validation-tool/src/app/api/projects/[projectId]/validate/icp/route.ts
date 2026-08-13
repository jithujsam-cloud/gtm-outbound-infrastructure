import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callGemini } from "@/lib/validation/gemini";
import { callOpenAI } from "@/lib/validation/openai";
import { ICP_SYSTEM_PROMPT, formatLeadForIcp, buildIcpUserPrompt } from "@/lib/validation/icp-prompt";
import { saveValidationPrompt } from "@/lib/validation-prompts";
import { createApiLog, updateApiLog } from "@/lib/api-logger";

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

  if (!prompt || prompt.trim().length === 0) {
    return NextResponse.json(
      { error: "ICP validation prompt cannot be empty." },
      { status: 400 }
    );
  }

  const { data: settings } = await supabase
    .from("integration_settings")
    .select("llm_api_key, llm_provider")
    .eq("user_id", user.id)
    .maybeSingle();

  const llmApiKey = settings?.llm_api_key;
  if (!llmApiKey) {
    return NextResponse.json(
      { error: "LLM API key not configured" },
      { status: 400 }
    );
  }

  const provider = settings?.llm_provider ?? "gemini";

  const { data: leads, error: fetchErr } = await supabase
    .from("leads")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .in("id", leadIds);

  if (fetchErr || !leads) {
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
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

  const alreadyValidated = leads.filter((l) => l.vertical_match !== null);
  const pendingLeads = leads.filter((l) => l.vertical_match === null);
  const skipped = alreadyValidated.length;

  try {
    await saveValidationPrompt(user.id, projectId, "icp", prompt);
  } catch (e: any) {
    return NextResponse.json(
      { error: `Failed to save prompt: ${e.message}` },
      { status: 500 }
    );
  }

  let processed = 0;
  let matched = 0;
  const errors: string[] = [];

  for (const lead of pendingLeads) {
    let logId: string | null = null;
    const startedAt = Date.now();

    try {
      const userPrompt = buildIcpUserPrompt(prompt, [formatLeadForIcp(lead)]);

      logId = await createApiLog({
        user_id: user.id,
        project_id: projectId,
        lead_id: lead.id,
        provider: provider as "gemini" | "openai",
        operation: "icp_validation",
        status: "success",
        request_metadata: { model: provider === "openai" ? "gpt-5.6-luna" : "gemini-3.6-flash", lead_count: 1 },
      });

      let result: {
        vertical_match: boolean;
        matched_vertical: string | null;
        reasoning: string;
      };

      if (provider === "openai") {
        const call = await callOpenAI(llmApiKey, "gpt-5.6-luna", ICP_SYSTEM_PROMPT, userPrompt);
        result = call.data;
      } else {
        result = await callGemini(llmApiKey, ICP_SYSTEM_PROMPT, userPrompt);
      }

      const { error: updateErr } = await supabase
        .from("leads")
        .update({
          vertical_match: result.vertical_match,
          matched_vertical: result.matched_vertical,
          reasoning: result.reasoning,
          ai_response: JSON.stringify(result),
        })
        .eq("id", lead.id);

      if (updateErr) {
        await updateApiLog(logId, {
          status: "failed",
          duration_ms: Date.now() - startedAt,
          error_message: "database update failed",
        });
        errors.push(`${lead.full_name}: database update failed`);
        continue;
      }

      await updateApiLog(logId, {
        status: "success",
        duration_ms: Date.now() - startedAt,
        response_metadata: {
          vertical_match: result.vertical_match,
          matched_vertical: result.matched_vertical,
        },
      });

      processed++;
      if (result.vertical_match) matched++;
    } catch (err: any) {
      if (logId) {
        const isRetryable =
          err.message?.includes("429") ||
          err.message?.includes("500") ||
          err.message?.includes("502") ||
          err.message?.includes("503") ||
          err.message?.includes("timeout") ||
          err.message?.includes("ECONNREFUSED");

        await updateApiLog(logId, {
          status: isRetryable ? "retryable_error" : "fatal_error",
          duration_ms: Date.now() - startedAt,
          error_message: err.message?.slice(0, 500),
        });
      }
      errors.push(`${lead.full_name}: ${err.message}`);
    }
  }

  return NextResponse.json({
    processed,
    matched,
    skipped,
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
  });
}
