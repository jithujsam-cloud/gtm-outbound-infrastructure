import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(_request.url);
  const projectId = url.searchParams.get("project_id")?.trim();

  let query = supabase
    .from("validation_jobs")
    .select("*, projects(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data: jobs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = await Promise.all(
    (jobs ?? []).map(async (job: any) => {
      const { data: statsRow } = await supabase.rpc(
        "get_validation_run_stats",
        { p_job_id: job.id } as any
      );
      const row = (statsRow as any)?.[0];
      return {
        ...job,
        projectName: job.projects?.name ?? null,
        runStats: row
          ? {
              leadsRequested: Number(row.leads_requested ?? 0),
              leadsProcessed: Number(row.leads_processed ?? 0),
              successful: Number(row.successful ?? 0),
              failed: Number(row.failed ?? 0),
              matched: Number(row.matched ?? 0),
              noMatch: Number(row.no_match ?? 0),
              apiRequests: Number(row.api_requests ?? 0),
              inputTokens: row.input_tokens == null ? null : Number(row.input_tokens),
              cachedInputTokens: row.cached_input_tokens == null ? null : Number(row.cached_input_tokens),
              outputTokens: row.output_tokens == null ? null : Number(row.output_tokens),
              totalTokens: row.total_tokens == null ? null : Number(row.total_tokens),
              totalCost: row.total_cost == null ? null : Number(row.total_cost),
              totalDurationMs: Number(row.total_duration_ms ?? 0),
            }
          : null,
      };
    })
  );

  return NextResponse.json(enriched);
}
