import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processJobBatch } from "@/lib/processor";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: job } = await supabase
    .from("validation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: settings } = await supabase
    .from("integration_settings")
    .select("gemini_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  const geminiKey = settings?.gemini_api_key;
  if (!geminiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 400 }
    );
  }

  const prompt = job.prompt || "";
  if (!prompt.trim()) {
    return NextResponse.json(
      { error: "Job has no prompt configured" },
      { status: 400 }
    );
  }

  try {
    const result = await processJobBatch(jobId, geminiKey, prompt);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Processing failed" },
      { status: 500 }
    );
  }
}
