"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Brain, CheckCircle2, XCircle, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { VARIABLE_OPTIONS } from "@/lib/validation/variables";
import { getIcpPrompt, getLlmProvider } from "@/app/settings/actions";
import { toast } from "sonner";
import { formatCost, formatTokens, formatDuration, type RunStats } from "@/lib/format";

const LLM_PROVIDERS = [
  { value: "gemini", label: "Gemini", models: ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash"] },
  { value: "openai", label: "OpenAI", models: ["gpt-4.1-mini-2025-04-14", "gpt-5.6-luna", "gpt-5.4-mini"] },
] as const;

export interface IcpValidationDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  totalCount: number;
  onValidationComplete: (completedIds: string[], runStats: RunStats | null) => void;
  fetchAllIds: () => Promise<string[]>;
}

interface ActivityItem {
  leadId: string;
  company: string;
  status: "success" | "failed";
  matchedVertical: string | null;
  error?: string;
}

interface ProgressState {
  completed: number;
  failed: number;
  pending: number;
  total: number;
  matched: number;
  noMatch: number;
}

export function IcpValidationDialog({
  projectId,
  open,
  onOpenChange,
  selectedIds,
  totalCount,
  onValidationComplete,
  fetchAllIds,
}: IcpValidationDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [variableFilter, setVariableFilter] = useState("");
  const [selectedVarIndex, setSelectedVarIndex] = useState(0);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-3.6-flash");
  const [temperature, setTemperature] = useState("0.2");
  const [maxTokens, setMaxTokens] = useState("512");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const seenLeadIds = useRef<Set<string>>(new Set());

  const filteredVariables = VARIABLE_OPTIONS.filter(
    (v) =>
      v.variable.toLowerCase().includes(variableFilter.toLowerCase()) ||
      v.label.toLowerCase().includes(variableFilter.toLowerCase())
  );

  const currentModels = LLM_PROVIDERS.find((p) => p.value === provider)?.models ?? LLM_PROVIDERS[0].models;

  const handleProviderChange = (value: string) => {
    setProvider(value);
    const newModels = LLM_PROVIDERS.find((p) => p.value === value)?.models ?? LLM_PROVIDERS[0].models;
    setModel(newModels[0]);
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setProgress(null);
    setActivity([]);
    setRunStats(null);
    seenLeadIds.current = new Set();

    Promise.all([
      getIcpPrompt(projectId),
      getLlmProvider(),
    ]).then(([promptResult, providerResult]) => {
      if (cancelled) return;
      if (promptResult.prompt) setPrompt(promptResult.prompt);
      if (providerResult.provider) {
        setProvider(providerResult.provider);
        const newModels = LLM_PROVIDERS.find((p) => p.value === providerResult.provider)?.models ?? LLM_PROVIDERS[0].models;
        setModel(newModels[0]);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  useEffect(() => {
    setSelectedVarIndex(0);
  }, [variableFilter]);

  const insertVariable = useCallback(
    (variable: string) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;

      const before = prompt.slice(0, start);
      const after = prompt.slice(end);

      const slashIndex = before.lastIndexOf("/", start);
      const newBefore =
        slashIndex >= 0
          ? before.slice(0, slashIndex) + variable
          : before + variable;

      const newPrompt = newBefore + after;
      setPrompt(newPrompt);
      setShowVariables(false);
      setVariableFilter("");

      requestAnimationFrame(() => {
        ta.focus();
        const newCursor = newBefore.length;
        ta.setSelectionRange(newCursor, newCursor);
      });
    },
    [prompt]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showVariables) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedVarIndex((prev) =>
            Math.min(prev + 1, filteredVariables.length - 1)
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedVarIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (filteredVariables[selectedVarIndex]) {
            insertVariable(filteredVariables[selectedVarIndex].variable);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          setShowVariables(false);
          setVariableFilter("");
        }
      }
    },
    [showVariables, filteredVariables, selectedVarIndex, insertVariable]
  );

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setPrompt(value);

    const beforeCursor = value.slice(0, cursor);
    const lastSlash = beforeCursor.lastIndexOf("/");
    const afterSlash = beforeCursor.slice(lastSlash + 1);

    if (lastSlash >= 0 && !afterSlash.includes(" ") && !afterSlash.includes("\n")) {
      setShowVariables(true);
      setVariableFilter(afterSlash);
    } else {
      setShowVariables(false);
      setVariableFilter("");
    }
  };

  const fetchJobDetail = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/jobs/${jobId}/detail`);
    if (!res.ok) return null;
    return res.json();
  }, []);

  const refreshActivityFromDetail = useCallback(async (jobId: string) => {
    const detail = await fetchJobDetail(jobId);
    if (!detail) return;

    if (detail.runStats) {
      setRunStats(detail.runStats);
      setProgress({
        completed: detail.runStats.successful,
        failed: detail.runStats.failed,
        pending: Math.max(0, detail.runStats.leadsRequested - detail.runStats.leadsProcessed),
        total: detail.runStats.leadsRequested,
        matched: detail.runStats.matched,
        noMatch: detail.runStats.noMatch,
      });
    }

    const newActivity: ActivityItem[] = [];
    for (const item of detail.items ?? []) {
      if (item.status !== "completed" && item.status !== "failed") continue;
      if (seenLeadIds.current.has(item.lead_id)) continue;
      seenLeadIds.current.add(item.lead_id);

      const lead = item.lead;
      newActivity.push({
        leadId: item.lead_id,
        company: lead?.company_name ?? "Unknown lead",
        status: item.status === "completed" ? "success" : "failed",
        matchedVertical: item.status === "completed" ? lead?.matched_vertical ?? null : null,
        error: item.error_message ?? undefined,
      });
    }

    if (newActivity.length > 0) {
      setActivity((prev) => [...newActivity.reverse(), ...prev]);
    }
  }, [fetchJobDetail]);

  const runValidation = async (all: boolean) => {
    let ids: string[];
    if (all) {
      ids = await fetchAllIds();
    } else {
      ids = selectedIds;
    }
    if (ids.length === 0) return;

    setValidating(true);
    setProgress({ completed: 0, failed: 0, pending: ids.length, total: ids.length, matched: 0, noMatch: 0 });
    setActivity([]);
    setRunStats(null);
    seenLeadIds.current = new Set();

    try {
      const body: any = {
        type: "icp",
        mode: all ? "continuous" : "selected",
        prompt,
        provider,
        model,
        temperature: parseFloat(temperature) || 0.2,
        maxTokens: parseInt(maxTokens, 10) || 512,
      };
      if (!all) body.leadIds = ids;

      const jobRes = await fetch(`/api/projects/${projectId}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!jobRes.ok) {
        const text = await jobRes.text();
        let msg = text;
        try { msg = JSON.parse(text).error || text; } catch {}
        throw new Error(msg);
      }

      const jobJson = await jobRes.json();
      const currentJobId = jobJson.jobId;
      setProgress((p) => p ? { ...p, total: jobJson.totalLeads, pending: jobJson.totalLeads } : null);

      while (true) {
        const statusRes = await fetch(`/api/jobs/${currentJobId}`);
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.progress) {
            setProgress((p) => p ? {
              ...p,
              completed: status.progress.completed,
              failed: status.progress.failed,
              pending: status.progress.pending,
              total: status.progress.total,
            } : p);
          }
          if (status.runStats) setRunStats(status.runStats);

          if (
            status.progress.pending === 0 ||
            ["completed", "completed_with_errors", "failed", "cancelled", "paused"].includes(status.status)
          ) {
            break;
          }
        }

        const processRes = await fetch(`/api/jobs/${currentJobId}/process`, { method: "POST" });
        if (!processRes.ok) {
          const text = await processRes.text();
          let msg = text;
          try { msg = JSON.parse(text).error || text; } catch {}
          throw new Error(msg);
        }

        const result = await processRes.json();

        // Refresh per-lead activity from actual job data (not fake progress).
        await refreshActivityFromDetail(currentJobId);

        if (result.paused) {
          toast.error(`Job paused: ${result.pausedReason || "Unknown error"}`);
          break;
        }

        if (result.complete) break;

        await new Promise((r) => setTimeout(r, 500));
      }

      // Final refresh for definitive numbers and activity.
      await refreshActivityFromDetail(currentJobId);
      const finalDetail = await fetchJobDetail(currentJobId);
      const finalStats: RunStats | null = finalDetail?.runStats ?? null;
      setRunStats(finalStats);

      const completedIds = (finalDetail?.items ?? [])
        .filter((i: any) => i.status === "completed")
        .map((i: any) => i.lead_id);

      onValidationComplete(completedIds, finalStats);
    } catch (err: any) {
      toast.error(`ICP validation failed: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  const processedCount = progress ? progress.completed + progress.failed : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>ICP Validation</DialogTitle>
          <DialogDescription>
            {selectedIds.length > 0
              ? `${selectedIds.length} lead${selectedIds.length !== 1 ? "s" : ""} selected`
              : `${totalCount} leads in project`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Loading prompt...
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Provider</label>
                  <Select
                    className="h-8 text-xs w-[120px]"
                    value={provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    disabled={validating}
                  >
                    {LLM_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  <Select
                    className="h-8 text-xs w-[220px]"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={validating}
                  >
                    {currentModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Temp</label>
                  <Input
                    className="h-8 text-xs w-[60px]"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    disabled={validating}
                    placeholder="0.2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Max Tokens</label>
                  <Input
                    className="h-8 text-xs w-[90px]"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                    disabled={validating}
                    placeholder="512"
                  />
                </div>
              </div>

              <div className="space-y-2 relative">
                <label className="text-sm font-medium">Prompt</label>
                <textarea
                  ref={textareaRef}
                  className="w-full min-h-[140px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-mono"
                  value={prompt}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  disabled={validating}
                />

                {showVariables && filteredVariables.length > 0 && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-full sm:w-64 rounded-md border bg-popover p-1 shadow-md max-h-48 overflow-y-auto">
                    {filteredVariables.map((v, i) => (
                      <button
                        key={v.variable}
                        className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-left ${
                          i === selectedVarIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted"
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertVariable(v.variable);
                        }}
                      >
                        <code className="text-[10px] px-1 py-0.5 rounded bg-muted font-mono">
                          {v.variable}
                        </code>
                        <span className="text-muted-foreground">{v.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-muted-foreground mr-1 self-center">
                  Variables:
                </span>
                {VARIABLE_OPTIONS.slice(0, 8).map((v) => (
                  <Badge
                    key={v.variable}
                    variant="outline"
                    className="text-[10px] cursor-pointer hover:bg-muted px-1.5 py-0"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertVariable(v.variable);
                    }}
                  >
                    {v.variable}
                  </Badge>
                ))}
                {VARIABLE_OPTIONS.length > 8 && (
                  <span className="text-[10px] text-muted-foreground self-center">
                    +{VARIABLE_OPTIONS.length - 8} more
                  </span>
                )}
              </div>
            </>
          )}

          {validating && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Validating {processedCount} of {progress?.total ?? 0} leads
                </span>
                <span className="flex items-center gap-3 tabular-nums">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-500" />
                    {progress?.completed ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="size-3 text-red-500" />
                    {progress?.failed ?? 0}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    {progress?.pending ?? 0}
                  </span>
                </span>
              </div>

              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${progress?.total ? (processedCount / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>

              {activity.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border bg-muted/20 p-2">
                  {activity.map((item) => (
                    <div key={item.leadId} className="flex items-center gap-2 text-xs">
                      {item.status === "success" ? (
                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="size-3.5 text-red-500 shrink-0" />
                      )}
                      <span className="font-medium truncate">{item.company}</span>
                      {item.status === "success" ? (
                        item.matchedVertical ? (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">{item.matchedVertical}</Badge>
                        ) : (
                          <span className="text-muted-foreground">No match</span>
                        )
                      ) : (
                        <span className="text-red-600 dark:text-red-400 truncate">
                          Failed{item.error ? ` — ${item.error}` : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {runStats && !validating && (
            <RunSummary stats={runStats} model={model} />
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={validating}
            >
              {runStats && !validating ? "Close" : "Cancel"}
            </Button>
            {!runStats && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={totalCount === 0 || validating || loading}
                  onClick={() => runValidation(true)}
                >
                  Validate All ({totalCount})
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={selectedIds.length === 0 || validating || loading}
                  onClick={() => runValidation(false)}
                >
                  {validating ? (
                    <>
                      <Brain className="size-3.5 animate-pulse" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Brain className="size-3.5" />
                      Validate Selected ({selectedIds.length})
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RunSummary({ stats, model }: { stats: RunStats; model: string }) {
  const rows = [
    ["Leads requested", String(stats.leadsRequested)],
    ["Leads processed", String(stats.leadsProcessed)],
    ["Successful", String(stats.successful)],
    ["Failed", String(stats.failed)],
    ["ICP matched", String(stats.matched)],
    ["ICP not matched", String(stats.noMatch)],
    ["API requests", String(stats.apiRequests)],
    ["Input tokens", formatTokens(stats.inputTokens)],
    ["Cached input tokens", formatTokens(stats.cachedInputTokens)],
    ["Output tokens", formatTokens(stats.outputTokens)],
    ["Total tokens", formatTokens(stats.totalTokens)],
    ["Total cost", formatCost(stats.totalCost)],
    ["Duration", formatDuration(stats.totalDurationMs)],
    ["Model", model],
  ];

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <ChevronRight className="size-4 text-muted-foreground" />
        Run summary
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-xs border-b border-border/50 py-0.5">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
