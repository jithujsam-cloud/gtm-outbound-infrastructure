import { createClient } from "@/lib/supabase/server";
import { callGemini } from "@/lib/validation/gemini";
import { resolvePrompt } from "@/lib/validation/variables";
import { createApiLog, updateApiLog } from "@/lib/api-logger";

const BATCH_SIZE = 10;

export async function processJobBatch(
  jobId: string,
  geminiKey: string,
  prompt: string
): Promise<{
  processed: number;
  matched: number;
  errors: string[];
  complete: boolean;
}> {
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("validation_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (!job) throw new Error("Job not found");

  if (job.status === "completed" || job.status === "cancelled") {
    return { processed: 0, matched: 0, errors: [], complete: true };
  }

  if (job.status === "queued" || job.status === "paused") {
    await supabase
      .from("validation_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);
  }

  const claimed = await claimBatch(supabase, jobId, BATCH_SIZE);

  if (claimed.length === 0) {
    const { data: remaining } = await supabase
      .from("validation_job_items")
      .select("id", { count: "exact" })
      .eq("job_id", jobId)
      .in("status", ["pending", "processing"]);

    const pendingCount = remaining?.length ?? 0;

    if (pendingCount === 0) {
      await finalizeJob(supabase, jobId);
      return { processed: 0, matched: 0, errors: [], complete: true };
    }

    return { processed: 0, matched: 0, errors: [], complete: false };
  }

  let processed = 0;
  let matched = 0;
  const errors: string[] = [];

  for (const item of claimed) {
    try {
      const result = await processLeadItem(
        supabase,
        item,
        job,
        geminiKey,
        prompt
      );

      await supabase
        .from("validation_job_items")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      processed++;
      if (result.vertical_match) matched++;
    } catch (err: any) {
      const isRetryable =
        err.message?.includes("429") ||
        err.message?.includes("500") ||
        err.message?.includes("502") ||
        err.message?.includes("503") ||
        err.message?.includes("timeout") ||
        err.message?.includes("ECONNREFUSED");

      if (isRetryable && item.attempt < item.max_attempts) {
        await supabase
          .from("validation_job_items")
          .update({
            status: "pending",
            error_message: err.message?.slice(0, 500),
          })
          .eq("id", item.id);
      } else {
        await supabase
          .from("validation_job_items")
          .update({
            status: "failed",
            error_message: err.message?.slice(0, 500),
            completed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      }

      errors.push(`Lead ${item.lead_id}: ${err.message?.slice(0, 200)}`);
    }
  }

  await recalculateJobProgress(supabase, jobId);

  const { data: remaining } = await supabase
    .from("validation_job_items")
    .select("id", { count: "exact" })
    .eq("job_id", jobId)
    .in("status", ["pending", "processing"]);

  const complete = (remaining?.length ?? 0) === 0;

  if (complete) {
    await finalizeJob(supabase, jobId);
  }

  return {
    processed,
    matched,
    errors: errors.slice(0, 5),
    complete,
  };
}

async function claimBatch(
  supabase: any,
  jobId: string,
  limit: number
): Promise<any[]> {
  const { data, error } = await supabase.rpc("claim_job_items", {
    p_job_id: jobId,
    p_batch_size: limit,
    p_lease_seconds: 60,
  });

  if (error) throw new Error(`Failed to claim items: ${error.message}`);
  return data ?? [];
}

async function processLeadItem(
  supabase: any,
  item: any,
  job: any,
  geminiKey: string,
  prompt: string
): Promise<{ vertical_match: boolean; matched_vertical: string | null }> {
  const startedAt = Date.now();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", item.lead_id)
    .single();

  if (!lead) throw new Error("Lead not found");

  const resolved = resolvePrompt(prompt, lead);

  const logId = await createApiLog({
    user_id: job.user_id,
    project_id: job.project_id,
    lead_id: lead.id,
    job_id: job.id,
    job_item_id: item.id,
    provider: "gemini",
    operation: "icp_validation",
    status: "success",
    attempt: item.attempt,
    request_metadata: { model: "gemini-3.6-flash" },
  });

  const result = await callGemini(geminiKey, resolved);

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
    throw new Error("database update failed");
  }

  await updateApiLog(logId, {
    status: "success",
    duration_ms: Date.now() - startedAt,
    response_metadata: {
      vertical_match: result.vertical_match,
      matched_vertical: result.matched_vertical,
    },
  });

  return result;
}

async function recalculateJobProgress(supabase: any, jobId: string) {
  const { data: items } = await supabase
    .from("validation_job_items")
    .select("status")
    .eq("job_id", jobId);

  if (!items) return;

  const completed = items.filter((i: any) => i.status === "completed").length;
  const failed = items.filter((i: any) => i.status === "failed").length;

  await supabase
    .from("validation_jobs")
    .update({ completed_leads: completed, failed_leads: failed })
    .eq("id", jobId);
}

async function finalizeJob(supabase: any, jobId: string) {
  const { data: items } = await supabase
    .from("validation_job_items")
    .select("status")
    .eq("job_id", jobId);

  if (!items) return;

  const hasFailures = items.some((i: any) => i.status === "failed");
  const status = hasFailures ? "completed_with_errors" : "completed";

  await supabase
    .from("validation_jobs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      completed_leads: items.filter((i: any) => i.status === "completed").length,
      failed_leads: items.filter((i: any) => i.status === "failed").length,
    })
    .eq("id", jobId);
}
