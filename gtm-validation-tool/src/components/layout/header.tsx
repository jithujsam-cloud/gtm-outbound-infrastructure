"use client";

import Link from "next/link";
import { LayoutDashboard, FolderOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/components/providers/supabase-provider";
import { logout } from "@/app/auth/actions";

export function Header() {
  const { user } = useSupabase();

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

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{user?.email}</span>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="size-4" />
              Logout
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
