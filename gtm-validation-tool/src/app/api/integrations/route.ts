import { NextRequest, NextResponse } from "next/server";

const COOKIE_PREFIX = "gtm_supabase_";
const COOKIE_KEYS = ["url", "anon_key", "service_role_key"] as const;

export async function POST(request: NextRequest) {
  const body = await request.json();

  const cookieOptions = {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };

  const response = NextResponse.json({ success: true });

  if (body.url) {
    response.cookies.set(`${COOKIE_PREFIX}url`, body.url, cookieOptions);
  }
  if (body.anonKey) {
    response.cookies.set(`${COOKIE_PREFIX}anon_key`, body.anonKey, cookieOptions);
  }
  if (body.serviceRoleKey) {
    response.cookies.set(`${COOKIE_PREFIX}service_role_key`, body.serviceRoleKey, {
      ...cookieOptions,
      maxAge: body.serviceRoleKey ? 60 * 60 * 24 * 30 : 0,
    });
  }

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  const expireOptions = { path: "/", maxAge: 0 };

  for (const key of COOKIE_KEYS) {
    response.cookies.set(`${COOKIE_PREFIX}${key}`, "", expireOptions);
  }

  return response;
}
