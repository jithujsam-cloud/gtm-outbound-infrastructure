"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

interface SupabaseContextValue {
  supabase: SupabaseClient<Database>;
  user: User | null;
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<SupabaseContextValue | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setValue({ supabase, user: data.user });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setValue((prev) => prev ? { ...prev, user: session?.user ?? null } : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!value) {
    return null;
  }

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error("useSupabase must be used within SupabaseProvider");
  }
  return ctx;
}
