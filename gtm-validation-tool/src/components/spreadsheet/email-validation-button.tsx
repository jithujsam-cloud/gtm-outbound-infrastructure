"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function EmailValidationButton({ projectId, variant }: { projectId: string; variant?: "button" | "dropdown" }) {
  const [open, setOpen] = useState(false);

  if (variant === "dropdown") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors text-left hover:bg-muted"
        >
          <Mail className="size-3.5" />
          Email Validation
        </button>
        <EmailDialog open={open} onOpenChange={setOpen} projectId={projectId} />
      </>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setOpen(true)}>
        <Mail className="size-3.5" />
        Email Validation
      </Button>
      <EmailDialog open={open} onOpenChange={setOpen} projectId={projectId} />
    </>
  );
}

function EmailDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (v: boolean) => void; projectId: string }) {
  const [delayMs, setDelayMs] = useState(2000);
  const [startIndex, setStartIndex] = useState("");
  const [endIndex, setEndIndex] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Email Validation</DialogTitle>
          <DialogDescription>
            Configure email verification parameters. Emails are validated one at a time with a delay between each.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Delay between emails
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={500}
                step={500}
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                className="w-28 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <span className="text-sm text-muted-foreground">milliseconds</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Recommended: 2000ms (2 seconds) to avoid rate limits.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Lead range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                placeholder="From"
                value={startIndex}
                onChange={(e) => setStartIndex(e.target.value)}
                className="w-24 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                type="number"
                min={1}
                placeholder="To"
                value={endIndex}
                onChange={(e) => setEndIndex(e.target.value)}
                className="w-24 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty to process all leads.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)}>
              <Mail className="size-3.5" />
              Start Validation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
