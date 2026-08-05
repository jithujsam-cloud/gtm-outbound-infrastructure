"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ICPValidationButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  return (
    <>
      <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
        <Brain className="size-3.5" />
        ICP Validation
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
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
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={!prompt.trim()} onClick={() => setOpen(false)}>
                <Brain className="size-3.5" />
                Run ICP Validation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
