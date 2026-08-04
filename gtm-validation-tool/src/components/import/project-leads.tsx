"use client";

import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/components/spreadsheet/leads-table";
import { ImportLeadsDialog } from "./import-leads-dialog";
import type { Lead } from "@/types";

interface ProjectLeadsProps {
  projectId: string;
  initialLeads: Lead[];
  initialTotal: number;
}

export function ProjectLeads({ projectId, initialLeads, initialTotal }: ProjectLeadsProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleImported = useCallback(() => {
    setImportOpen(false);
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {initialTotal} lead{initialTotal !== 1 ? "s" : ""} total
          </p>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Import CSV
          </Button>
        </div>
        <LeadsTable
          projectId={projectId}
          initialData={initialLeads}
          initialTotal={initialTotal}
          refreshKey={refreshKey}
        />
      </div>

      <ImportLeadsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
        onImported={handleImported}
      />
    </>
  );
}
