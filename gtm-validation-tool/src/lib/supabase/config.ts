const STORAGE_KEY = "gtm_supabase_config";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export function getLocalConfig(): SupabaseConfig | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SupabaseConfig;
  } catch {
    return null;
  }
}

export function saveLocalConfig(config: SupabaseConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearLocalConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getCookieName(key: string): string {
  return `gtm_supabase_${key}`;
}
