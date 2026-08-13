import { createClient } from "@/lib/supabase/server";
import { callGemini, callGeminiBatch, type BatchLeadInput } from "@/lib/validation/gemini";
import { callOpenAI, callOpenAIBatch, OPENAI_DEFAULT_MODEL } from "@/lib/validation/openai";
import { ICP_SYSTEM_PROMPT, formatLeadForIcp, buildIcpUserPrompt } from "@/lib/validation/icp-prompt";
import { createApiLog, updateApiLog } from "@/lib/api-logger";
import { calculateCost, ProviderError, type ProviderUsage } from "@/lib/llm-pricing";
import { classifyError, backoffDelay, shouldPauseJob } from "@/lib/retry";

const BATCH_SIZE = 10;
const GEMINI_BATCH_SIZE = 5;
const OPENAI_BATCH_SIZE = 3;
const MAX_CONCURRENT = 2;
const MAX_CONCURRENT_EMAIL = 3;
const MAX_JOB_SIZE = 200;

export function getMaxJobSize(): number {
  return MAX_JOB_SIZE;
}

// Columns needed from leads for prompt resolution (from VARIABLE_MAP in variables.ts)
const LEAD_FIELDS_FOR_PROMPT = [
  "id", "full_name", "company_name", "email", "industry",
  "position", "state", "domain", "employee_size", "country",
  "company_description", "company_linkedin", "linkedin_url", "website",
];

// Columns needed from validation_jobs for processing decisions
const JOB_FIELDS = [
  "id", "user_id", "project_id", "status", "llm_provider",
  "model", "temperature", "max_tokens", "prompt",
  "failed_leads", "completed_leads", "type",
];

