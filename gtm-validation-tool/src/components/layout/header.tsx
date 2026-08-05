"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderOpen, Cable, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/components/providers/supabase-provider";
import { logout } from "@/app/auth/actions";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/integrations", label: "Integrations", icon: Cable },
];

export function Header() {
  const pathname = usePathname();
  const { user } = useSupabase();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
            <span className="text-[11px] font-bold tracking-tight">GT</span>
          </div>
          <span className="font-semibold text-sm tracking-tight">GTM Validate</span>
        </Link>

        <Separator />

        <nav className="flex items-center gap-0.5">
          {links.map(({ href, label, icon: Icon }) => (
            <Button
              key={href}
              variant="ghost"
              size="sm"
              className={cn(
                "font-normal text-muted-foreground",
                pathname === href && "bg-accent text-accent-foreground font-medium"
              )}
              asChild
            >
              <Link href={href}>
                <Icon className="size-4" />
                {label}
              </Link>
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {user && (
            <>
              <span className="text-xs text-muted-foreground hidden sm:inline-block">
                {user.email}
              </span>
              <form action={logout}>
                <Button variant="ghost" size="sm" type="submit">
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Separator() {
  return (
    <div className="mx-4 h-5 w-px bg-border shrink-0" />
  );
}
