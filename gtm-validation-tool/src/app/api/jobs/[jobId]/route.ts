import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
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

  const { data: items } = await supabase
    .from("validation_job_items")
    .select("status")
    .eq("job_id", jobId);

  const completed = items?.filter((i) => i.status === "completed").length ?? 0;
  const failed = items?.filter((i) => i.status === "failed").length ?? 0;
  const pending =
    items?.filter((i) => i.status === "pending" || i.status === "processing")
      .length ?? 0;

  return NextResponse.json({
    ...job,
    progress: { completed, failed, pending, total: job.total_leads },
  });
}
