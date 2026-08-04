import { NextRequest, NextResponse } from "next/server";
import { COOKIE_MAP } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: false,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
};

const KEYS_TO_SAVE = [
  { bodyKey: "supabaseUrl", cookieKey: COOKIE_MAP.supabase_url },
  { bodyKey: "supabaseAnonKey", cookieKey: COOKIE_MAP.supabase_anon_key },
  { bodyKey: "supabaseServiceRoleKey", cookieKey: COOKIE_MAP.supabase_service_role_key },
  { bodyKey: "geminiApiKey", cookieKey: COOKIE_MAP.gemini_api_key },
  { bodyKey: "clearoutApiKey", cookieKey: COOKIE_MAP.clearout_api_key },
] as const;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = NextResponse.json({ success: true });

  for (const { bodyKey, cookieKey } of KEYS_TO_SAVE) {
    const value = body[bodyKey];
    if (value) {
      response.cookies.set(cookieKey, value, COOKIE_OPTIONS);
    }
  }

  try {
    const supabase = await createAdminClient();
    if (supabase && body.geminiApiKey) {
      await supabase
        .from("integration_settings")
        .upsert({ provider: "gemini", api_key: body.geminiApiKey }, { onConflict: "provider" });
    }
    if (supabase && body.clearoutApiKey) {
      await supabase
        .from("integration_settings")
        .upsert({ provider: "clearout", api_key: body.clearoutApiKey }, { onConflict: "provider" });
    }
  } catch {
    // DB write is best-effort — cookies already stored
  }

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  const expireOptions = { path: "/", maxAge: 0 };

  for (const { cookieKey } of KEYS_TO_SAVE) {
    response.cookies.set(cookieKey, "", expireOptions);
  }

  return response;
}
