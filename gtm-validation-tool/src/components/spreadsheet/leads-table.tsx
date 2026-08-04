"use client";

import { useState, useEffect, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import type { Lead } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft, ChevronRight, ArrowUpDown, Search,
  Upload, Columns3, X, CheckCircle2, XCircle, HelpCircle,
  ShieldCheck, ShieldX, Filter,
} from "lucide-react";

const VERTICAL_COLORS: Record<string, string> = {
  "D2C / E-commerce": "bg-orange-100 text-orange-700 border-orange-200",
  "Defense / Aviation": "bg-slate-100 text-slate-700 border-slate-200",
  Fintech: "bg-blue-100 text-blue-700 border-blue-200",
  Pharma: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Semiconductor / Data Center": "bg-purple-100 text-purple-700 border-purple-200",
};

const columns: ColumnDef<Lead>[] = [
  {
    id: "source",
    header: () => <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Source</span>,
    columns: [
      { accessorKey: "full_name", header: "Full Name", size: 160 },
      {
        accessorKey: "company_name",
        header: "Company",
        size: 180,
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      { accessorKey: "position", header: "Position", size: 140 },
      {
        accessorKey: "email",
        header: "Email",
        size: 220,
        cell: ({ getValue }) => (
          <span className="text-xs font-mono">{getValue<string>()}</span>
        ),
      },
      { accessorKey: "industry", header: "Industry", size: 120 },
      { accessorKey: "state", header: "State", size: 80 },
      { accessorKey: "domain", header: "Domain", size: 140 },
      {
        accessorKey: "employee_size",
        header: "Emp.",
        size: 60,
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return v ? v.toLocaleString() : "—";
        },
      },
      { accessorKey: "country", header: "Country", size: 100 },
    ],
  },
  {
    id: "validation",
    header: () => <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Validation</span>,
    columns: [
      {
        accessorKey: "email_check",
        header: "Email",
        size: 90,
        cell: ({ getValue }) => {
          const v = getValue<string>();
          if (!v) return <span className="text-muted-foreground text-xs">—</span>;
          if (v === "Valid") return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] h-5"><CheckCircle2 className="size-2.5 mr-1" />Valid</Badge>;
          if (v === "Invalid") return <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] h-5"><XCircle className="size-2.5 mr-1" />Invalid</Badge>;
          return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] h-5"><HelpCircle className="size-2.5 mr-1" />Unknown</Badge>;
        },
      },
      {
        accessorKey: "vertical_match",
        header: "ICP",
        size: 70,
        cell: ({ getValue }) => {
          const v = getValue<boolean>();
          if (v === null || v === undefined) return <span className="text-muted-foreground text-xs">—</span>;
          return v
            ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] h-5"><CheckCircle2 className="size-2.5 mr-1" />Yes</Badge>
            : <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] h-5"><XCircle className="size-2.5 mr-1" />No</Badge>;
        },
      },
      {
        accessorKey: "matched_vertical",
        header: "Vertical",
        size: 150,
        cell: ({ getValue }) => {
          const v = getValue<string>();
          if (!v) return <span className="text-muted-foreground text-xs">—</span>;
          const colors = VERTICAL_COLORS[v] ?? "bg-muted text-muted-foreground border-border";
          return <Badge className={`${colors} text-[10px] h-5 border`}>{v}</Badge>;
        },
      },
      {
        accessorKey: "email_score",
        header: "Score",
        size: 60,
        cell: ({ getValue }) => {
          const v = getValue<number>();
          if (v === null || v === undefined) return <span className="text-muted-foreground text-xs">—</span>;
          const color = v >= 60 ? "text-emerald-600" : v >= 40 ? "text-amber-600" : "text-red-600";
          return <span className={`font-mono text-xs font-medium ${color}`}>{v}</span>;
        },
      },
      {
        accessorKey: "safe_to_send",
        header: "Safe",
        size: 60,
        cell: ({ getValue }) => {
          const v = getValue<boolean>();
          if (v === null || v === undefined) return <span className="text-muted-foreground text-xs">—</span>;
          return v
            ? <ShieldCheck className="size-4 text-emerald-500" />
            : <ShieldX className="size-4 text-red-400" />;
        },
      },
      { accessorKey: "status", header: "Status", size: 100 },
    ],
  },
];

const FILTER_CHIPS = [
  { key: "email_check", label: "Valid Email", fn: (l: Lead) => l.email_check === "Valid" },
  { key: "email_check_invalid", label: "Invalid Email", fn: (l: Lead) => l.email_check === "Invalid" },
  { key: "vertical_match_true", label: "ICP Match", fn: (l: Lead) => l.vertical_match === true },
  { key: "safe_to_send", label: "Safe to Send", fn: (l: Lead) => l.safe_to_send === true },
] as const;

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
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const initialLoad = useRef(false);

  useEffect(() => {
    if (!initialLoad.current) { initialLoad.current = true; return; }
    fetchPage(0);
  }, [refreshKey]);

  const filteredData = activeFilter
    ? data.filter(FILTER_CHIPS.find((c) => c.key === activeFilter)!.fn)
    : data;

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: "includesString",
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

  const leafColumns = table.getAllLeafColumns();
  const visibleLeafColumns = leafColumns.filter((c) => c.getIsVisible());
  const hasData = filteredData.length > 0;
  const isEmpty = !loading && !hasData;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search all columns..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-1">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setActiveFilter(activeFilter === chip.key ? null : chip.key)}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                activeFilter === chip.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted text-muted-foreground border-border"
              }`}
            >
              <Filter className="size-3" />
              {chip.label}
              {activeFilter === chip.key && <X className="size-3" />}
            </button>
          ))}
        </div>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowColumnPicker(!showColumnPicker)}
          >
            <Columns3 className="size-3.5" />
            Columns
          </Button>
          {showColumnPicker && (
            <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border bg-popover p-2 shadow-md">
              <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {leafColumns.map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={col.getIsVisible()}
                      onChange={col.getToggleVisibilityHandler()}
                      className="rounded"
                    />
                    {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSourceLabel = header.column.id === "source" || header.column.id === "validation";
                  if (isSourceLabel) {
                    return (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        className="bg-muted/80 px-3 py-1 text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  }
                  return (
                    <th
                      key={header.id}
                      className="bg-background px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap border-b"
                      style={{ width: header.getSize() }}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
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
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  {visibleLeafColumns.map((_, j) => (
                    <td key={j} className="px-3 py-2.5">
                      <Skeleton className="h-3 w-full" />
                    </td>
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
                    <div>
                      <p className="text-sm font-medium">
                        {data.length === 0 ? "No leads yet" : "No results match your filters"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {data.length === 0
                          ? "Import a CSV file to populate this project with leads."
                          : "Try adjusting your search or clearing active filters."}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-2 whitespace-nowrap max-w-[250px] truncate"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {loading
            ? "Loading..."
            : `${totalCount} lead${totalCount !== 1 ? "s" : ""}${activeFilter ? " (filtered)" : ""}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              table.previousPage();
              fetchPage(table.getState().pagination.pageIndex - 1);
            }}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="px-2 tabular-nums">
            {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              table.nextPage();
              fetchPage(table.getState().pagination.pageIndex + 1);
            }}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
