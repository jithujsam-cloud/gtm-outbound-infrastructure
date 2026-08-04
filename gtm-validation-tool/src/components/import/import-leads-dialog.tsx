"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CsvUploadStep, type ParsedCsv } from "./csv-upload-step";
import { ColumnMappingStep, type ColumnMapping } from "./column-mapping-step";

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onImported: () => void;
}

type Step = "upload" | "mapping";

export function ImportLeadsDialog({
  open,
  onOpenChange,
  projectId,
  onImported,
}: ImportLeadsDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [importing, setImporting] = useState(false);

  function handleParsed(data: ParsedCsv) {
    setParsed(data);
    setStep("mapping");
  }

  function handleReset() {
    setStep("upload");
    setParsed(null);
  }

  async function handleImport(mapping: ColumnMapping) {
    if (!parsed) return;

    setImporting(true);
    try {
      const leads = parsed.rows.map((row) => {
        const lead: Record<string, string | number> = {};
        for (const [csvHeader, leadField] of Object.entries(mapping)) {
          const colIndex = parsed.headers.indexOf(csvHeader);
          const value = row[colIndex] ?? "";

          if (leadField === "employee_size") {
            const num = parseInt(value, 10);
            lead[leadField] = isNaN(num) ? 0 : num;
          } else {
            lead[leadField] = value;
          }
        }

        for (const f of [
          "full_name", "company_name", "position", "email", "industry",
          "state", "domain", "country", "company_description",
          "company_linkedin", "linkedin_url", "website",
        ]) {
          if (!(f in lead)) lead[f] = "";
        }

        return lead;
      });

      const res = await fetch(`/api/projects/${projectId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leads),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to import leads");
      }

      toast.success(`Imported ${leads.length} lead${leads.length !== 1 ? "s" : ""}`);
      onOpenChange(false);
      onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      handleReset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-5" />
            Import Leads
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && <CsvUploadStep onParsed={handleParsed} />}
        {step === "mapping" && parsed && (
          <ColumnMappingStep
            parsed={parsed}
            onBack={handleReset}
            onSubmit={handleImport}
            importing={importing}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
