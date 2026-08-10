"use client";

import { useEffect, useState } from "react";
import { Mail, Target, Shield } from "lucide-react";

interface ValidationSummaryProps {
  projectId: string;
  refreshKey: number;
}

interface Stats {
  total: number;
  email: { valid: number; invalid: number; unknown: number };
  icp: { match: number; noMatch: number; unvalidated: number };
  safeToSend: number;
}

function MiniDonut({ slices, center }: { slices: { value: number; color: string }[], center: string }) {
  const total = slices.reduce((s, c) => s + c.value, 0);
  const size = 56;
  const radius = size / 2 - 5;
  const strokeWidth = 5;
  const innerRadius = radius - strokeWidth;
  const circumference = 2 * Math.PI * innerRadius;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={innerRadius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground" style={{ fontSize: 9, fontWeight: 600 }}>{center}</text>
      </svg>
    );
  }

  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {slices.map((slice, i) => {
          const dashArray = (slice.value / total) * circumference || 0;
          const dashOffset = -offset;
          offset += dashArray;
          return dashArray > 0 ? (
            <circle
              key={i}
              cx={size / 2} cy={size / 2} r={innerRadius}
              fill="none" stroke={slice.color} strokeWidth={strokeWidth}
              strokeDasharray={`${dashArray} ${circumference - dashArray}`}
              strokeDashoffset={dashOffset} strokeLinecap="round"
            />
          ) : null;
        })}
      </g>
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" className="fill-foreground" style={{ fontSize: 10, fontWeight: 700 }}>{center}</text>
    </svg>
  );
}

export function ValidationSummary({ projectId, refreshKey }: ValidationSummaryProps) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/stats`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setStats(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, refreshKey]);

  if (!stats) {
    return (
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 py-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-12 sm:size-14 rounded-full bg-muted animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3 w-12 bg-muted rounded animate-pulse" />
              <div className="h-3 w-8 bg-muted rounded animate-pulse" />
              <div className="h-3 w-10 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const GREEN = "#10b981";
  const RED = "#ef4444";
  const GRAY = "#d1d5db";

  const emailSlices = [
    { value: stats.email.valid, color: GREEN },
    { value: stats.email.invalid, color: RED },
    { value: stats.email.unknown, color: GRAY },
  ];

  const icpSlices = [
    { value: stats.icp.match, color: GREEN },
    { value: stats.icp.noMatch, color: RED },
    { value: stats.icp.unvalidated, color: GRAY },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-6 py-1.5">
      <div className="flex items-center gap-3">
        <MiniDonut slices={emailSlices} center={String(stats.total)} />
        <div className="text-xs leading-relaxed">
          <div className="flex items-center gap-1.5 font-medium text-muted-foreground mb-0.5">
            <Mail className="size-3" /> Email
          </div>
          <div className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />Valid <span className="font-medium tabular-nums">{stats.email.valid}</span></div>
          <div className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-red-500 shrink-0" />Invalid <span className="font-medium tabular-nums">{stats.email.invalid}</span></div>
          <div className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-gray-300 shrink-0" />Unknown <span className="font-medium tabular-nums">{stats.email.unknown}</span></div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <MiniDonut slices={icpSlices} center={String(stats.total)} />
        <div className="text-xs leading-relaxed">
          <div className="flex items-center gap-1.5 font-medium text-muted-foreground mb-0.5">
            <Target className="size-3" /> ICP
          </div>
          <div className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />Fits <span className="font-medium tabular-nums">{stats.icp.match}</span></div>
          <div className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-red-500 shrink-0" />Doesn&apos;t <span className="font-medium tabular-nums">{stats.icp.noMatch}</span></div>
          <div className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-gray-300 shrink-0" />N/A <span className="font-medium tabular-nums">{stats.icp.unvalidated}</span></div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:ml-4 sm:pl-4 sm:border-l border-border">
        <div className="flex items-center justify-center size-12 sm:size-14 rounded-full bg-emerald-50 border-2 border-emerald-200">
          <Shield className="size-4 sm:size-5 text-emerald-600" />
        </div>
        <div className="text-xs leading-relaxed">
          <div className="font-medium text-muted-foreground mb-0.5">Safe to Send</div>
          <div className="text-base sm:text-lg font-bold tabular-nums text-emerald-600">{stats.safeToSend}</div>
          <div className="text-[10px] text-muted-foreground">
            {stats.total > 0 ? `${Math.round((stats.safeToSend / stats.total) * 100)}% of total` : "0% of total"}
          </div>
        </div>
      </div>
    </div>
  );
}