export async function processJobBatch(
  jobId: string,
  llmApiKey: string,
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
    .select(JOB_FIELDS.join(","))
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

    // No items claimable (possibly all in retry backoff or still processing with valid leases)
    return { processed: 0, matched: 0, errors: [], complete: false };
  }

  const leadIds = claimed.map((c: any) => c.lead_id);
  const { data: leads } = await supabase
    .from("leads")
    .select(LEAD_FIELDS_FOR_PROMPT.join(","))
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
        leadBlock: formatLeadForIcp(lead),
      });
    }
  }

  const provider = job.llm_provider ?? "gemini";
  const model = job.model || (provider === "openai" ? OPENAI_DEFAULT_MODEL : "gemini-3.6-flash");
  const isOpenAI = provider === "openai";
  const llmOptions = {
    temperature: job.temperature ?? undefined,
    maxTokens: job.max_tokens ?? undefined,
  };

  const batchGroupSize = isOpenAI ? OPENAI_BATCH_SIZE : GEMINI_BATCH_SIZE;

  let processed = 0;
  let matched = 0;
  const errors: string[] = [];
  let batchFailures = 0;
  const allBatchResults: Array<{
    job_item_id: string;
    lead_id: string;
    vertical_match: boolean;
    matched_vertical: string | null;
    reasoning: string;
    ai_response: string;
  }> = [];

  const batches: BatchLeadInput[][] = [];
  for (let i = 0; i < batchInputs.length; i += batchGroupSize) {
    batches.push(batchInputs.slice(i, i + batchGroupSize));
  }

  const processBatchFn = async (batch: BatchLeadInput[]) => {
    const startedAt = Date.now();

    const logId = await createApiLog({
      user_id: job.user_id,
      project_id: job.project_id,
      lead_id: null,
      job_id: job.id,
      job_item_id: null,
      provider: provider as "gemini" | "openai",
      operation: "icp_validation_batch",
      status: "success",
      request_metadata: {
        model,
        lead_count: batch.length,
        lead_ids: batch.map((b) => b.leadId),
      },
    });

    try {
      let usage: ProviderUsage | null = null;
      let results: Array<{ leadId: string; vertical_match: boolean; matched_vertical: string | null; reasoning: string }>;

      if (batch.length === 1) {
        const singleLeadId = batch[0].leadId;
        if (isOpenAI) {
          const call = await callOpenAI(
            llmApiKey,
            model,
            ICP_SYSTEM_PROMPT,
            buildIcpUserPrompt(prompt, [batch[0].leadBlock]),
            llmOptions
          );
          usage = call.usage;
          results = [{ leadId: singleLeadId, ...call.data }];
        } else {
          const result = await callGemini(
            llmApiKey,
            ICP_SYSTEM_PROMPT,
            buildIcpUserPrompt(prompt, [batch[0].leadBlock]),
            llmOptions
          );
          results = [{ leadId: singleLeadId, ...result }];
        }
      } else if (isOpenAI) {
        const call = await callOpenAIBatch(
          llmApiKey,
          model,
          ICP_SYSTEM_PROMPT,
          prompt,
          batch,
          llmOptions
        );
        usage = call.usage;
        results = call.data;
      } else {
        results = await callGeminiBatch(
          llmApiKey,
          ICP_SYSTEM_PROMPT,
          prompt,
          batch,
          llmOptions
        );
      }

      const resultMap = new Map(results.map((r) => [r.leadId, r]));

      for (const input of batch) {
        const result = resultMap.get(input.leadId);
        if (!result) continue;

        const item = claimed.find((c: any) => c.lead_id === input.leadId);
        if (!item) continue;

        // Collect results for bulk RPC write — no per-lead DB calls
        allBatchResults.push({
          job_item_id: item.id,
          lead_id: input.leadId,
          vertical_match: result.vertical_match,
          matched_vertical: result.matched_vertical,
          reasoning: result.reasoning,
          ai_response: JSON.stringify(result),
        });

        processed++;
        if (result.vertical_match) matched++;
      }

      const cost = usage ? calculateCost(model, usage) : null;

      await updateApiLog(logId, {
        status: "success",
        duration_ms: Date.now() - startedAt,
        model,
        request_id: usage?.requestId ?? null,
        leads_in_request: batch.length,
        input_tokens: usage?.inputTokens ?? null,
        cached_input_tokens: usage?.cachedInputTokens ?? null,
        output_tokens: usage?.outputTokens ?? null,
        total_tokens: usage?.totalTokens ?? null,
        input_cost: cost?.inputCost ?? null,
        cached_input_cost: cost?.cachedInputCost ?? null,
        output_cost: cost?.outputCost ?? null,
        total_cost: cost?.totalCost ?? null,
        response_metadata: { processed: batch.length },
        raw_response: usage?.rawResponse ?? null,
      });
    } catch (err: any) {
      const errorClass = classifyError(err.message);

      await updateApiLog(logId, {
        status: errorClass === "system" ? "fatal_error" :
                errorClass === "retryable" ? "retryable_error" : "failed",
        duration_ms: Date.now() - startedAt,
        model,
        error_message: err.message?.slice(0, 500),
        raw_error: err instanceof ProviderError ? err.rawError : null,
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
          // Non-blocking retry: set next_attempt_at for database-level backoff scheduling
          const delayMs = backoffDelay(item.attempt);
          await supabase
            .from("validation_job_items")
            .update({
              status: "pending",
              lease_expires_at: null,
              next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
              error_message: err.message?.slice(0, 500),
            })
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

  // Atomic bulk write: single RPC call verifies lease ownership and writes all results
  if (allBatchResults.length > 0) {
    await supabase.rpc("apply_icp_results", { p_updates: allBatchResults });
  }

  const { data: remaining } = await supabase
    .from("validation_job_items")
    .select("id", { count: "exact" })
    .eq("job_id", jobId)
    .in("status", ["pending", "processing"]);

  if ((remaining?.length ?? 0) > 0) {
    // Intermediate progress: recalculate counts without finalizing
    await recalculateJobProgress(supabase, jobId);
  } else {
    // All items done: finalize includes progress counts
    await finalizeJob(supabase, jobId);
  }

  if (shouldPauseJob(job.failed_leads + batchFailures, job.completed_leads + processed)) {
    await supabase
      .from("validation_jobs")
      .update({ status: "paused", error_message: "Auto-paused: failure rate exceeded 50%" })
      .eq("id", jobId);
    return { processed, matched, errors: errors.slice(0, 5), complete: false, paused: true, pausedReason: "Auto-paused: failure rate exceeded 50%" };
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

const EMAIL_FIELDS = ["id", "email"];

export async function processEmailBatch(
  jobId: string,
  clearoutApiKey: string
): Promise<{
  processed: number;
  valid: number;
  invalid: number;
  errors: string[];
  complete: boolean;
  paused?: boolean;
  pausedReason?: string;
}> {
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("validation_jobs")
    .select(JOB_FIELDS.join(","))
    .eq("id", jobId)
    .single();

  if (!job) throw new Error("Job not found");

  if (job.status === "completed" || job.status === "cancelled") {
    return { processed: 0, valid: 0, invalid: 0, errors: [], complete: true };
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
      return { processed: 0, valid: 0, invalid: 0, errors: [], complete: true };
    }
    return { processed: 0, valid: 0, invalid: 0, errors: [], complete: false };
  }

  const leadIds = claimed.map((c: any) => c.lead_id);
  const { data: leads } = await supabase
    .from("leads")
    .select(EMAIL_FIELDS.join(","))
    .in("id", leadIds);

  if (!leads || leads.length === 0) {
    return { processed: 0, valid: 0, invalid: 0, errors: ["No leads found"], complete: false };
  }

  const leadMap = new Map(leads.map((l: any) => [l.id, l]));

  let processed = 0;
  let valid = 0;
  let invalid = 0;
  const errors: string[] = [];
  let batchFailures = 0;

  // Process emails with controlled concurrency
  const emailItems = claimed.map((item: any) => {
    const lead = leadMap.get(item.lead_id);
    return { item, lead };
  }).filter((x: any) => x.lead);

  // Process in chunks of MAX_CONCURRENT_EMAIL
  for (let i = 0; i < emailItems.length; i += MAX_CONCURRENT_EMAIL) {
    const chunk = emailItems.slice(i, i + MAX_CONCURRENT_EMAIL);

    const chunkResults = await Promise.allSettled(
      chunk.map(async ({ item, lead }: any) => {
        const startedAt = Date.now();
        const logId = await createApiLog({
          user_id: job.user_id,
          project_id: job.project_id,
          lead_id: lead.id,
          job_id: job.id,
          job_item_id: item.id,
          provider: "clearout",
          operation: "email_verification",
          status: "success",
          request_metadata: { email_provided: true },
        });

        try {
          const result = await callClearout(clearoutApiKey, lead.email);
          const check = parseClearout(result);

          await updateApiLog(logId, {
            status: "success",
            duration_ms: Date.now() - startedAt,
            response_metadata: { status: check.status, safe_to_send: check.safe_to_send },
          });

          return {
            job_item_id: item.id,
            lead_id: lead.id,
            email_check: check.status === "valid" ? "Valid" : check.status === "invalid" ? "Invalid" : "Unknown",
            safe_to_send: check.safe_to_send,
            status: check.status,
            smtp_provider: check.smtp_provider,
            mx_record: check.mx_record,
            email_score: check.score,
            account: check.account,
            clearout_domain: check.domain,
          };
        } catch (err: any) {
          const errorClass = classifyError(err.message);
          await updateApiLog(logId, {
            status: errorClass === "retryable" ? "retryable_error" : "fatal_error",
            duration_ms: Date.now() - startedAt,
            error_message: err.message?.slice(0, 500),
          });

          if (errorClass === "system") {
            throw err;
          }

          if (errorClass === "retryable" && item.attempt < item.max_attempts) {
            const delayMs = backoffDelay(item.attempt);
            await supabase.from("validation_job_items")
              .update({
                status: "pending",
                lease_expires_at: null,
                next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
                error_message: err.message?.slice(0, 500),
              })
              .eq("id", item.id);
          } else {
            await supabase.from("validation_job_items")
              .update({ status: "failed", error_message: err.message?.slice(0, 500), completed_at: new Date().toISOString() })
              .eq("id", item.id);
            batchFailures++;
          }

          return null;
        }
      })
    );

    // Collect successful results for bulk write
    const successResults: Array<{
      job_item_id: string;
      lead_id: string;
      email_check: string;
      safe_to_send: boolean;
      status: string;
      smtp_provider: string | null;
      mx_record: string | null;
      email_score: number | null;
      account: string | null;
      clearout_domain: string | null;
    }> = [];

    for (const r of chunkResults) {
      if (r.status === "rejected") {
        // System error propagated
        await supabase
          .from("validation_jobs")
          .update({ status: "paused", error_message: `System error: ${r.reason?.message?.slice(0, 300)}` })
          .eq("id", jobId);
        return { processed, valid, invalid, errors, complete: false, paused: true, pausedReason: r.reason?.message?.slice(0, 200) };
      }
      if (r.value) {
        successResults.push(r.value);
        processed++;
        const check = r.value;
        if (check.email_check === "Valid") valid++;
        else if (check.email_check === "Invalid") invalid++;
      }
    }

    // Atomic bulk write for this chunk
    if (successResults.length > 0) {
      await supabase.rpc("apply_email_results", { p_updates: successResults });
    }
  }

  const { data: remaining } = await supabase
    .from("validation_job_items")
    .select("id", { count: "exact" })
    .eq("job_id", jobId)
    .in("status", ["pending", "processing"]);

  if ((remaining?.length ?? 0) > 0) {
    await recalculateJobProgress(supabase, jobId);
  } else {
    await finalizeJob(supabase, jobId);
  }

  if (shouldPauseJob(job.failed_leads + batchFailures, job.completed_leads + processed)) {
    await supabase
      .from("validation_jobs")
      .update({ status: "paused", error_message: "Auto-paused: failure rate exceeded 50%" })
      .eq("id", jobId);
    return { processed, valid, invalid, errors: errors.slice(0, 5), complete: false, paused: true, pausedReason: "Auto-paused: failure rate exceeded 50%" };
  }

  return { processed, valid, invalid, errors: errors.slice(0, 5), complete: (remaining?.length ?? 0) === 0 };
}

async function callClearout(apiKey: string, email: string) {
  const res = await fetch("https://api.clearout.io/v2/email_verify/instant", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
  const completed = items.filter((i: any) => i.status === "completed").length;
  const failed = items.filter((i: any) => i.status === "failed").length;
  await supabase
    .from("validation_jobs")
    .update({ status, completed_at: new Date().toISOString(), completed_leads: completed, failed_leads: failed })
    .eq("id", jobId);
}
