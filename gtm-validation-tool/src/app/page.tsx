import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentProjects } from "@/components/dashboard/recent-projects";
import type { DashboardStats } from "@/types";
import type { Project } from "@/types";

export const dynamic = "force-dynamic";

async function getDashboardData(): Promise<{
  stats: DashboardStats;
  projects: (Project & { lead_count: number })[];
}> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const [
      { count: totalProjects },
      { count: totalLeads },
      { count: validatedLeads },
      { count: icpMatches },
      { data: recentProjects },
    ] = await Promise.all([
      supabase.from("projects").select("*", { count: "exact", head: true }),
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .not("email_check", "is", null),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("vertical_match", true),
      supabase
        .from("projects")
        .select("*, leads(count)")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const projects =
      recentProjects?.map((p) => ({
        ...p,
        lead_count: (p.leads as unknown as { count: number }[])?.[0]?.count ?? 0,
      })) ?? [];

    return {
      stats: {
        totalProjects: totalProjects ?? 0,
        totalLeads: totalLeads ?? 0,
        validatedLeads: validatedLeads ?? 0,
        icpMatchRate:
          totalLeads && totalLeads > 0
            ? Math.round(((icpMatches ?? 0) / totalLeads) * 100)
            : 0,
      },
      projects,
    };
  } catch {
    return {
      stats: {
        totalProjects: 0,
        totalLeads: 0,
        validatedLeads: 0,
        icpMatchRate: 0,
      },
      projects: [],
    };
  }
}

export default async function DashboardPage() {
  const { stats, projects } = await getDashboardData();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your lead validation pipeline.
        </p>
      </div>
      <StatsCards stats={stats} />
      <RecentProjects projects={projects} />
    </div>
  );
}
