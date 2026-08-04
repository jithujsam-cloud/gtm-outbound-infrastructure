import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { COOKIE_MAP } from "./config";

async function resolveConfig(): Promise<{ url: string; key: string } | null> {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    return { url: envUrl, key: envKey };
  }

  try {
    const cookieStore = await cookies();
    const cookieUrl = cookieStore.get(COOKIE_MAP.supabase_url)?.value;
    const cookieKey = cookieStore.get(COOKIE_MAP.supabase_anon_key)?.value;

    if (cookieUrl && cookieKey) {
      return { url: cookieUrl, key: cookieKey };
    }
  } catch {
    // cookies() may throw during static generation
  }

  return null;
}

export async function createClient(): Promise<SupabaseClient<Database> | null> {
  const config = await resolveConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
