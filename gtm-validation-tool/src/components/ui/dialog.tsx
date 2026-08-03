import * as React from "react"
import { cn } from "@/lib/utils"

function Dialog({ ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-trigger" {...props} />
}

function DialogContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-content"
      className={cn(
        "bg-background max-w-lg rounded-lg border p-6 shadow-lg",
        className
      )}
      {...props}
    />
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription }
