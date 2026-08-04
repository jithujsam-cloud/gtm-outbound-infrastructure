"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  fileName: string;
}

interface CsvUploadStepProps {
  onParsed: (data: ParsedCsv) => void;
}

export function CsvUploadStep({ onParsed }: CsvUploadStepProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedCsv | null>(null);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCsv = useCallback((text: string, fileName: string): ParsedCsv => {
    const lines = splitCsvRows(text);

    if (lines.length < 2) {
      throw new Error("CSV file must have a header row and at least one data row");
    }

    const headers = parseCsvLine(lines[0]);
    const rows: string[][] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
    }

    if (rows.length === 0) {
      throw new Error("No data rows found in CSV");
    }

    return { headers, rows, fileName };
  }, []);

  function handleFile(file: File) {
    setError(null);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseCsv(text, file.name);
        setPreview(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV");
        setPreview(null);
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read file");
      setParsing(false);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      handleFile(file);
    } else {
      setError("Please upload a .csv file");
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const previewRows = preview ? preview.rows.slice(0, 5) : [];
  const totalRows = preview?.rows.length ?? 0;

  return (
    <div className="space-y-4">
      {!preview ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors cursor-pointer",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            parsing && "opacity-50 pointer-events-none"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {parsing ? (
            <>
              <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Parsing CSV...</p>
            </>
          ) : (
            <>
              <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                <Upload className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                Drop your CSV file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">.csv files only</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleInputChange}
                className="hidden"
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <FileText className="size-5 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{preview.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {totalRows} row{totalRows !== 1 ? "s" : ""} · {preview.headers.length} columns
              </p>
            </div>
            <button
              onClick={() => {
                setPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Remove
            </button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-8">#</th>
                  {preview.headers.map((h) => (
                    <th
                      key={h}
                      className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1.5 whitespace-nowrap max-w-[200px] truncate">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalRows > 5 && (
            <p className="text-xs text-muted-foreground">
              Showing first 5 of {totalRows} rows
            </p>
          )}

          <button
            onClick={() => onParsed(preview)}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Continue to Column Mapping
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      current += char;
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      }
    } else {
      if (char === '"') {
        current += char;
        inQuotes = true;
      } else if (char === "\n") {
        rows.push(current);
        current = "";
      } else if (char === "\r") {
        // skip — handle \r\n
        if (i + 1 < text.length && text[i + 1] === "\n") {
          rows.push(current);
          current = "";
          i++;
        } else {
          rows.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }
  }

  if (current) {
    rows.push(current);
  }

  return rows.filter((r) => r.trim());
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
}
