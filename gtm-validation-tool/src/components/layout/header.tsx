import Link from "next/link";
import { LayoutDashboard, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-14 items-center px-4 gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-sm">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-xs font-bold">GT</span>
          </div>
          GTM Validate
        </Link>
        <nav className="flex items-center gap-1 ml-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/projects">
              <FolderOpen className="size-4" />
              Projects
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
