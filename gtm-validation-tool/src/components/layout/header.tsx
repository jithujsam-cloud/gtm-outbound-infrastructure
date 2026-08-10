"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSupabase } from "@/components/providers/supabase-provider";
import { logout } from "@/app/auth/actions";

const links = ["Dashboard", "Projects", "Integrations", "Logs"];

export function Header() {
  const pathname = usePathname();
  const { user } = useSupabase();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-xl">
      <div className="flex h-14 sm:h-16 items-center justify-between px-4 sm:px-8 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0 group">
          <div className="flex size-7 sm:size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-500/20">
            <span className="text-[10px] sm:text-xs font-bold tracking-tight">GT</span>
          </div>
          <span className="font-semibold text-sm sm:text-base tracking-tight text-neutral-900">
            GTM Validate
          </span>
        </Link>

        {/* Desktop nav pill */}
        <nav className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 bg-neutral-100/80 rounded-full p-1 backdrop-blur">
          {links.map((label) => {
            const href = label === "Dashboard" ? "/" : `/${label.toLowerCase()}`;
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={label}
                href={href}
                className={cn(
                  "relative px-4 sm:px-5 py-1.5 text-sm font-medium rounded-full transition-colors duration-150",
                  active
                    ? "text-white"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                {active && (
                  <span className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 shadow-sm shadow-violet-500/25" />
                )}
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-md hover:bg-neutral-100 transition-colors"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          {user ? (
            <>
              <span className="text-xs text-neutral-400 hidden sm:inline-block">
                {user.email}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile user actions */}
        <div className="flex sm:hidden items-center gap-1">
          {user && (
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-600 transition-colors p-1"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          )}
          {!user && (
            <Link
              href="/auth/login"
              className="text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {menuOpen && (
        <div className="sm:hidden border-t bg-white px-4 py-3 space-y-1">
          {links.map((label) => {
            const href = label === "Dashboard" ? "/" : `/${label.toLowerCase()}`;
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={label}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-violet-50 text-violet-700"
                    : "text-neutral-600 hover:bg-neutral-50"
                )}
              >
                {label}
              </Link>
            );
          })}
          {user && (
            <div className="px-3 py-2 text-xs text-neutral-400 border-t pt-2 mt-1">
              {user.email}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
