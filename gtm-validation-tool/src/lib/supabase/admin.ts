import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { cookies } from "next/headers";

async function resolveConfig(): Promise<{ url: string; key: string } | null> {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (envUrl && envKey) {
    return { url: envUrl, key: envKey };
  }

  try {
    const cookieStore = await cookies();
    const cookieUrl = cookieStore.get("gtm_supabase_url")?.value;
    const cookieKey = cookieStore.get("gtm_supabase_service_role_key")?.value;

    if (cookieUrl && cookieKey) {
      return { url: cookieUrl, key: cookieKey };
    }
  } catch {
    // cookies() may throw during static generation
  }

  return null;
}

export async function createAdminClient(): Promise<SupabaseClient<Database> | null> {
  const config = await resolveConfig();
  if (!config) return null;

  return createSupabaseClient<Database>(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
