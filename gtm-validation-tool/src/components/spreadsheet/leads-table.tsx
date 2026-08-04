"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table";
import type { Lead } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, ArrowUpDown, Search,
  Upload, Columns3, X, CheckCircle2, XCircle, HelpCircle,
  ShieldCheck, ShieldX, Filter, Download, Trash2,
  ChevronDown, Globe, Building2, MapPin, Link2,
} from "lucide-react";

const VERTICAL_COLORS: Record<string, string> = {
  "D2C / E-commerce": "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  "Defense / Aviation": "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800",
  Fintech: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  Pharma: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  "Semiconductor / Data Center": "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
};

const FILTER_CHIPS = [
  { key: "valid_email", label: "Valid Email", fn: (l: Lead) => l.email_check === "Valid" },
  { key: "invalid_email", label: "Invalid Email", fn: (l: Lead) => l.email_check === "Invalid" },
  { key: "icp_match", label: "ICP Match", fn: (l: Lead) => l.vertical_match === true },
  { key: "safe", label: "Safe to Send", fn: (l: Lead) => l.safe_to_send === true },
] as const;

/* ── Inline editor ──────────────────────────────────────────── */

function EditableCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  }

  return editing ? (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
      className="w-full rounded border bg-background px-1 py-0.5 text-xs outline-none ring-1 ring-ring"
    />
  ) : (
    <span
      className="cursor-text block truncate"
      onDoubleClick={() => setEditing(true)}
      title="Double-click to edit"
    >
      {value}
    </span>
  );
}

/* ── Row detail panel ───────────────────────────────────────── */

function RowDetail({ lead }: { lead: Lead }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 px-4 py-3 bg-muted/20 text-xs">
      <Field icon={Building2} label="Company Description" value={lead.company_description} full />
      <Field icon={Globe} label="Website" value={lead.website} link />
      <Field icon={Link2} label="LinkedIn" value={lead.linkedin_url} link />
      <Field icon={MapPin} label="Location" value={`${lead.state}, ${lead.country}`} />
      <Field label="Domain" value={lead.domain} mono />
      <Field label="Reasoning" value={lead.reasoning ?? undefined} />
      {lead.ai_summary && <Field label="AI Summary" value={lead.ai_summary} full />}
      {lead.smtp_provider && <Field label="SMTP" value={lead.smtp_provider} mono />}
      {lead.mx_record && <Field label="MX Record" value={lead.mx_record} mono />}
    </div>
  );
}

