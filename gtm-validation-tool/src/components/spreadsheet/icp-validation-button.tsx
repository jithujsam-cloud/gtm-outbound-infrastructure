"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { VARIABLE_OPTIONS } from "@/lib/validation/variables";
import { getIcpPrompt } from "@/app/settings/actions";
import { toast } from "sonner";

export interface IcpValidationDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  totalCount: number;
  onValidationComplete: () => void;
  fetchAllIds: () => Promise<string[]>;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredVariables = VARIABLE_OPTIONS.filter(
    (v) =>
      v.variable.toLowerCase().includes(variableFilter.toLowerCase()) ||
      v.label.toLowerCase().includes(variableFilter.toLowerCase())
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    getIcpPrompt(projectId)
      .then((result) => {
        if (!cancelled && result.prompt) {
          setPrompt(result.prompt);
        }
      })
      .finally(() => {
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

  const runValidation = async (all: boolean) => {
    let ids: string[];
    if (all) {
      ids = await fetchAllIds();
    } else {
      ids = selectedIds;
    }
    if (ids.length === 0) return;

    setValidating(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/validate/icp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds: ids, prompt }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try {
          msg = JSON.parse(text).error || text;
        } catch {}
        throw new Error(msg);
      }

      const json = await res.json();
      toast.success(
        `ICP done — ${json.processed ?? ids.length} processed, ${json.matched ?? 0} matched` +
          (json.errors?.length ? ` (${json.errors.length} failed)` : "")
      );
      onValidationComplete();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`ICP validation failed: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  const validateCount = selectedIds.length > 0 ? selectedIds.length : totalCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>ICP Validation</DialogTitle>
          <DialogDescription>
            {selectedIds.length > 0
              ? `${selectedIds.length} lead${selectedIds.length !== 1 ? "s" : ""} selected`
              : `${totalCount} leads in project`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {loading ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Loading prompt...
            </div>
          ) : (
            <>
              <div className="space-y-2 relative">
                <label className="text-sm font-medium">Prompt</label>
                <textarea
                  ref={textareaRef}
                  className="w-full min-h-[200px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-mono"
                  value={prompt}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  disabled={validating}
                />

                {showVariables && filteredVariables.length > 0 && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border bg-popover p-1 shadow-md max-h-48 overflow-y-auto">
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

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={validating}
            >
              Cancel
            </Button>
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
