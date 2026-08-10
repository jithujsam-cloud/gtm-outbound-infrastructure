import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    .select("clearout_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  const clearoutKey = settings?.clearout_api_key;
  if (!clearoutKey) {
    return NextResponse.json({ error: "Clearout API key not configured" }, { status: 400 });
  }

  const { data: leads, error: fetchErr } = await supabase
    .from("leads")
    .select("id, email, full_name")
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

  let processed = 0;
  let valid = 0;
  let invalid = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    let logId: string | null = null;
    const startedAt = Date.now();

    try {
      const result = await callClearout(clearoutKey, lead.email);
      const check = parseClearout(result);

      logId = await createApiLog({
        user_id: user.id,
        project_id: projectId,
        lead_id: lead.id,
        provider: "clearout",
        operation: "email_verification",
        status: "success",
        request_metadata: { email_provided: true },
      });

      const { error: updateErr } = await supabase
        .from("leads")
        .update({
          email_check: check.status === "valid" ? "Valid" : check.status === "invalid" ? "Invalid" : "Unknown",
          safe_to_send: check.safe_to_send,
          status: check.status,
          smtp_provider: check.smtp_provider,
          mx_record: check.mx_record,
          email_score: check.score,
          account: check.account,
          clearout_domain: check.domain,
        })
        .eq("id", lead.id);

      if (updateErr) {
        await updateApiLog(logId, {
          status: "failed",
          duration_ms: Date.now() - startedAt,
          error_message: "database update failed",
        });
        errors.push(`${lead.email}: database update failed`);
        continue;
      }

      await updateApiLog(logId, {
        status: "success",
        duration_ms: Date.now() - startedAt,
        response_metadata: { status: check.status, safe_to_send: check.safe_to_send },
      });

      processed++;
      if (check.status === "valid") valid++;
      else if (check.status === "invalid") invalid++;
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
      errors.push(`${lead.email}: ${err.message}`);
    }
  }

  return NextResponse.json({ processed, valid, invalid, errors: errors.length > 0 ? errors.slice(0, 5) : undefined });
}

async function callClearout(apiKey: string, email: string) {
  const res = await fetch("https://api.clearout.io/v2/email_verify/instant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Clearout API error (${res.status}): ${err.slice(0, 200)}`);
  }

  return res.json();
}

interface ClearoutParsed {
  status: string;
  safe_to_send: boolean;
  smtp_provider: string | null;
  mx_record: string | null;
  score: number | null;
  account: string | null;
  domain: string | null;
}

function parseClearout(data: any): ClearoutParsed {
  return {
    status: data?.data?.status || data?.status || "unknown",
    safe_to_send: data?.data?.safe_to_send ?? false,
    smtp_provider: data?.data?.smtp_provider || null,
    mx_record: data?.data?.mx_record || null,
    score: data?.data?.score ?? data?.score ?? null,
    account: data?.data?.account || null,
    domain: data?.data?.domain || null,
  };
}
