"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { ParsedCsv } from "./csv-upload-step";

const LEAD_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: "full_name", label: "Full Name", required: true },
  { key: "company_name", label: "Company Name", required: true },
  { key: "position", label: "Position", required: true },
  { key: "email", label: "Email", required: true },
  { key: "industry", label: "Industry", required: true },
  { key: "state", label: "State", required: true },
  { key: "domain", label: "Domain", required: true },
  { key: "employee_size", label: "Employee Size", required: false },
  { key: "country", label: "Country", required: true },
  { key: "company_description", label: "Company Description", required: true },
  { key: "company_linkedin", label: "Company LinkedIn", required: true },
  { key: "linkedin_url", label: "LinkedIn URL", required: true },
  { key: "website", label: "Website", required: true },
];

export interface ColumnMapping {
  [csvHeader: string]: string;
}

interface ColumnMappingStepProps {
  parsed: ParsedCsv;
  onBack: () => void;
  onSubmit: (mapping: ColumnMapping) => void;
  importing: boolean;
}

export function ColumnMappingStep({
  parsed,
  onBack,
  onSubmit,
  importing,
}: ColumnMappingStepProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(() => {
    const initial: ColumnMapping = {};
    for (const header of parsed.headers) {
      const lower = header.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const match = LEAD_FIELDS.find(
        (f) =>
          f.key === lower ||
          f.label.toLowerCase() === header.toLowerCase() ||
          f.key.replace(/_/g, " ") === header.toLowerCase()
      );
      initial[header] = match ? match.key : "";
    }
    return initial;
  });

  const missingRequired = LEAD_FIELDS.filter(
    (f) => f.required && !Object.values(mapping).includes(f.key)
  );

  function handleSubmit() {
    const clean: ColumnMapping = {};
    for (const [csvHeader, leadField] of Object.entries(mapping)) {
      if (leadField) {
        clean[csvHeader] = leadField;
      }
    }
    onSubmit(clean);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Map CSV columns to lead fields. Required fields are marked with{" "}
          <span className="text-destructive">*</span>.
        </p>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                CSV Column
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8" />
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Lead Field
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Sample Value
              </th>
            </tr>
          </thead>
          <tbody>
            {parsed.headers.map((header) => {
              const sampleValue = parsed.rows[0]?.[parsed.headers.indexOf(header)] ?? "";
              return (
                <tr key={header} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{header}</td>
                  <td className="px-1 py-2 text-muted-foreground">
                    <ArrowRight className="size-3" />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={mapping[header] ?? ""}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [header]: e.target.value }))
                      }
                      className="w-full rounded border bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">— Skip —</option>
                      {LEAD_FIELDS.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                          {field.required ? " *" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                    {sampleValue}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {missingRequired.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Missing required fields:{" "}
          {missingRequired.map((f) => f.label).join(", ")}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground"
          disabled={importing}
        >
          ← Back to file upload
        </button>
        <button
          onClick={handleSubmit}
          disabled={importing || missingRequired.length > 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {importing ? (
            <span className="flex items-center gap-2">
              <span className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Importing...
            </span>
          ) : (
            `Import ${parsed.rows.length} Lead${parsed.rows.length !== 1 ? "s" : ""}`
          )}
        </button>
      </div>
    </div>
  );
}
