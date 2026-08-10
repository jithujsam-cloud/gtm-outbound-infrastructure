"use server";

import { revalidatePath } from "next/cache";
import { upsertIntegrationSettings, getIntegrationStatus } from "@/lib/integration-settings";
import { getValidationPrompt, saveValidationPrompt, getDefaultIcpPrompt } from "@/lib/validation-prompts";
import { createClient } from "@/lib/supabase/server";

export async function saveSettings(formData: FormData) {
  const settings = {
    clearout_api_key: (formData.get("clearout_api_key") as string) || undefined,
    llm_api_key: (formData.get("llm_api_key") as string) || undefined,
    llm_provider: (formData.get("llm_provider") as string) || undefined,
  };

  try {
    await upsertIntegrationSettings(settings);
    revalidatePath("/integrations");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save settings" };
  }
}

export async function loadSettings() {
  try {
    const status = await getIntegrationStatus();
    return { settings: status, error: null };
  } catch (e) {
    return { settings: null, error: e instanceof Error ? e.message : "Failed to load settings" };
  }
}

export async function getIcpPrompt(projectId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { prompt: null, error: "Not authenticated" };

    const saved = await getValidationPrompt(user.id, projectId, "icp");
    return { prompt: saved ?? getDefaultIcpPrompt(), error: null };
  } catch (e) {
    return { prompt: getDefaultIcpPrompt(), error: null };
  }
}

export async function saveIcpPrompt(projectId: string, prompt: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    await saveValidationPrompt(user.id, projectId, "icp", prompt);
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to save prompt" };
  }
}
