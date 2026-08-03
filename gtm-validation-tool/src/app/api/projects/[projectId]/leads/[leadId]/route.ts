import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; leadId: string }> }
) {
  const { projectId, leadId } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("project_id", projectId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; leadId: string }> }
) {
  const { projectId, leadId } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("leads")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; leadId: string }> }
) {
  const { projectId, leadId } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", leadId)
    .eq("project_id", projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
