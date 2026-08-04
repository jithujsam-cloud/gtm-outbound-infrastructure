import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentProjects } from "@/components/dashboard/recent-projects";
import { AlertTriangle } from "lucide-react";
import type { DashboardStats } from "@/types";
import type { Project } from "@/types";

export const dynamic = "force-dynamic";

async function getDashboardData(): Promise<{
  stats: DashboardStats;
  projects: (Project & { lead_count: number })[];
  configured: boolean;
}> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    if (!supabase) {
      return {
        stats: { totalProjects: 0, totalLeads: 0, validatedLeads: 0, icpMatchRate: 0 },
        projects: [],
        configured: false,
      };
    }

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
      configured: true,
    };
  } catch {
    return {
      stats: { totalProjects: 0, totalLeads: 0, validatedLeads: 0, icpMatchRate: 0 },
      projects: [],
      configured: false,
    };
  }
}

export default async function DashboardPage() {
  const { stats, projects, configured } = await getDashboardData();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your lead validation pipeline.
        </p>
      </div>

      {!configured && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Supabase is not configured</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel environment variables.
            </p>
          </div>
        </div>
      )}

      <StatsCards stats={stats} />
      <RecentProjects projects={projects} />
    </div>
  );
}
