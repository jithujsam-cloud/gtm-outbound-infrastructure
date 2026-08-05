import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getCredentials(request: NextRequest) {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    request.cookies.get("gtm_supabase_url")?.value;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    request.cookies.get("gtm_supabase_anon_key")?.value;

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth pages are always accessible
  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  const credentials = getCredentials(request);

  // No Supabase configured — send to setup
  if (!credentials) {
    return NextResponse.redirect(new URL("/auth/setup", request.url));
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(credentials.url, credentials.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  } catch {
    // Supabase unavailable
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
