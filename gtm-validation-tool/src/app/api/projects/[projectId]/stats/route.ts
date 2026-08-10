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

  const { data: allLeads, error } = await supabase
    .from("leads")
    .select("email_check, vertical_match, safe_to_send")
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = allLeads?.length ?? 0;

  const emailValid = allLeads?.filter((l) => l.email_check === "Valid").length ?? 0;
  const emailInvalid = allLeads?.filter((l) => l.email_check === "Invalid").length ?? 0;
  const emailUnknown = total - emailValid - emailInvalid;

  const icpMatch = allLeads?.filter((l) => l.vertical_match === true).length ?? 0;
  const icpNoMatch = allLeads?.filter((l) => l.vertical_match === false).length ?? 0;
  const icpUnvalidated = total - icpMatch - icpNoMatch;

  const safeToSend = allLeads?.filter(
    (l) => l.safe_to_send === true && l.vertical_match === true
  ).length ?? 0;

  return NextResponse.json({
    total,
    email: { valid: emailValid, invalid: emailInvalid, unknown: emailUnknown },
    icp: { match: icpMatch, noMatch: icpNoMatch, unvalidated: icpUnvalidated },
    safeToSend,
  });
}
