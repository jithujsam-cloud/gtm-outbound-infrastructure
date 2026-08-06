"use server";

import { revalidatePath } from "next/cache";
import { upsertIntegrationSettings, getIntegrationSettings } from "@/lib/integration-settings";

export async function saveSettings(formData: FormData) {
  const settings = {
    clearout_api_key: (formData.get("clearout_api_key") as string) || undefined,
    gemini_api_key: (formData.get("gemini_api_key") as string) || undefined,
    supabase_url: (formData.get("supabase_url") as string) || undefined,
    supabase_anon_key: (formData.get("supabase_anon_key") as string) || undefined,
    supabase_service_role_key: (formData.get("supabase_service_role_key") as string) || undefined,
  };

  try {
    await upsertIntegrationSettings(settings);
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save settings" };
  }
}

export async function loadSettings() {
  try {
    const settings = await getIntegrationSettings();
    return { settings, error: null };
  } catch (e) {
    return { settings: null, error: e instanceof Error ? e.message : "Failed to load settings" };
  }
}
