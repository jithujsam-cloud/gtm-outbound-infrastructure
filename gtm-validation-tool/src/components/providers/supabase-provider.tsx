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
  if (client === null) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  return client;
}
