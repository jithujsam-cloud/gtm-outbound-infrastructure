import { createClient } from "@/lib/supabase/server";

export interface ApiLogEntry {
  user_id: string;
  project_id: string;
  lead_id?: string | null;
  job_id?: string | null;
  job_item_id?: string | null;
  provider: "gemini" | "clearout" | "openai";
  operation: string;
  status: "success" | "failed" | "retryable_error" | "fatal_error";
  attempt?: number;
  duration_ms?: number | null;
  http_status?: number | null;
  error_code?: string | null;
  error_message?: string | null;
  model?: string | null;
  request_id?: string | null;
  leads_in_request?: number | null;
  input_tokens?: number | null;
  cached_input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  input_cost?: number | null;
  cached_input_cost?: number | null;
  output_cost?: number | null;
  total_cost?: number | null;
  request_metadata?: Record<string, unknown> | null;
  response_metadata?: Record<string, unknown> | null;
  raw_response?: unknown;
  raw_error?: unknown;
}

export async function createApiLog(entry: ApiLogEntry): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_operation_logs")
    .insert({
      ...entry,
      attempt: entry.attempt ?? 1,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create API log: ${error.message}`);
  return data.id;
}

export async function updateApiLog(
  logId: string,
  update: {
    status?: "success" | "failed" | "retryable_error" | "fatal_error";
    duration_ms?: number;
    http_status?: number | null;
    error_code?: string | null;
    error_message?: string | null;
    model?: string | null;
    request_id?: string | null;
    leads_in_request?: number | null;
    input_tokens?: number | null;
    cached_input_tokens?: number | null;
    output_tokens?: number | null;
    total_tokens?: number | null;
    input_cost?: number | null;
    cached_input_cost?: number | null;
    output_cost?: number | null;
    total_cost?: number | null;
    response_metadata?: Record<string, unknown> | null;
    raw_response?: unknown;
    raw_error?: unknown;
  }
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("api_operation_logs")
    .update(update)
    .eq("id", logId);

  if (error) throw new Error(`Failed to update API log: ${error.message}`);
}
