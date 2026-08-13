import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: job } = await supabase
    .from("validation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: items } = await supabase
    .from("validation_job_items")
    .select("status")
    .eq("job_id", jobId);

  const completed = items?.filter((i) => i.status === "completed").length ?? 0;
  const failed = items?.filter((i) => i.status === "failed").length ?? 0;
  const pending =
    items?.filter((i) => i.status === "pending" || i.status === "processing")
      .length ?? 0;

  let runStats = null;
  const { data: statsRow } = await supabase.rpc("get_validation_run_stats", {
    p_job_id: jobId,
  } as any);
  const row = statsRow as any;
  if (Array.isArray(row) && row[0]) {
    const s = row[0];
    const toNullableNumber = (v: unknown): number | null =>
      v === null || v === undefined ? null : Number(v);

    runStats = {
      leadsRequested: Number(s.leads_requested ?? 0),
      leadsProcessed: Number(s.leads_processed ?? 0),
      successful: Number(s.successful ?? 0),
      failed: Number(s.failed ?? 0),
      matched: Number(s.matched ?? 0),
      noMatch: Number(s.no_match ?? 0),
      apiRequests: Number(s.api_requests ?? 0),
      inputTokens: toNullableNumber(s.input_tokens),
      cachedInputTokens: toNullableNumber(s.cached_input_tokens),
      outputTokens: toNullableNumber(s.output_tokens),
      totalTokens: toNullableNumber(s.total_tokens),
      totalCost: toNullableNumber(s.total_cost),
      totalDurationMs: Number(s.total_duration_ms ?? 0),
    };
  }

  return NextResponse.json({
    ...job,
    progress: { completed, failed, pending, total: job.total_leads },
    runStats,
  });
}
