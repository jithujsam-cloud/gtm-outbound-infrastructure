import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadsTable } from "@/components/spreadsheet/leads-table";
import type { Lead } from "@/types";

export const dynamic = "force-dynamic";

async function getProjectWithLeads(projectId: string) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    if (!supabase) return { configured: false as const };

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (!project) return null;

    const { data: leads, count } = await supabase
      .from("leads")
      .select("*", { count: "exact" })
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);

    return { configured: true as const, project, leads: (leads ?? []) as Lead[], total: count ?? 0 };
  } catch {
    return null;
  }
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const result = await getProjectWithLeads(projectId);

  if (!result) notFound();

  if (!result.configured) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project</h1>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Supabase is not configured</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Go to{" "}
              <a
                href="/integrations"
                className="underline underline-offset-2 font-medium hover:text-amber-900 dark:hover:text-amber-100"
              >
                Integrations
              </a>{" "}
              and paste your Supabase project URL, anon key, and service role key.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { project, leads, total } = result;

  return (
    <div className="max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadsTable
            projectId={projectId}
            initialData={leads}
            initialTotal={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
