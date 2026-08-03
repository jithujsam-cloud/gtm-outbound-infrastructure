"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationState,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { Lead } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, ArrowUpDown, Search } from "lucide-react";

const columns: ColumnDef<Lead>[] = [
  { accessorKey: "full_name", header: "Full Name", size: 160 },
  { accessorKey: "company_name", header: "Company", size: 180 },
  { accessorKey: "position", header: "Position", size: 160 },
  { accessorKey: "email", header: "Email", size: 220 },
  { accessorKey: "industry", header: "Industry", size: 140 },
  { accessorKey: "state", header: "State", size: 100 },
  { accessorKey: "domain", header: "Domain", size: 180 },
  { accessorKey: "employee_size", header: "Employees", size: 100 },
  { accessorKey: "country", header: "Country", size: 120 },
  { accessorKey: "email_check", header: "Email Check", size: 110 },
  { accessorKey: "vertical_match", header: "ICP Match", size: 100 },
  { accessorKey: "matched_vertical", header: "Vertical", size: 140 },
  { accessorKey: "email_score", header: "Score", size: 80 },
  { accessorKey: "status", header: "Status", size: 110 },
  { accessorKey: "safe_to_send", header: "Safe", size: 80 },
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

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <Input
          placeholder="Search leads..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
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
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-2 whitespace-nowrap truncate max-w-[250px]"
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
