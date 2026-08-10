"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { Lead } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Search,
  X,
  ExternalLink,
  Building2,
  Mail,
  Globe,
  MapPin,
  Users,
  Briefcase,
  Sparkles,
  Brain,
  Shield,
} from "lucide-react";

const columns: ColumnDef<Lead>[] = [
  { accessorKey: "full_name", header: "Full Name", size: 180 },
  { accessorKey: "company_name", header: "Company", size: 200 },
  {
    accessorKey: "email",
    header: "Email",
    size: 220,
    cell: ({ getValue }) => (
      <span className="truncate block max-w-[200px]">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "vertical_match",
    header: "ICP Match",
    size: 100,
    cell: ({ getValue }) => {
      const val = getValue<boolean | null>();
      if (val === null) return <span className="text-muted-foreground">—</span>;
      return (
        <Badge variant={val ? "default" : "outline"} className="text-xs">
          {val ? "Match" : "No"}
        </Badge>
      );
    },
  },
  { accessorKey: "matched_vertical", header: "Vertical", size: 140 },
  {
    accessorKey: "email_check",
    header: "Email Check",
    size: 110,
    cell: ({ getValue }) => {
      const val = getValue<string | null>();
      if (!val) return <span className="text-muted-foreground">—</span>;
      const variant =
        val === "Valid" ? "default" : val === "Invalid" ? "destructive" : "secondary";
      return (
        <Badge variant={variant} className="text-xs">
          {val}
        </Badge>
      );
    },
  },
  {
    accessorKey: "safe_to_send",
    header: "Safe",
    size: 80,
    cell: ({ getValue }) => {
      const val = getValue<boolean | null>();
      if (val === null) return <span className="text-muted-foreground">—</span>;
      return (
        <Badge variant={val ? "default" : "destructive"} className="text-xs">
          {val ? "Yes" : "No"}
        </Badge>
      );
    },
  },
];

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
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // debounced server-side search
  const filteredData = useMemo(() => {
    if (!globalFilter) return data;
    const q = globalFilter.toLowerCase();
    return data.filter(
      (lead) =>
        lead.full_name?.toLowerCase().includes(q) ||
        lead.company_name?.toLowerCase().includes(q) ||
        lead.email?.toLowerCase().includes(q) ||
        lead.position?.toLowerCase().includes(q) ||
        lead.industry?.toLowerCase().includes(q) ||
        lead.matched_vertical?.toLowerCase().includes(q)
    );
  }, [data, globalFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  async function fetchPage(pageIndex: number) {
    setLoading(true);
    const page = pageIndex + 1;
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (globalFilter) params.set("search", globalFilter);
    const res = await fetch(
      `/api/projects/${projectId}/leads?${params}`
    );
    const json = await res.json();
    setData(json.data);
    setTotalCount(json.total);
    setSelectedLead(null);
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Search by name, company, email, or vertical..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-md"
        />
        {globalFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGlobalFilter("")}
            className="shrink-0"
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                    style={{ minWidth: header.getSize() }}
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
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  {loading ? "Loading..." : "No leads found."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors ${
                    selectedLead?.id === row.original.id ? "bg-muted" : ""
                  }`}
                  onClick={() =>
                    setSelectedLead(
                      selectedLead?.id === row.original.id ? null : row.original
                    )
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-2 whitespace-nowrap"
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

      {selectedLead && (
        <div className="rounded-md border bg-card p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{selectedLead.full_name}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedLead.position}
                {selectedLead.position && selectedLead.company_name && " at "}
                {selectedLead.company_name}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedLead(null)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {selectedLead.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-3.5 shrink-0" />
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="truncate hover:text-foreground underline"
                >
                  {selectedLead.email}
                </a>
              </div>
            )}
            {selectedLead.domain && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="size-3.5 shrink-0" />
                <span className="truncate">{selectedLead.domain}</span>
              </div>
            )}
            {selectedLead.industry && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="size-3.5 shrink-0" />
                <span>{selectedLead.industry}</span>
              </div>
            )}
            {selectedLead.country && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                <span>
                  {selectedLead.state ? `${selectedLead.state}, ` : ""}
                  {selectedLead.country}
                </span>
              </div>
            )}
            {selectedLead.employee_size && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="size-3.5 shrink-0" />
                <span>{selectedLead.employee_size.toLocaleString()} employees</span>
              </div>
            )}
            {selectedLead.email_score != null && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-3.5 shrink-0" />
                <span>Score: {selectedLead.email_score}</span>
              </div>
            )}
          </div>

          {selectedLead.company_description && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <Building2 className="size-3.5" />
                About {selectedLead.company_name}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selectedLead.company_description}
              </p>
            </div>
          )}

          {selectedLead.ai_summary && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <Sparkles className="size-3.5" />
                AI Summary
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selectedLead.ai_summary}
              </p>
            </div>
          )}

          {selectedLead.reasoning && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <Brain className="size-3.5" />
                ICP Reasoning
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selectedLead.reasoning}
              </p>
            </div>
          )}

          {(selectedLead.linkedin_url || selectedLead.company_linkedin || selectedLead.website) && (
            <div className="flex flex-wrap gap-3">
              {selectedLead.linkedin_url && (
                <a
                  href={selectedLead.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                  LinkedIn Profile
                </a>
              )}
              {selectedLead.company_linkedin && (
                <a
                  href={selectedLead.company_linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                  Company LinkedIn
                </a>
              )}
              {selectedLead.website && (
                <a
                  href={selectedLead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                  Website
                </a>
              )}
            </div>
          )}

          {selectedLead.smtp_provider && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="size-3.5 shrink-0" />
              <span>SMTP: {selectedLead.smtp_provider}</span>
              {selectedLead.mx_record && <span>· MX: {selectedLead.mx_record}</span>}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount} lead{totalCount !== 1 ? "s" : ""} total
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              table.previousPage();
              fetchPage(table.getState().pagination.pageIndex - 1);
            }}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(table.getPageCount(), 1)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              table.nextPage();
              fetchPage(table.getState().pagination.pageIndex + 1);
            }}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
