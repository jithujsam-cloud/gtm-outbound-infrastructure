import { createClient } from "@/lib/supabase/server";
import { callGemini, callGeminiBatch, type BatchLeadInput } from "@/lib/validation/gemini";
import { resolvePrompt } from "@/lib/validation/variables";
import { createApiLog, updateApiLog } from "@/lib/api-logger";
import { classifyError, backoffDelay, shouldPauseJob } from "@/lib/retry";

const BATCH_SIZE = 10;
const GEMINI_BATCH_SIZE = 5;
const MAX_CONCURRENT = 2;
const MAX_JOB_SIZE = 200;

export function getMaxJobSize(): number {
  return MAX_JOB_SIZE;
}

export async function processJobBatch(
  jobId: string,
  geminiKey: string,
  prompt: string
): Promise<{
  processed: number;
  matched: number;
  errors: string[];
  complete: boolean;
  paused?: boolean;
  pausedReason?: string;
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

    if ((remaining?.length ?? 0) === 0) {
      await finalizeJob(supabase, jobId);
      return { processed: 0, matched: 0, errors: [], complete: true };
    }

    await supabase
      .from("validation_job_items")
      .update({ status: "pending", lease_expires_at: null })
      .eq("job_id", jobId)
      .eq("status", "processing")
      .lt("lease_expires_at", new Date().toISOString());

    return { processed: 0, matched: 0, errors: [], complete: false };
  }

  const leadIds = claimed.map((c: any) => c.lead_id);
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .in("id", leadIds);

  if (!leads || leads.length === 0) {
    return { processed: 0, matched: 0, errors: ["No leads found"], complete: false };
  }

  const leadMap = new Map(leads.map((l: any) => [l.id, l]));

  const batchInputs: BatchLeadInput[] = [];
  for (const item of claimed) {
    const lead = leadMap.get(item.lead_id);
    if (lead) {
      batchInputs.push({
        leadId: item.lead_id,
        resolvedPrompt: resolvePrompt(prompt, lead),
      });
    }
  }

  let processed = 0;
  let matched = 0;
  const errors: string[] = [];
  let batchFailures = 0;

  const batches: BatchLeadInput[][] = [];
  for (let i = 0; i < batchInputs.length; i += GEMINI_BATCH_SIZE) {
    batches.push(batchInputs.slice(i, i + GEMINI_BATCH_SIZE));
  }

  const processBatchFn = async (batch: BatchLeadInput[]) => {
    const startedAt = Date.now();

    const logId = await createApiLog({
      user_id: job.user_id,
      project_id: job.project_id,
      lead_id: null,
      job_id: job.id,
      job_item_id: null,
      provider: "gemini",
      operation: "icp_validation_batch",
      status: "success",
      request_metadata: {
        model: "gemini-3.6-flash",
        lead_count: batch.length,
        lead_ids: batch.map((b) => b.leadId),
      },
    });

    try {
      const results = batch.length === 1
        ? [{
            leadId: batch[0].leadId,
            ...(await callGemini(geminiKey, batch[0].resolvedPrompt)),
          }]
        : await callGeminiBatch(geminiKey, batch);

      const resultMap = new Map(results.map((r) => [r.leadId, r]));

      for (const input of batch) {
        const result = resultMap.get(input.leadId);
        if (!result) continue;

        const { error: updateErr } = await supabase
          .from("leads")
          .update({
            vertical_match: result.vertical_match,
            matched_vertical: result.matched_vertical,
            reasoning: result.reasoning,
            ai_response: JSON.stringify(result),
          })
          .eq("id", input.leadId);

        const item = claimed.find((c: any) => c.lead_id === input.leadId);
        if (item) {
          if (updateErr) {
            await supabase
              .from("validation_job_items")
              .update({ status: "failed", error_message: "database update failed", completed_at: new Date().toISOString() })
              .eq("id", item.id);
          } else {
            await supabase
              .from("validation_job_items")
              .update({ status: "completed", completed_at: new Date().toISOString() })
              .eq("id", item.id);
            processed++;
            if (result.vertical_match) matched++;
          }
        }
      }

      await updateApiLog(logId, {
        status: "success",
        duration_ms: Date.now() - startedAt,
        response_metadata: { processed: batch.length },
      });
    } catch (err: any) {
      const errorClass = classifyError(err.message);

      await updateApiLog(logId, {
        status: errorClass === "system" ? "fatal_error" :
                errorClass === "retryable" ? "retryable_error" : "failed",
        duration_ms: Date.now() - startedAt,
        error_message: err.message?.slice(0, 500),
      });

      if (errorClass === "system") {
        await supabase
          .from("validation_jobs")
          .update({ status: "paused", error_message: `System error: ${err.message?.slice(0, 300)}` })
          .eq("id", jobId);
        throw err;
      }

      for (const input of batch) {
        const item = claimed.find((c: any) => c.lead_id === input.leadId);
        if (!item) continue;

        if (errorClass === "retryable" && item.attempt < item.max_attempts) {
          const delayMs = backoffDelay(item.attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));

          await supabase
            .from("validation_job_items")
            .update({ status: "pending", error_message: err.message?.slice(0, 500), lease_expires_at: null })
            .eq("id", item.id);
        } else {
          await supabase
            .from("validation_job_items")
            .update({ status: "failed", error_message: err.message?.slice(0, 500), completed_at: new Date().toISOString() })
            .eq("id", item.id);
          batchFailures++;
        }
      }

      errors.push(`Batch failed: ${err.message?.slice(0, 200)}`);
    }
  };

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
    const concurrent = batches.slice(i, i + MAX_CONCURRENT);
    try {
      await Promise.all(concurrent.map((b) => processBatchFn(b)));
    } catch (err: any) {
      return { processed, matched, errors, complete: false, paused: true, pausedReason: err.message?.slice(0, 200) };
    }
  }

  await recalculateJobProgress(supabase, jobId);

  if (shouldPauseJob(job.failed_leads + batchFailures, job.completed_leads + processed)) {
    await supabase
      .from("validation_jobs")
      .update({ status: "paused", error_message: "Auto-paused: failure rate exceeded 50%" })
      .eq("id", jobId);
    return { processed, matched, errors: errors.slice(0, 5), complete: false, paused: true, pausedReason: "Auto-paused: failure rate exceeded 50%" };
  }

  const { data: remaining } = await supabase
    .from("validation_job_items")
    .select("id", { count: "exact" })
    .eq("job_id", jobId)
    .in("status", ["pending", "processing"]);

  if ((remaining?.length ?? 0) === 0) {
    await finalizeJob(supabase, jobId);
  }

  return { processed, matched, errors: errors.slice(0, 5), complete: (remaining?.length ?? 0) === 0 };
}

