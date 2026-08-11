import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_project_stats", {
    p_project_id: projectId,
    p_user_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = data as any;
  const total = Number(row?.total ?? 0);
  const emailValid = Number(row?.email_valid ?? 0);
  const emailInvalid = Number(row?.email_invalid ?? 0);
  const icpMatch = Number(row?.icp_match ?? 0);
  const icpNoMatch = Number(row?.icp_no_match ?? 0);
  const safeToSend = Number(row?.safe_to_send ?? 0);

  return NextResponse.json({
    total,
    email: {
      valid: emailValid,
      invalid: emailInvalid,
      unknown: total - emailValid - emailInvalid,
    },
    icp: {
      match: icpMatch,
      noMatch: icpNoMatch,
      unvalidated: total - icpMatch - icpNoMatch,
    },
    safeToSend,
  });
}
