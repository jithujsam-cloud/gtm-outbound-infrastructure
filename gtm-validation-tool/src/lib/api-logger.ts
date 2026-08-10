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
  request_metadata?: Record<string, unknown> | null;
  response_metadata?: Record<string, unknown> | null;
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
    response_metadata?: Record<string, unknown> | null;
  }
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("api_operation_logs")
    .update(update)
    .eq("id", logId);

  if (error) throw new Error(`Failed to update API log: ${error.message}`);
}
