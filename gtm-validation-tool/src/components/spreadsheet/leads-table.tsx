"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverItem } from "@/components/ui/popover";
import { ImportLeadsDialog } from "@/components/spreadsheet/import-leads-dialog";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Columns3,
  Upload,
  CheckCircle2,
  MailCheck,
  EyeOff,
  ListFilter,
} from "lucide-react";

const STORAGE_KEY_PREFIX = "leads-table-columns-";

const ALL_COLUMNS: ColumnDef<Lead>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <input
        type="checkbox"
        className="size-3.5 rounded border-input cursor-pointer"
        checked={table.getIsAllRowsSelected()}
        ref={(el) => { if (el) el.indeterminate = table.getIsSomeRowsSelected(); }}
        onChange={table.getToggleAllRowsSelectedHandler()}
        onClick={(e) => e.stopPropagation()}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        className="size-3.5 rounded border-input cursor-pointer"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        onClick={(e) => e.stopPropagation()}
      />
    ),
    size: 36,
    enableSorting: false,
    enableHiding: false,
  },
  { accessorKey: "full_name", header: "Full Name", size: 170 },
  { accessorKey: "company_name", header: "Company", size: 180 },
  { accessorKey: "position", header: "Position", size: 150 },
  { accessorKey: "email", header: "Email", size: 230 },
  { accessorKey: "industry", header: "Industry", size: 140 },
  { accessorKey: "state", header: "State", size: 90 },
  { accessorKey: "domain", header: "Domain", size: 180 },
  { accessorKey: "employee_size", header: "Employees", size: 100 },
  { accessorKey: "country", header: "Country", size: 110 },
  {
    accessorKey: "email_check",
    header: "Email Check",
    size: 115,
    cell: ({ getValue }) => {
      const val = getValue<string | null>();
      if (!val) return <span className="text-muted-foreground text-xs">—</span>;
      const v = val === "Valid" ? "default" : val === "Invalid" ? "destructive" : "secondary";
      return <Badge variant={v as any} className="text-[10px] px-1.5 py-0">{val}</Badge>;
    },
  },
  {
    accessorKey: "vertical_match",
    header: "ICP Match",
    size: 100,
    cell: ({ getValue }) => {
      const val = getValue<boolean | null>();
      if (val === null) return <span className="text-muted-foreground text-xs">—</span>;
      return <Badge variant={val ? "default" : "outline"} className="text-[10px] px-1.5 py-0">{val ? "Match" : "No"}</Badge>;
    },
  },
  { accessorKey: "matched_vertical", header: "Vertical", size: 150 },
  { accessorKey: "email_score", header: "Score", size: 70 },
  {
    accessorKey: "status",
    header: "Status",
    size: 110,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string | null>() ?? "—"}</span>
    ),
  },
  {
    accessorKey: "safe_to_send",
    header: "Safe",
    size: 70,
    cell: ({ getValue }) => {
      const val = getValue<boolean | null>();
      if (val === null) return <span className="text-muted-foreground text-xs">—</span>;
      return <Badge variant={val ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">{val ? "Yes" : "No"}</Badge>;
    },
  },
];

const DEFAULT_VISIBLE: Record<string, boolean> = {
  select: true,
  full_name: true,
  company_name: true,
  position: false,
  email: true,
  industry: true,
  state: false,
  domain: false,
  employee_size: false,
  country: false,
  email_check: true,
  vertical_match: true,
  matched_vertical: true,
  email_score: false,
  status: true,
  safe_to_send: true,
};

interface LeadsTableProps {
  projectId: string;
  initialData: Lead[];
  initialTotal: number;
}

