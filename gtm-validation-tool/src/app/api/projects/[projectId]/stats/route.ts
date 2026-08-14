import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: leadStatsRaw, error: leadErr } = await supabase
    .from("leads")
    .select("vertical_match, email_check, safe_to_send")
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (leadErr) {
    return NextResponse.json({ error: leadErr.message }, { status: 500 });
  }

  const leads = (leadStatsRaw ?? []) as any[];
  const total = leads.length;
  const icpValidated = leads.filter((l) => l.vertical_match !== null).length;
  const icpMatch = leads.filter((l) => l.vertical_match === true).length;
  const icpNoMatch = leads.filter((l) => l.vertical_match === false).length;
  const icpNotValidated = total - icpValidated;
  const emailValidated = leads.filter((l) => l.email_check !== null).length;
  const emailValid = leads.filter((l) => l.email_check === "Valid").length;
  const emailInvalid = leads.filter((l) => l.email_check === "Invalid").length;
  const emailUnknown = leads.filter((l) => l.email_check === "Unknown").length;
  const emailNotValidated = total - emailValidated;
  const safeToSend = leads.filter((l) => l.safe_to_send === true).length;

  // Usage aggregation from api_operation_logs for this project's jobs.
  const { data: usageRowsRaw, error: usageErr } = await supabase
    .from("api_operation_logs")
    .select("status, input_tokens, cached_input_tokens, output_tokens, total_tokens, total_cost, duration_ms")
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (usageErr) {
    return NextResponse.json({ error: usageErr.message }, { status: 500 });
  }

  const logs = (usageRowsRaw ?? []) as any[];
  const totalSuccessfulValidations = logs.filter((l) => l.status === "success").length;
  const totalFailedValidations = logs.filter((l) => l.status !== "success").length;
  const totalApiRequests = logs.length;
  const hasUsage = logs.some(
    (l) =>
      l.input_tokens != null ||
      l.cached_input_tokens != null ||
      l.output_tokens != null ||
      l.total_tokens != null ||
      l.total_cost != null
  );

  const sumOrNull = (fn: (l: any) => number | null): number | null => {
    if (!hasUsage) return null;
    return logs.reduce((sum, l) => sum + (fn(l) ?? 0), 0);
  };

  const totalInputTokens = sumOrNull((l) => l.input_tokens);
  const totalCachedTokens = sumOrNull((l) => l.cached_input_tokens);
  const totalOutputTokens = sumOrNull((l) => l.output_tokens);
  const totalTokens = sumOrNull((l) => l.total_tokens);
  const totalCost = sumOrNull((l) => l.total_cost);
  const totalDurationMs = logs.reduce((sum, l) => sum + (l.duration_ms ?? 0), 0);

  const processedLeads = icpValidated + emailValidated;
  const successRate = totalSuccessfulValidations + totalFailedValidations > 0
    ? totalSuccessfulValidations / (totalSuccessfulValidations + totalFailedValidations)
    : 0;
  const averageCostPerLead = totalCost != null && processedLeads > 0
    ? totalCost / processedLeads
    : null;
  const averageDurationMs = totalApiRequests > 0 ? totalDurationMs / totalApiRequests : null;

  return NextResponse.json({
    leads: {
      total,
      icpValidated,
      icpNotValidated,
      icpMatch,
      icpNoMatch,
      emailValidated,
      emailNotValidated,
      emailValid,
      emailInvalid,
      emailUnknown,
      safeToSend,
    },
    usage: {
      totalSuccessfulValidations,
      totalFailedValidations,
      successRate,
      totalApiRequests,
      totalInputTokens,
      totalCachedTokens,
      totalOutputTokens,
      totalTokens,
      totalCost,
      averageCostPerLead,
      averageDurationMs,
    },
  });
}