function Field({ icon: Icon, label, value, link, mono, full }: {
  icon?: React.FC<{ className?: string }>;
  label: string;
  value?: string;
  link?: boolean;
  mono?: boolean;
  full?: boolean;
}) {
  if (!value) return null;
  const col = full ? "col-span-full" : "";
  return (
    <div className={`space-y-0.5 min-w-0 ${col}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="size-3" />}
        {label}
      </p>
      {link ? (
        <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer"
           className="text-blue-600 dark:text-blue-400 hover:underline truncate block">
          {value}
        </a>
      ) : (
        <p className={`truncate ${mono ? "font-mono" : ""}`}>{value}</p>
      )}
    </div>
  );
}

/* ── Columns ────────────────────────────────────────────────── */

function makeColumns(
  onSave: (rowId: string, field: string, value: string) => void
): ColumnDef<Lead>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <input type="checkbox" className="rounded"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()} />
      ),
      cell: ({ row }) => (
        <input type="checkbox" className="rounded"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()} />
      ),
      size: 32,
      enableSorting: false,
    },
    {
      id: "source",
      header: () => <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Source</span>,
      columns: [
        {
          accessorKey: "full_name", header: "Name", size: 150,
          cell: ({ row, getValue }) => (
            <EditableCell value={getValue<string>()} onSave={(v) => onSave(row.original.id, "full_name", v)} />
          ),
        },
        {
          accessorKey: "company_name", header: "Company", size: 170,
          cell: ({ row, getValue }) => (
            <EditableCell value={getValue<string>()} onSave={(v) => onSave(row.original.id, "company_name", v)} />
          ),
        },
        {
          accessorKey: "position", header: "Position", size: 130,
          cell: ({ row, getValue }) => (
            <EditableCell value={getValue<string>()} onSave={(v) => onSave(row.original.id, "position", v)} />
          ),
        },
        {
          accessorKey: "email", header: "Email", size: 200,
          cell: ({ row, getValue }) => (
            <span className="text-xs font-mono cursor-text block truncate" title="Double-click to edit"
              onDoubleClick={() => {
                const v = prompt("Edit email:", getValue<string>());
                if (v !== null && v.trim()) onSave(row.original.id, "email", v.trim());
              }}>
              {getValue<string>()}
            </span>
          ),
        },
        { accessorKey: "industry", header: "Industry", size: 110 },
        { accessorKey: "state", header: "State", size: 70 },
        { accessorKey: "domain", header: "Domain", size: 130 },
        {
          accessorKey: "employee_size", header: "Emp.", size: 55,
          cell: ({ getValue }) => {
            const v = getValue<number>();
            return v ? <span className="tabular-nums">{v.toLocaleString()}</span> : <span className="text-muted-foreground">—</span>;
          },
        },
        { accessorKey: "country", header: "Country", size: 90 },
      ],
    },
    {
      id: "validation",
      header: () => <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Validation</span>,
      columns: [
        {
          accessorKey: "email_check", header: "Email", size: 85,
          cell: ({ getValue }) => {
            const v = getValue<string>();
            if (!v) return <span className="text-muted-foreground text-xs">—</span>;
            if (v === "Valid") return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 text-[10px] h-5"><CheckCircle2 className="size-2.5 mr-1" />Valid</Badge>;
            if (v === "Invalid") return <Badge className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 text-[10px] h-5"><XCircle className="size-2.5 mr-1" />Invalid</Badge>;
            return <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 text-[10px] h-5"><HelpCircle className="size-2.5 mr-1" />Unk.</Badge>;
          },
        },
        {
          accessorKey: "vertical_match", header: "ICP", size: 65,
          cell: ({ getValue }) => {
            const v = getValue<boolean>();
            if (v === null || v === undefined) return <span className="text-muted-foreground text-xs">—</span>;
            return v
              ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 text-[10px] h-5">Yes</Badge>
              : <Badge className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 text-[10px] h-5">No</Badge>;
          },
        },
        {
          accessorKey: "matched_vertical", header: "Vertical", size: 145,
          cell: ({ getValue }) => {
            const v = getValue<string>();
            if (!v) return <span className="text-muted-foreground text-xs">—</span>;
            const colors = VERTICAL_COLORS[v] ?? "bg-muted text-muted-foreground border-border";
            return <Badge className={`${colors} text-[10px] h-5 border`}>{v}</Badge>;
          },
        },
        {
          accessorKey: "email_score", header: "Score", size: 55,
          cell: ({ getValue }) => {
            const v = getValue<number>();
            if (v === null || v === undefined) return <span className="text-muted-foreground text-xs">—</span>;
            const color = v >= 60 ? "text-emerald-600 dark:text-emerald-400" : v >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
            return <span className={`font-mono text-xs font-medium tabular-nums ${color}`}>{v}</span>;
          },
        },
        {
          accessorKey: "safe_to_send", header: "Safe", size: 50,
          cell: ({ getValue }) => {
            const v = getValue<boolean>();
            if (v === null || v === undefined) return <span className="text-muted-foreground text-xs">—</span>;
            return v ? <ShieldCheck className="size-4 text-emerald-500" /> : <ShieldX className="size-4 text-red-400" />;
          },
        },
        { accessorKey: "status", header: "Status", size: 90 },
      ],
    },
  ];
}

/* ── CSV export ─────────────────────────────────────────────── */

function exportCsv(rows: Lead[]) {
  if (rows.length === 0) return;
  const headers = [
    "Full Name", "Company", "Position", "Email", "Industry", "State", "Domain",
    "Employees", "Country", "Email Check", "ICP Match", "Vertical", "Score", "Safe", "Status",
  ];
  const keys: (keyof Lead)[] = [
    "full_name", "company_name", "position", "email", "industry", "state", "domain",
    "employee_size", "country", "email_check", "vertical_match", "matched_vertical",
    "email_score", "safe_to_send", "status",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((r) => keys.map((k) => {
      const v = r[k];
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Main component ─────────────────────────────────────────── */

interface LeadsTableProps {
  projectId: string;
  initialData: Lead[];
  initialTotal: number;
  refreshKey?: number;
}

export function LeadsTable({ projectId, initialData, initialTotal, refreshKey }: LeadsTableProps) {
  const [data, setData] = useState<Lead[]>(initialData);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const initialLoadRef = useRef(false);

  const columns = useCallback(makeColumns, [])(
    useCallback(async (rowId: string, field: string, value: string) => {
      setData((prev) => prev.map((r) => r.id === rowId ? { ...r, [field]: value } : r));
      try {
        await fetch(`/api/projects/${projectId}/leads/${rowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        toast.success("Updated");
      } catch {
        toast.error("Failed to save");
      }
    }, [projectId])
  );

  useEffect(() => {
    if (!initialLoadRef.current) { initialLoadRef.current = true; return; }
    fetchPage(0);
  }, [refreshKey]);

  const filteredData = activeFilter
    ? data.filter(FILTER_CHIPS.find((c) => c.key === activeFilter)!.fn)
    : data;

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: "includesString",
    getRowId: (row) => row.id,
  });

  async function fetchPage(pageIndex: number) {
    setLoading(true);
    const page = pageIndex + 1;
    const res = await fetch(`/api/projects/${projectId}/leads?page=${page}&limit=50`);
    const json = await res.json();
    setData(json.data);
    setTotalCount(json.total);
    setLoading(false);
  }

  async function deleteSelected() {
    const ids = table.getSelectedRowModel().rows.map((r) => r.original.id);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} lead${ids.length > 1 ? "s" : ""}?`)) return;
    setLoading(true);
    setRowSelection({});
    try {
      await Promise.all(ids.map((id) =>
        fetch(`/api/projects/${projectId}/leads/${id}`, { method: "DELETE" })
      ));
      toast.success(`Deleted ${ids.length} lead${ids.length > 1 ? "s" : ""}`);
      fetchPage(table.getState().pagination.pageIndex);
    } catch {
      toast.error("Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const leafColumns = table.getAllLeafColumns();
  const visibleLeafColumns = leafColumns.filter((c) => c.getIsVisible());
  const hasData = filteredData.length > 0;
  const isEmpty = !loading && !hasData;
  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-1">
          {FILTER_CHIPS.map((chip) => (
            <button key={chip.key}
              onClick={() => setActiveFilter(activeFilter === chip.key ? null : chip.key)}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                activeFilter === chip.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted text-muted-foreground border-border"
              }`}>
              <Filter className="size-3" />
              {chip.label}
              {activeFilter === chip.key && <X className="size-3" />}
            </button>
          ))}
        </div>

        <div className="relative">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowColumnPicker(!showColumnPicker)}>
            <Columns3 className="size-3.5" /> Columns
          </Button>
          {showColumnPicker && (
            <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border bg-popover p-2 shadow-md"
              onMouseLeave={() => setShowColumnPicker(false)}>
              <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {leafColumns.map((col) => (
                  <label key={col.id} className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted cursor-pointer">
                    <input type="checkbox" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()} className="rounded" />
                    {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => exportCsv(filteredData)} disabled={!hasData}>
          <Download className="size-3.5" /> Export
        </Button>

        {selectedCount > 0 && (
          <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={deleteSelected}>
            <Trash2 className="size-3.5" /> Delete ({selectedCount})
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isGroup = header.column.id === "source" || header.column.id === "validation";
                  if (isGroup) {
                    return (
                      <th key={header.id} colSpan={header.colSpan}
                        className="bg-muted/80 px-3 py-1 text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  }
                  if (header.column.id === "select") {
                    return (
                      <th key={header.id} className="bg-background px-2 py-1.5 border-b w-8">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  }
                  return (
                    <th key={header.id}
                      className="bg-background px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap border-b"
                      style={{ width: header.getSize() }}>
                      {header.column.getCanSort() ? (
                        <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={header.column.getToggleSortingHandler()}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDown className="size-3" />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  {visibleLeafColumns.map((_, j) => (
                    <td key={j} className="px-2 py-2.5"><Skeleton className="h-3 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : isEmpty ? (
              <tr>
                <td colSpan={visibleLeafColumns.length} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                      <Upload className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">
                      {data.length === 0 ? "No leads yet" : "No matches"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.length === 0 ? "Import a CSV to get started." : "Clear filters or broaden search."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <tr
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${expandedRows.has(row.id) ? "bg-muted/20" : ""}`}
                    onClick={() => toggleRow(row.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-2 py-2 whitespace-nowrap max-w-[220px] truncate">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                    <td className="px-2 py-2 w-8 text-muted-foreground">
                      <ChevronDown className={`size-3.5 transition-transform ${expandedRows.has(row.id) ? "rotate-180" : ""}`} />
                    </td>
                  </tr>
                  {expandedRows.has(row.id) && (
                    <tr className="border-b last:border-0">
                      <td colSpan={visibleLeafColumns.length + 1}>
                        <RowDetail lead={row.original} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {loading ? "Loading..." : `${totalCount} lead${totalCount !== 1 ? "s" : ""}${activeFilter ? " (filtered)" : ""}`}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs"
            onClick={() => { table.previousPage(); fetchPage(table.getState().pagination.pageIndex - 1); }}
            disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="px-2 tabular-nums">{table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}</span>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs"
            onClick={() => { table.nextPage(); fetchPage(table.getState().pagination.pageIndex + 1); }}
            disabled={!table.getCanNextPage()}>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
