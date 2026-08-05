import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/auth", "/integrations", "/api/integrations"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

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

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const credentials = getCredentials(request);
  if (!credentials) {
    return NextResponse.redirect(new URL("/integrations", request.url));
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
    // Supabase unavailable — let the request through
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
