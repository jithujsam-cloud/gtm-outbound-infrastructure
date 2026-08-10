"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

const PAGE_SIZES = [25, 50, 100];

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Success", value: "success" },
  { label: "Failed", value: "failed" },
  { label: "Retryable Error", value: "retryable_error" },
  { label: "Fatal Error", value: "fatal_error" },
];

const PROVIDER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Gemini", value: "gemini" },
  { label: "Clearout", value: "clearout" },
];

export default function LogsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [providerFilter, setProviderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (providerFilter) params.set("provider", providerFilter);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/logs?${params}`);
    const json = await res.json();
    setData(json.data ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [page, pageSize, providerFilter, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, providerFilter, statusFilter]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API Operation Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every external API call is logged here. Filter by provider, status, or browse history.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="h-8 text-xs w-[120px]"
          value={providerFilter}
          onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
        >
          {PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>

        <Select
          className="h-8 text-xs w-[140px]"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">Time</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">Provider</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">Operation</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">Attempt</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">Duration</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">Error</th>
            </tr>
          </thead>
          <tbody>
            {loading && data.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted-foreground text-xs">
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted-foreground text-xs">
                  No log entries found.
                </td>
              </tr>
            ) : (
              data.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-1.5 text-xs tabular-nums whitespace-nowrap text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-xs">
                    <Badge variant={log.provider === "gemini" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                      {log.provider}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-xs">{log.operation}</td>
                  <td className="px-3 py-1.5 text-xs">
                    <Badge
                      variant={
                        log.status === "success" ? "default" :
                        log.status === "failed" ? "destructive" :
                        "outline"
                      }
                      className="text-[10px] px-1.5 py-0"
                    >
                      {log.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-xs tabular-nums">{log.attempt}</td>
                  <td className="px-3 py-1.5 text-xs tabular-nums text-muted-foreground">
                    {log.duration_ms ? `${log.duration_ms}ms` : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-xs max-w-[200px] truncate text-muted-foreground" title={log.error_message}>
                    {log.error_message || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {total === 0 ? "No entries" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Rows</span>
            <Select
              className="h-7 text-xs w-[65px]"
              value={String(pageSize)}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="size-3.5" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground px-1 tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
          >
            Next <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
