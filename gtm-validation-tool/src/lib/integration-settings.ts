import { createClient } from "@/lib/supabase/server";
import type { IntegrationSettings } from "@/types";

export async function getIntegrationSettings(): Promise<IntegrationSettings | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("integration_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return data;
}

export async function upsertIntegrationSettings(
  settings: {
    clearout_api_key?: string;
    gemini_api_key?: string;
    supabase_url?: string;
    supabase_anon_key?: string;
    supabase_service_role_key?: string;
  }
): Promise<IntegrationSettings> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("integration_settings")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from("integration_settings")
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("integration_settings")
    .insert({ ...settings, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}
