"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCost, formatDuration, formatTokens } from "@/lib/format";
import { Mail, Target, Shield, Activity, Database, Zap } from "lucide-react";

interface ProjectStatsData {
  leads: {
    total: number;
    icpValidated: number;
    icpNotValidated: number;
    icpMatch: number;
    icpNoMatch: number;
    emailValidated: number;
    emailNotValidated: number;
    emailValid: number;
    emailInvalid: number;
    emailUnknown: number;
    safeToSend: number;
  };
  usage: {
    totalSuccessfulValidations: number;
    totalFailedValidations: number;
    successRate: number;
    totalApiRequests: number;
    totalInputTokens: number | null;
    totalCachedTokens: number | null;
    totalOutputTokens: number | null;
    totalTokens: number | null;
    totalCost: number | null;
    averageCostPerLead: number | null;
    averageDurationMs: number | null;
  };
}

export function ProjectStats({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const [stats, setStats] = useState<ProjectStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch(`/api/projects/${projectId}/stats`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then((d) => { if (!cancelled) setStats(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [projectId, refreshKey]);

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-3">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
    );
  }

  const { leads, usage } = stats;
  const successRatePct = Math.round(usage.successRate * 100);

  const groups = [
    {
      title: "Leads",
      icon: Database,
      items: [
        ["Total leads", String(leads.total)],
        ["ICP validated", String(leads.icpValidated)],
        ["ICP not validated", String(leads.icpNotValidated)],
        ["Email validated", String(leads.emailValidated)],
        ["Email not validated", String(leads.emailNotValidated)],
      ],
    },
    {
      title: "ICP",
      icon: Target,
      items: [
        ["ICP match", String(leads.icpMatch)],
        ["ICP no match", String(leads.icpNoMatch)],
        ["Safe to send", String(leads.safeToSend)],
      ],
    },
    {
      title: "Email",
      icon: Mail,
      items: [
        ["Email valid", String(leads.emailValid)],
        ["Email invalid", String(leads.emailInvalid)],
        ["Email unknown", String(leads.emailUnknown)],
      ],
    },
    {
      title: "Validation",
      icon: Activity,
      items: [
        ["Successful", String(usage.totalSuccessfulValidations)],
        ["Failed", String(usage.totalFailedValidations)],
        ["Success rate", `${successRatePct}%`],
      ],
    },
    {
      title: "Usage",
      icon: Zap,
      items: [
        ["API requests", String(usage.totalApiRequests)],
        ["Input tokens", formatTokens(usage.totalInputTokens)],
        ["Cached tokens", formatTokens(usage.totalCachedTokens)],
        ["Output tokens", formatTokens(usage.totalOutputTokens)],
        ["Total tokens", formatTokens(usage.totalTokens)],
      ],
    },
    {
      title: "Cost",
      icon: Shield,
      items: [
        ["Total cost", formatCost(usage.totalCost)],
        ["Cost per lead", formatCost(usage.averageCostPerLead)],
        ["Avg duration", formatDuration(usage.averageDurationMs)],
      ],
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <div key={group.title} className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <group.icon className="size-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.title}</h3>
          </div>
          <div className="space-y-1">
            {group.items.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
