import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadsTable } from "@/components/spreadsheet/leads-table";
import type { Lead } from "@/types";

async function getProjectWithLeads(projectId: string) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

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

    return { project, leads: (leads ?? []) as Lead[], total: count ?? 0 };
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
