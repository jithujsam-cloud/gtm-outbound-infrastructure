"use client";

import { useState, useCallback } from "react";
import { ProjectLeads } from "@/components/import/project-leads";
import { ValidationSummary } from "@/components/charts/validation-summary";
import type { Lead } from "@/types";

interface ProjectLeadsClientProps {
  projectId: string;
  initialLeads: Lead[];
  initialTotal: number;
}

export function ProjectLeadsClient({ projectId, initialLeads, initialTotal }: ProjectLeadsClientProps) {
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  const handleValidationComplete = useCallback(() => {
    setStatsRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-3">
      <ValidationSummary projectId={projectId} refreshKey={statsRefreshKey} />
      <ProjectLeads
        projectId={projectId}
        initialLeads={initialLeads}
        initialTotal={initialTotal}
        onValidationComplete={handleValidationComplete}
      />
    </div>
  );
}
