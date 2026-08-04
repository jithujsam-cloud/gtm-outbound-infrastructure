"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

const SupabaseContext = createContext<SupabaseClient<Database> | null>(null);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null);

  useEffect(() => {
    const client = createClient();
    setSupabase(client);
  }, []);

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const client = useContext(SupabaseContext);
  if (!client) {
    throw new Error(
      "useSupabase must be used within SupabaseProvider and Supabase must be configured. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  return client;
}