async function claimBatch(supabase: any, jobId: string, limit: number): Promise<any[]> {
  const { data, error } = await supabase.rpc("claim_job_items", {
    p_job_id: jobId,
    p_batch_size: limit,
    p_lease_seconds: 60,
  });
  if (error) throw new Error(`Failed to claim items: ${error.message}`);
  return data ?? [];
}

async function recalculateJobProgress(supabase: any, jobId: string) {
  const { data: items } = await supabase.from("validation_job_items").select("status").eq("job_id", jobId);
  if (!items) return;
  const completed = items.filter((i: any) => i.status === "completed").length;
  const failed = items.filter((i: any) => i.status === "failed").length;
  await supabase.from("validation_jobs").update({ completed_leads: completed, failed_leads: failed }).eq("id", jobId);
}

async function finalizeJob(supabase: any, jobId: string) {
  const { data: items } = await supabase.from("validation_job_items").select("status").eq("job_id", jobId);
  if (!items) return;
  const hasFailures = items.some((i: any) => i.status === "failed");
  const status = hasFailures ? "completed_with_errors" : "completed";
  await supabase
    .from("validation_jobs")
    .update({ status, completed_at: new Date().toISOString(), completed_leads: items.filter((i: any) => i.status === "completed").length, failed_leads: items.filter((i: any) => i.status === "failed").length })
    .eq("id", jobId);
}
