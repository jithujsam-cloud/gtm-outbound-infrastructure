import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError("Unauthorized");
  return user;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function authErrorResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
