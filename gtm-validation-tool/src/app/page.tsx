import { Suspense } from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import type { DashboardStats } from "@/types";
import type { Project } from "@/types";

export const dynamic = "force-dynamic";

interface VerticalCount {
  vertical: string;
  count: number;
}

async function getDashboardData(): Promise<{
  stats: DashboardStats;
  projects: (Project & { lead_count: number })[];
  verticalBreakdown: VerticalCount[];
  configured: boolean;
}> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    if (!supabase) {
      return {
        stats: { totalProjects: 0, totalLeads: 0, validatedLeads: 0, icpMatchRate: 0 },
        projects: [],
        verticalBreakdown: [],
        configured: false,
      };
    }

    const [
      { count: totalProjects },
      { count: totalLeads },
      { count: validatedLeads },
      { count: icpMatches },
      { data: recentProjects },
      { data: verticalRows },
    ] = await Promise.all([
      supabase.from("projects").select("*", { count: "exact", head: true }),
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("leads").select("*", { count: "exact", head: true }).not("email_check", "is", null),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("vertical_match", true),
      supabase.from("projects").select("*, leads(count)").order("created_at", { ascending: false }).limit(5),
      supabase.from("leads").select("matched_vertical").eq("vertical_match", true).not("matched_vertical", "is", null),
    ]);

    const verticalCounts: Record<string, number> = {};
    for (const row of (verticalRows ?? [])) {
      const v = row.matched_vertical!;
      verticalCounts[v] = (verticalCounts[v] ?? 0) + 1;
    }

    const verticalBreakdown: VerticalCount[] = [
      "D2C / E-commerce", "Defense / Aviation", "Fintech", "Pharma", "Semiconductor / Data Center",
    ].map((v) => ({ vertical: v, count: verticalCounts[v] ?? 0 }));

    const projects = recentProjects?.map((p) => ({
      ...p,
      lead_count: (p.leads as unknown as { count: number }[])?.[0]?.count ?? 0,
    })) ?? [];

    return {
      stats: {
        totalProjects: totalProjects ?? 0,
        totalLeads: totalLeads ?? 0,
        validatedLeads: validatedLeads ?? 0,
        icpMatchRate: totalLeads && totalLeads > 0 ? Math.round(((icpMatches ?? 0) / totalLeads) * 100) : 0,
      },
      projects,
      verticalBreakdown,
      configured: true,
    };
  } catch {
    return {
      stats: { totalProjects: 0, totalLeads: 0, validatedLeads: 0, icpMatchRate: 0 },
      projects: [],
      verticalBreakdown: [],
      configured: false,
    };
  }
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your lead validation pipeline.
        </p>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const { stats, projects, verticalBreakdown, configured } = await getDashboardData();

  const { DashboardCharts } = await import("@/components/charts/dashboard-charts");
  const { RecentProjects } = await import("@/components/dashboard/recent-projects");

  return (
    <>
      {!configured && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Supabase is not configured</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Go to{" "}
              <a href="/auth/setup" className="underline underline-offset-2 font-medium hover:text-amber-900 dark:hover:text-amber-100">
                Supabase Setup
              </a>{" "}
              and enter your Supabase project credentials.
            </p>
          </div>
        </div>
      )}

      <StatsCards stats={stats} />
      <DashboardCharts
        icpRate={stats.icpMatchRate}
        validatedCount={stats.validatedLeads}
        totalLeads={stats.totalLeads}
        verticalBreakdown={verticalBreakdown}
      />
      <RecentProjects projects={projects} />
    </>
  );
}

function StatsSkeleton() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-8 rounded-md" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ICP Match Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <Skeleton className="size-40 rounded-full" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
