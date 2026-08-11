"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
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
import { Select } from "@/components/ui/select";
import { Popover, PopoverItem } from "@/components/ui/popover";
import { ImportLeadsDialog } from "@/components/spreadsheet/import-leads-dialog";
import { IcpValidationDialog } from "@/components/spreadsheet/icp-validation-button";
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
        checked={table.getIsAllPageRowsSelected()}
        ref={(el) => {
          if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
        }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
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
    minSize: 36,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "full_name",
    header: "Name",
    size: 150,
    minSize: 100,
    cell: ({ getValue }) => <span className="truncate block max-w-[150px]" title={getValue<string>()}>{getValue<string>()}</span>,
  },
  {
    accessorKey: "company_name",
    header: "Company",
    size: 160,
    minSize: 100,
    cell: ({ getValue }) => <span className="truncate block max-w-[160px]" title={getValue<string>()}>{getValue<string>()}</span>,
  },
  {
    accessorKey: "email",
    header: "Email",
    size: 210,
    minSize: 140,
    cell: ({ getValue }) => <span className="truncate block max-w-[210px]" title={getValue<string>()}>{getValue<string>()}</span>,
  },
  {
    accessorKey: "industry",
    header: "Industry",
    size: 130,
    minSize: 80,
    cell: ({ getValue }) => <span className="truncate block max-w-[130px]" title={getValue<string>()}>{getValue<string>()}</span>,
  },
  {
    accessorKey: "email_check",
    header: "Email Check",
    size: 100,
    minSize: 80,
    cell: ({ getValue }) => {
      const val = getValue<string | null>();
      if (!val) return <span className="text-muted-foreground text-xs">—</span>;
      const v = val === "Valid" ? "default" : val === "Invalid" ? "destructive" : "secondary";
      return <Badge variant={v as any} className="text-[10px] px-1.5 py-0">{val}</Badge>;
    },
  },
  {
    accessorKey: "vertical_match",
    header: "ICP",
    size: 160,
    minSize: 100,
    cell: ({ row }) => {
      const val = row.getValue<boolean | null>("vertical_match");
      const vertical = row.getValue<string | null>("matched_vertical");
      const reasoning = row.getValue<string | null>("reasoning");

      if (val === null) return <span className="text-muted-foreground text-xs">—</span>;

      const trigger = (
        <span className="cursor-pointer inline-flex items-center gap-1">
          <Badge variant={val ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
            {val ? "✓" : "✕"}
          </Badge>
          {vertical && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">{vertical}</span>
          )}
        </span>
      );

      if (!reasoning && !vertical) return trigger;

      return (
        <IcpReasonPopover trigger={trigger}>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Badge variant={val ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                {val ? "ICP Match" : "Does not fit"}
              </Badge>
              {vertical && (
                <span className="text-xs font-medium">{vertical}</span>
              )}
            </div>
            {reasoning && (
              <p className="text-xs text-muted-foreground leading-relaxed">{reasoning}</p>
            )}
          </div>
        </IcpReasonPopover>
      );
    },
  },
  {
    accessorKey: "matched_vertical",
    header: "Vertical",
    size: 130,
    minSize: 80,
    cell: ({ getValue }) => <span className="truncate block max-w-[130px]" title={getValue<string | null>() ?? ""}>{getValue<string | null>() ?? "—"}</span>,
  },
  { accessorKey: "position", header: "Position", size: 130, minSize: 80 },
  { accessorKey: "state", header: "State", size: 80, minSize: 60 },
  { accessorKey: "domain", header: "Domain", size: 150, minSize: 100 },
  { accessorKey: "employee_size", header: "Emp.", size: 60, minSize: 50 },
  { accessorKey: "country", header: "Country", size: 90, minSize: 70 },
  { accessorKey: "email_score", header: "Score", size: 60, minSize: 50 },
  {
    accessorKey: "status",
    header: "Status",
    size: 90,
    minSize: 70,
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string | null>() ?? "—"}</span>,
  },
  {
    accessorKey: "safe_to_send",
    header: "Safe",
    size: 60,
    minSize: 50,
    cell: ({ getValue }) => {
      const val = getValue<boolean | null>();
      if (val === null) return <span className="text-muted-foreground text-xs">—</span>;
      return <Badge variant={val ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">{val ? "Yes" : "No"}</Badge>;
    },
  },
  {
    accessorKey: "created_at",
    header: "Created",
    size: 140,
    minSize: 100,
    cell: ({ getValue }) => {
      const val = getValue<string | null>();
      if (!val) return <span className="text-muted-foreground text-xs">—</span>;
      const d = new Date(val);
      return <span className="text-xs text-muted-foreground">{d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>;
    },
  },
  {
    accessorKey: "updated_at",
    header: "Updated",
    size: 140,
    minSize: 100,
    cell: ({ getValue }) => {
      const val = getValue<string | null>();
      if (!val) return <span className="text-muted-foreground text-xs">—</span>;
      const d = new Date(val);
      return <span className="text-xs text-muted-foreground">{d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>;
    },
  },
];

const DEFAULT_VISIBLE: Record<string, boolean> = {
  select: true,
  full_name: true,
  company_name: true,
  email: true,
  industry: true,
  email_check: true,
  vertical_match: true,
  matched_vertical: true,
  position: false,
  state: false,
  domain: false,
  employee_size: false,
  country: false,
  email_score: false,
  status: false,
  safe_to_send: false,
  created_at: false,
  updated_at: false,
};

const PAGE_SIZES = [10, 20, 50, 100];

const FILTER_OPTIONS = {
  email_check: [
    { label: "Valid", value: "Valid" },
    { label: "Invalid", value: "Invalid" },
    { label: "Unknown", value: "Unknown" },
    { label: "Not validated", value: "null" },
  ],
  vertical_match: [
    { label: "ICP Match", value: "true" },
    { label: "No Match", value: "false" },
    { label: "Not validated", value: "null" },
  ],
};

interface LeadsTableProps {
  projectId: string;
  initialData: Lead[];
  initialTotal: number;
  refreshKey?: number;
  onValidationComplete?: () => void;
}

export function LeadsTable({ projectId, initialData, initialTotal, refreshKey, onValidationComplete }: LeadsTableProps) {
  const [data, setData] = useState<Lead[]>(initialData);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [validating, setValidating] = useState<"icp" | "email" | null>(null);
  const [icpDialogOpen, setIcpDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  const storageKey = STORAGE_KEY_PREFIX + projectId;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === "undefined") return DEFAULT_VISIBLE;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) return { ...DEFAULT_VISIBLE, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_VISIBLE;
  });

  const mountedRef = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(columnVisibility)); } catch {}
  }, [columnVisibility, storageKey]);

  const table = useReactTable({
    data,
    columns: ALL_COLUMNS,
    state: { sorting, globalFilter, columnVisibility, rowSelection, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    globalFilterFn: "includesString",
    manualPagination: true,
    pageCount: Math.max(Math.ceil(totalCount / pageSize), 1),
  });

  const selectedIds = useMemo(() => {
    return table.getSelectedRowModel().rows.map((r) => r.original.id);
  }, [rowSelection, data]);

  const fetchPage = useCallback(async (page: number, size: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page + 1), limit: String(size) });
    if (globalFilter) params.set("search", globalFilter);
    Object.entries(filters).forEach(([k, vals]) => { if (vals.length > 0) vals.forEach((v) => params.append(k, v)); });
    const res = await fetch(`/api/projects/${projectId}/leads?${params}`);
    const json = await res.json();
    setData(json.data);
    setTotalCount(json.total);
    setPageIndex(Math.min(page, Math.max(0, Math.ceil(json.total / size) - 1)));
    setRowSelection({});
    setLoading(false);
  }, [projectId, globalFilter, filters]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    fetchPage(pageIndex, pageSize);
  }, [pageIndex, pageSize, globalFilter, filters, refreshKey]);

  const activeFilterCount = Object.values(filters).reduce((sum, vals) => sum + vals.length, 0);

  const fetchAllIds = useCallback(async (): Promise<string[]> => {
    const params = new URLSearchParams();
    if (globalFilter) params.set("search", globalFilter);
    Object.entries(filters).forEach(([k, vals]) => { if (vals.length > 0) vals.forEach((v) => params.append(k, v)); });
    params.set("idsonly", "true");
    const res = await fetch(`/api/projects/${projectId}/leads?${params}`);
    const json = await res.json();
    return json.ids ?? [];
  }, [projectId, globalFilter, filters]);

  const runValidation = async (type: "email", all: boolean) => {
    let ids: string[];
    if (all) {
      const params = new URLSearchParams();
      if (globalFilter) params.set("search", globalFilter);
      Object.entries(filters).forEach(([k, vals]) => { if (vals.length > 0) vals.forEach((v) => params.append(k, v)); });
      params.set("idsonly", "true");
      const res = await fetch(`/api/projects/${projectId}/leads?${params}`);
      const json = await res.json();
      ids = json.ids ?? [];
    } else {
      ids = selectedIds;
    }
    if (ids.length === 0) return;
    setValidating(type);
    const label = type === "email" ? "Email" : "ICP";
    try {
      const res = await fetch(`/api/projects/${projectId}/validate/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: ids }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      toast.success(`${label} validation done — ${json.processed ?? ids.length} processed`);
      onValidationComplete?.();
      fetchPage(pageIndex, pageSize);
    } catch (err: any) {
      toast.error(`${label} validation failed: ${err.message}`);
    } finally {
      setValidating(null);
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPageIndex(0);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => {
      const current = prev[key] ?? [];
      const filtered = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return filtered.length > 0 ? { ...prev, [key]: filtered } : (() => { const { [key]: _, ...rest } = prev; return rest; })();
    });
    setPageIndex(0);
  };

  const clearFilters = () => {
    setFilters({});
    setPageIndex(0);
  };

  const start = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const end = totalCount === 0 ? 0 : Math.min((pageIndex + 1) * pageSize, totalCount);

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[120px] sm:min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={globalFilter}
            onChange={(e) => { setGlobalFilter(e.target.value); setPageIndex(0); }}
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
          {/* Filters */}
          <Popover
            trigger={
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 relative">
                <ListFilter className="size-3.5" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 size-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            }
            align="end"
          >
            <div className="space-y-3 p-1 min-w-[200px]">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 px-1">Email Check</p>
                {FILTER_OPTIONS.email_check.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 rounded-sm px-2 py-1 text-xs hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      className="size-3 rounded"
                      checked={(filters.email_check ?? []).includes(opt.value)}
                      onChange={() => handleFilterChange("email_check", opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 px-1">ICP Match</p>
                {FILTER_OPTIONS.vertical_match.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 rounded-sm px-2 py-1 text-xs hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      className="size-3 rounded"
                      checked={(filters.vertical_match ?? []).includes(opt.value)}
                      onChange={() => handleFilterChange("vertical_match", opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 px-1">Industry</p>
                <div className="px-1">
                  <input
                    type="text"
                    placeholder="Filter industry..."
                    className="w-full rounded border border-input bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    value={filters.industry?.[0] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFilters((prev) => {
                        if (!val) { const { industry, ...rest } = prev; return rest; }
                        return { ...prev, industry: [val] };
                      });
                      setPageIndex(0);
                    }}
                  />
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="w-full text-xs text-muted-foreground hover:text-foreground py-1 border-t border-border mt-1"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </Popover>

          {/* Columns toggle */}
          <Popover
            trigger={
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <Columns3 className="size-3.5" />
                <span className="hidden sm:inline">Columns</span>
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
            <span className="hidden sm:inline">Import</span>
          </Button>

          {/* ICP Validate */}
          <Button
            variant="default"
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={validating !== null}
            onClick={() => setIcpDialogOpen(true)}
          >
            <CheckCircle2 className="size-3.5" />
            <span className="hidden sm:inline">{validating === "icp" ? "ICP…" : "ICP"}</span>
          </Button>

          {/* Email Validate */}
          <Popover
            trigger={
              <Button
                variant="default"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={validating !== null}
              >
                <MailCheck className="size-3.5" />
                <span className="hidden sm:inline">{validating === "email" ? "Email…" : "Email"}</span>
              </Button>
            }
            align="end"
          >
            <PopoverItem onClick={() => runValidation("email", false)} disabled={selectedIds.length === 0}>
              Validate Selected ({selectedIds.length})
            </PopoverItem>
            <PopoverItem onClick={() => runValidation("email", true)} disabled={totalCount === 0}>
              Validate All ({totalCount})
            </PopoverItem>
          </Popover>
        </div>
      </div>

      {/* Table */}
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
                      style={{ width: header.getSize(), minWidth: header.column.columnDef.minSize ?? header.getSize() }}
                    >
                      {canSort ? (
                        <Popover
                          trigger={
                            <button className="inline-flex items-center gap-1 hover:text-foreground text-[11px]">
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
                        </Popover>
                      ) : (
                        <span className="text-[11px]">
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
                      style={{ maxWidth: cell.column.columnDef.size }}
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {totalCount === 0 ? "No leads" : `Showing ${start}–${end} of ${totalCount}`}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Rows per page</span>
            <Select
              className="h-7 text-xs w-[70px]"
              value={String(pageSize)}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground min-w-[60px] text-center">
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : "0 selected"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setPageIndex((p) => Math.max(0, p - 1)); }}
            disabled={pageIndex === 0}
          >
            <ChevronLeft className="size-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </Button>
          <span className="text-xs text-muted-foreground px-1 min-w-[40px] sm:min-w-[60px] text-center tabular-nums">
            {pageIndex + 1} / {Math.max(Math.ceil(totalCount / pageSize), 1)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setPageIndex((p) => p + 1); }}
            disabled={pageIndex + 1 >= Math.ceil(totalCount / pageSize)}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <ImportLeadsDialog
        projectId={projectId}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => { fetchPage(0, pageSize); onValidationComplete?.(); }}
      />

      <IcpValidationDialog
        projectId={projectId}
        open={icpDialogOpen}
        onOpenChange={setIcpDialogOpen}
        selectedIds={selectedIds}
        totalCount={totalCount}
        onValidationComplete={() => {
          onValidationComplete?.();
          fetchPage(pageIndex, pageSize);
        }}
        fetchAllIds={fetchAllIds}
      />
    </div>
  );
}

function IcpReasonPopover({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <span className="relative inline-block">
      <span onClick={() => setOpen(!open)}>{trigger}</span>
      {open && (
        <div
          ref={ref}
          className="absolute z-50 left-0 top-full mt-1 w-72 rounded-md border bg-popover p-3 shadow-md"
        >
          {children}
        </div>
      )}
    </span>
  );
}
