import { createClient } from "@/lib/supabase/server";

export async function createValidationJob(params: {
  userId: string;
  projectId: string;
  type: "icp" | "email";
  mode: "selected" | "continuous";
  leadIds: string[];
  prompt?: string;
  model?: string;
  llmProvider?: string;
}): Promise<{ jobId: string; totalLeads: number; skippedLeads: number }> {
  const { userId, projectId, type, mode, leadIds, prompt, model, llmProvider } = params;
  const supabase = await createClient();

  const { data: leads, error: fetchErr } = await supabase
    .from("leads")
    .select("id, vertical_match, email_check")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .in("id", leadIds);

  if (fetchErr || !leads) {
    throw new Error("Failed to fetch leads for job creation");
  }

  const isAlreadyValidated = (lead: typeof leads[0]): boolean => {
    if (type === "icp") return lead.vertical_match !== null;
    return lead.email_check !== null;
  };

  const pendingLeads = leads.filter((l) => !isAlreadyValidated(l));
  const skippedLeads = leads.filter((l) => isAlreadyValidated(l));

  if (pendingLeads.length === 0) {
    throw new Error("All selected leads are already validated");
  }

  // Clean up any stale active jobs for this user+project+type before creating a new one
  const { data: staleJobs } = await supabase
    .from("validation_jobs")
    .select("id, status")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("type", type)
    .in("status", ["queued", "running", "paused"]);

  if (staleJobs && staleJobs.length > 0) {
    await supabase
      .from("validation_jobs")
      .update({
        status: "failed",
        error_message: "Superseded by new validation job",
        completed_at: new Date().toISOString(),
      })
      .in("id", staleJobs.map((j) => j.id));
  }

  const { data: job, error: jobErr } = await supabase
    .from("validation_jobs")
    .insert({
      user_id: userId,
      project_id: projectId,
      type,
      mode,
      prompt: prompt ?? null,
      model: model ?? null,
      llm_provider: llmProvider ?? null,
      total_leads: pendingLeads.length,
      skipped_leads: skippedLeads.length,
      status: "queued",
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    throw new Error(`Failed to create job: ${jobErr?.message ?? "unknown"}`);
  }

  const items = pendingLeads.map((lead) => ({
    job_id: job.id,
    lead_id: lead.id,
  }));

  const { error: itemsErr } = await supabase
    .from("validation_job_items")
    .insert(items);

  if (itemsErr) {
    await supabase
      .from("validation_jobs")
      .update({ status: "failed", error_message: itemsErr.message })
      .eq("id", job.id);
    throw new Error(`Failed to create job items: ${itemsErr.message}`);
  }

  return {
    jobId: job.id,
    totalLeads: pendingLeads.length,
    skippedLeads: skippedLeads.length,
  };
}
