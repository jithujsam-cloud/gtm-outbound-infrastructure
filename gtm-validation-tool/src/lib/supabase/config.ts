const STORAGE_KEY = "gtm_config";

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  geminiApiKey: string;
  clearoutApiKey: string;
}

const DEFAULTS: AppConfig = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseServiceRoleKey: "",
  geminiApiKey: "",
  clearoutApiKey: "",
};

export function getLocalConfig(): AppConfig {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveLocalConfig(config: Partial<AppConfig>): void {
  if (typeof window === "undefined") return;
  const existing = getLocalConfig();
  const merged = { ...existing, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

export function clearLocalConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export const COOKIE_MAP = {
  supabase_url: "gtm_supabase_url",
  supabase_anon_key: "gtm_supabase_anon_key",
  supabase_service_role_key: "gtm_supabase_service_role_key",
  gemini_api_key: "gtm_gemini_api_key",
  clearout_api_key: "gtm_clearout_api_key",
} as const;
