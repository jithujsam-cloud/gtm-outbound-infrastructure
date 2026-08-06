"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ICPValidationButton({ projectId, variant }: { projectId: string; variant?: "button" | "dropdown" }) {
  const [open, setOpen] = useState(false);

  if (variant === "dropdown") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors text-left hover:bg-muted"
        >
          <Brain className="size-3.5" />
          ICP Validation
        </button>
        <ICPDialog open={open} onOpenChange={setOpen} projectId={projectId} />
      </>
    );
  }

  return (
    <>
      <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
        <Brain className="size-3.5" />
        ICP Validation
      </Button>
      <ICPDialog open={open} onOpenChange={setOpen} projectId={projectId} />
    </>
  );
}

function ICPDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (v: boolean) => void; projectId: string }) {
  const [prompt, setPrompt] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>ICP Validation</DialogTitle>
          <DialogDescription>
            Provide a prompt to run against each lead. Processing runs in batches of 2 at a time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Prompt</label>
            <textarea
              className="w-full min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              placeholder="Analyze this lead and determine if they match our ICP for D2C e-commerce companies. Consider industry, company size, and role…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Runs in batches of 2 records at a time until all leads are processed.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!prompt.trim()} onClick={() => onOpenChange(false)}>
              <Brain className="size-3.5" />
              Run ICP Validation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
