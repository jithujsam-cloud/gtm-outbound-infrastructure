import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const notConfigured = NextResponse.json(
  { error: "Supabase is not configured" },
  { status: 503 }
);

export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) return notConfigured;

  const { data, error } = await supabase
    .from("projects")
    .select("*, leads(count)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const projects = data?.map((p) => ({
    ...p,
    lead_count: (p.leads as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) return notConfigured;

  const body = await request.json();

  const { data, error } = await supabase
    .from("projects")
    .insert({ name: body.name, description: body.description })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
