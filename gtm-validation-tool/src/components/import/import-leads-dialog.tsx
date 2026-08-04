"use client";

import { useState, useRef } from "react";
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

type Step = "upload" | "mapping" | "progress";

export function ImportLeadsDialog({
  open,
  onOpenChange,
  projectId,
  onImported,
}: ImportLeadsDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const cancelledRef = useRef(false);

  function handleParsed(data: ParsedCsv) {
    setParsed(data);
    setStep("mapping");
  }

  function handleReset() {
    setStep("upload");
    setParsed(null);
    setProgress({ current: 0, total: 0 });
  }

  async function handleImport(mapping: ColumnMapping) {
    if (!parsed) return;

    setImporting(true);
    cancelledRef.current = false;
    setStep("progress");

    const CHUNK_SIZE = 100;
    const allRows = parsed.rows.map((row) => {
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

    const total = allRows.length;
    setProgress({ current: 0, total });
    let imported = 0;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      if (cancelledRef.current) break;
      const chunk = allRows.slice(i, i + CHUNK_SIZE);
      try {
        const res = await fetch(`/api/projects/${projectId}/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chunk),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Import failed");
        imported += chunk.length;
        setProgress({ current: imported, total });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Chunk ${Math.floor(i / CHUNK_SIZE) + 1} failed`);
        break;
      }
    }

    if (imported > 0) {
      toast.success(`Imported ${imported} of ${total} lead${total !== 1 ? "s" : ""}`);
    }

    setImporting(false);
    onOpenChange(false);
    onImported();
    handleReset();
  }

  function handleCancel() {
    cancelledRef.current = true;
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

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
        {step === "progress" && (
          <div className="py-8 space-y-6 text-center">
            <div className="size-12 mx-auto rounded-full border-4 border-muted border-t-primary animate-spin" />
            <div>
              <p className="text-sm font-medium">
                Importing {progress.current.toLocaleString()} of {progress.total.toLocaleString()} leads
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {pct}% complete
              </p>
            </div>
            <div className="max-w-xs mx-auto bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <button
              onClick={handleCancel}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
