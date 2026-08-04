import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getLocalConfig } from "./config";

let memoizedClient: SupabaseClient<Database> | null = null;

function resolveConfig(): { url: string; key: string } | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    return { url: envUrl, key: envKey };
  }

  const localConfig = getLocalConfig();
  if (localConfig?.url && localConfig?.anonKey) {
    return { url: localConfig.url, key: localConfig.anonKey };
  }

  return null;
}

export function createClient(): SupabaseClient<Database> | null {
  const config = resolveConfig();
  if (!config) return null;

  if (!memoizedClient) {
    memoizedClient = createBrowserClient<Database>(config.url, config.key);
  }

  return memoizedClient;
}
