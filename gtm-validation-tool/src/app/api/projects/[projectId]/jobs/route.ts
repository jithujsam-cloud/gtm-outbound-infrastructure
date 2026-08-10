import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createValidationJob } from "@/lib/jobs";
import { getMaxJobSize } from "@/lib/processor";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    type: "icp" | "email";
    mode: "selected" | "continuous";
    leadIds?: string[];
    prompt?: string;
    model?: string;
  };

  try {
    body = await _request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.type || !body.mode) {
    return NextResponse.json(
      { error: "type and mode are required" },
      { status: 400 }
    );
  }

  let leadIds: string[];

  if (body.mode === "continuous") {
    if (body.type === "icp") {
      const { data } = await supabase
        .from("leads")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .is("vertical_match", null);

      leadIds = data?.map((l) => l.id) ?? [];
    } else {
      const { data } = await supabase
        .from("leads")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .is("email_check", null);

      leadIds = data?.map((l) => l.id) ?? [];
    }

    if (leadIds.length === 0) {
      return NextResponse.json(
        { error: "No unvalidated leads found" },
        { status: 400 }
      );
    }
  } else {
    if (!Array.isArray(body.leadIds) || body.leadIds.length === 0) {
      return NextResponse.json(
        { error: "leadIds required for selected mode" },
        { status: 400 }
      );
    }
    leadIds = body.leadIds;
  }

  const maxSize = getMaxJobSize();
  if (leadIds.length > maxSize) {
    return NextResponse.json(
      { error: `Cannot process more than ${maxSize} leads per job. Selected: ${leadIds.length}` },
      { status: 400 }
    );
  }

  try {
    const result = await createValidationJob({
      userId: user.id,
      projectId,
      type: body.type,
      mode: body.mode,
      leadIds,
      prompt: body.prompt,
      model: body.model,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