export function LeadsTable({ projectId, initialData, initialTotal }: LeadsTableProps) {
  const [data, setData] = useState<Lead[]>(initialData);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [validating, setValidating] = useState<"icp" | "email" | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const storageKey = STORAGE_KEY_PREFIX + projectId;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === "undefined") return DEFAULT_VISIBLE;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) return { ...DEFAULT_VISIBLE, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_VISIBLE;
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(columnVisibility)); } catch {}
  }, [columnVisibility, storageKey]);

  const table = useReactTable({
    data,
    columns: ALL_COLUMNS,
    state: { sorting, globalFilter, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    globalFilterFn: "includesString",
  });

  const selectedIds = Object.keys(rowSelection).map((idx) => data[Number(idx)]?.id).filter(Boolean);

  const fetchPage = useCallback(async (pageIndex: number) => {
    setLoading(true);
    const page = pageIndex + 1;
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (globalFilter) params.set("search", globalFilter);
    const res = await fetch(`/api/projects/${projectId}/leads?${params}`);
    const json = await res.json();
    setData(json.data);
    setTotalCount(json.total);
    setRowSelection({});
    setLoading(false);
  }, [projectId, globalFilter]);

  const runValidation = async (type: "icp" | "email", all: boolean) => {
    const ids = all ? data.map((l) => l.id) : selectedIds;
    if (ids.length === 0) return;
    setValidating(type);
    const label = type === "icp" ? "ICP" : "email";
    try {
      const res = await fetch(`/api/projects/${projectId}/validate/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: ids }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      toast.success(`${label} validation done — ${json.processed ?? ids.length} processed`);
      const pageIdx = table.getState().pagination.pageIndex;
      fetchPage(pageIdx);
    } catch (err: any) {
      toast.error(`${label} validation failed: ${err.message}`);
    } finally {
      setValidating(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Columns toggle */}
          <Popover
            trigger={
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <Columns3 className="size-3.5" />
                Columns
              </Button>
            }
            align="end"
          >
            <div className="max-h-64 overflow-y-auto">
              {ALL_COLUMNS.filter((c) => c.enableHiding !== false && "accessorKey" in c).map(
                (col) => {
                  const key = (col as any).accessorKey as string;
                  const visible = columnVisibility[key] !== false;
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="size-3 rounded"
                        checked={visible}
                        onChange={() =>
                          setColumnVisibility((prev) => ({ ...prev, [key]: !visible }))
                        }
                      />
                      {typeof col.header === "string" ? col.header : key}
                    </label>
                  );
                }
              )}
            </div>
          </Popover>

          {/* Import */}
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setImportOpen(true)}>
            <Upload className="size-3.5" />
            Import
          </Button>

          {/* ICP Validate */}
          <Popover
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={validating !== null}
              >
                <CheckCircle2 className="size-3.5" />
                {validating === "icp" ? "ICP…" : "ICP"}
              </Button>
            }
            align="end"
          >
            <PopoverItem onClick={() => runValidation("icp", false)} disabled={selectedIds.length === 0}>
              Validate Selected ({selectedIds.length})
            </PopoverItem>
            <PopoverItem onClick={() => runValidation("icp", true)} disabled={data.length === 0}>
              Validate All ({totalCount})
            </PopoverItem>
          </Popover>

          {/* Email Validate */}
          <Popover
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={validating !== null}
              >
                <MailCheck className="size-3.5" />
                {validating === "email" ? "Email…" : "Email"}
              </Button>
            }
            align="end"
          >
            <PopoverItem onClick={() => runValidation("email", false)} disabled={selectedIds.length === 0}>
              Validate Selected ({selectedIds.length})
            </PopoverItem>
            <PopoverItem onClick={() => runValidation("email", true)} disabled={data.length === 0}>
              Validate All ({totalCount})
            </PopoverItem>
          </Popover>
        </div>
      </div>

      {/* Column header dropdown triggers — Clay-style: click header for sort + filter menu */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b bg-muted/50">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap"
                      style={{ width: header.getSize(), minWidth: header.getSize() }}
                    >
                      {canSort ? (
                        <Popover
                          trigger={
                            <button className="inline-flex items-center gap-1 hover:text-foreground text-xs">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {isSorted === "asc" ? (
                                <ArrowUp className="size-3" />
                              ) : isSorted === "desc" ? (
                                <ArrowDown className="size-3" />
                              ) : (
                                <ArrowUpDown className="size-3 opacity-40" />
                              )}
                            </button>
                          }
                          align="start"
                        >
                          <PopoverItem onClick={() => header.column.toggleSorting(false)}>
                            <ArrowUp className="size-3" /> Sort Ascending
                          </PopoverItem>
                          <PopoverItem onClick={() => header.column.toggleSorting(true)}>
                            <ArrowDown className="size-3" /> Sort Descending
                          </PopoverItem>
                          <PopoverItem onClick={() => header.column.toggleVisibility(false)}>
                            <EyeOff className="size-3" /> Hide Column
                          </PopoverItem>
                          <PopoverItem onClick={() => header.column.setFilterValue("")}>
                            <ListFilter className="size-3" /> Clear Filter
                          </PopoverItem>
                        </Popover>
                      ) : (
                        <span className="text-xs">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={ALL_COLUMNS.length} className="py-10 text-center text-muted-foreground text-xs">
                  {loading ? "Loading..." : "No leads found."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                    row.getIsSelected() ? "bg-muted/50" : ""
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-1.5 text-xs whitespace-nowrap"
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selectedIds.length > 0
            ? `${selectedIds.length} of ${totalCount} selected`
            : `${totalCount} lead${totalCount !== 1 ? "s" : ""} total`}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              table.previousPage();
              fetchPage(table.getState().pagination.pageIndex - 1);
            }}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-3.5" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground px-1 min-w-[60px] text-center">
            {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              table.nextPage();
              fetchPage(table.getState().pagination.pageIndex + 1);
            }}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <ImportLeadsDialog
        projectId={projectId}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => fetchPage(0)}
      />
    </div>
  );
}
