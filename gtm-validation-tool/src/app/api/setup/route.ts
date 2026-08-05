import { NextRequest, NextResponse } from "next/server";

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: false,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = NextResponse.json({ success: true });

  if (body.supabaseUrl) {
    response.cookies.set("gtm_supabase_url", body.supabaseUrl, COOKIE_OPTIONS);
  }

  if (body.supabaseAnonKey) {
    response.cookies.set("gtm_supabase_anon_key", body.supabaseAnonKey, COOKIE_OPTIONS);
  }

  if (body.supabaseServiceRoleKey) {
    response.cookies.set(
      "gtm_supabase_service_role_key",
      body.supabaseServiceRoleKey,
      COOKIE_OPTIONS
    );
  }

  return response;
}
