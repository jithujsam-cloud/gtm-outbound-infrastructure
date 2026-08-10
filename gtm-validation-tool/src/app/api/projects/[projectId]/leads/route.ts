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

  const url = new URL(_request.url);
  const idsonly = url.searchParams.get("idsonly") === "true";
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = parseInt(url.searchParams.get("limit") ?? "10");
  const search = url.searchParams.get("search")?.trim();
  const emailCheck = url.searchParams.get("email_check")?.trim();
  const verticalMatch = url.searchParams.get("vertical_match")?.trim();
  const industry = url.searchParams.get("industry")?.trim();
  const offset = (page - 1) * limit;

  let query = supabase
    .from("leads")
    .select(idsonly ? "id" : "*", { count: "exact" })
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (search) {
    const ilike = `%${search}%`;
    query = query.or(
      `full_name.ilike.${ilike},company_name.ilike.${ilike},email.ilike.${ilike},position.ilike.${ilike},industry.ilike.${ilike},matched_vertical.ilike.${ilike}`
    );
  }

  if (emailCheck) {
    if (emailCheck === "null") query = query.is("email_check", null);
    else query = query.eq("email_check", emailCheck);
  }

  if (verticalMatch) {
    if (verticalMatch === "null") query = query.is("vertical_match", null);
    else query = query.eq("vertical_match", verticalMatch === "true");
  }

  if (industry) {
    query = query.ilike("industry", `%${industry}%`);
  }

  if (idsonly) {
    const { data: idRows, error: idErr } = await query;
    if (idErr) return NextResponse.json({ error: idErr.message }, { status: 500 });
    return NextResponse.json({ ids: idRows?.map((r: any) => r.id) ?? [] });
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data,
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify project exists and belongs to user
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();

  const leads = Array.isArray(body) ? body : [body];

  const leadsWithProject = leads.map((lead) => ({
    ...lead,
    project_id: projectId,
    user_id: user.id,
  }));

  const { data, error } = await supabase
    .from("leads")
    .insert(leadsWithProject)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
