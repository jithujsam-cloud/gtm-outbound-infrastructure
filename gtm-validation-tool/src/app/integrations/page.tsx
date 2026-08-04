"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Database, Link, Key, Shield, CheckCircle, ExternalLink,
  Brain, Mail,
} from "lucide-react";
import { getLocalConfig, saveLocalConfig, clearLocalConfig } from "@/lib/supabase/config";

export default function IntegrationsPage() {
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [supabaseServiceRoleKey, setSupabaseServiceRoleKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [clearoutApiKey, setClearoutApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [supabaseSaved, setSupabaseSaved] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [clearoutSaved, setClearoutSaved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const config = getLocalConfig();
    if (config.supabaseUrl) {
      setSupabaseUrl(config.supabaseUrl);
      setSupabaseAnonKey(config.supabaseAnonKey);
      setSupabaseServiceRoleKey(config.supabaseServiceRoleKey);
      setSupabaseSaved(!!config.supabaseUrl && !!config.supabaseAnonKey);
    }
    if (config.geminiApiKey) {
      setGeminiApiKey(config.geminiApiKey);
      setGeminiSaved(true);
    }
    if (config.clearoutApiKey) {
      setClearoutApiKey(config.clearoutApiKey);
      setClearoutSaved(true);
    }
  }, []);

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();

    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      toast.error("Supabase URL and Anon Key are required");
      return;
    }

    setSaving(true);
    try {
      saveLocalConfig({
        supabaseUrl: supabaseUrl.trim(),
        supabaseAnonKey: supabaseAnonKey.trim(),
        supabaseServiceRoleKey: supabaseServiceRoleKey.trim(),
        geminiApiKey: geminiApiKey.trim(),
        clearoutApiKey: clearoutApiKey.trim(),
      });

      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabaseUrl: supabaseUrl.trim(),
          supabaseAnonKey: supabaseAnonKey.trim(),
          supabaseServiceRoleKey: supabaseServiceRoleKey.trim(),
          geminiApiKey: geminiApiKey.trim(),
          clearoutApiKey: clearoutApiKey.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      setSupabaseSaved(true);
      setGeminiSaved(!!geminiApiKey.trim());
      setClearoutSaved(!!clearoutApiKey.trim());
      toast.success("All integrations saved");
      router.refresh();
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  function handleClearAll() {
    clearLocalConfig();
    fetch("/api/integrations", { method: "DELETE" });
    setSupabaseUrl("");
    setSupabaseAnonKey("");
    setSupabaseServiceRoleKey("");
    setGeminiApiKey("");
    setClearoutApiKey("");
    setSupabaseSaved(false);
    setGeminiSaved(false);
    setClearoutSaved(false);
    toast.success("All integration data cleared");
    router.refresh();
  }

  const hasSupabase = supabaseSaved;
  const hasGemini = geminiSaved;
  const hasClearout = clearoutSaved;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your services to power the validation pipeline.
        </p>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Supabase */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-emerald-500/10">
                <Database className="size-4 text-emerald-500" />
              </div>
              <div>
                <CardTitle>Supabase</CardTitle>
                <CardDescription>PostgreSQL database and API for lead storage</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasSupabase && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle className="size-4" />
                Connected
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="supabase-url" className="flex items-center gap-1.5">
                <Link className="size-3.5" />
                Project URL
              </Label>
              <Input
                id="supabase-url"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
              />
              <p className="text-xs text-muted-foreground">
                Found in Supabase Project Settings → API.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supabase-anon-key" className="flex items-center gap-1.5">
                <Key className="size-3.5" />
                Anon Key
              </Label>
              <Input
                id="supabase-anon-key"
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
              />
              <p className="text-xs text-muted-foreground">
                The <code>anon</code> public key. Safe to expose in the browser.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supabase-service-key" className="flex items-center gap-1.5">
                <Shield className="size-3.5" />
                Service Role Key <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="supabase-service-key"
                value={supabaseServiceRoleKey}
                onChange={(e) => setSupabaseServiceRoleKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                The <code>service_role</code> key for admin operations. Never exposed to the browser.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Gemini */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-blue-500/10">
                <Brain className="size-4 text-blue-500" />
              </div>
              <div>
                <CardTitle>Google Gemini</CardTitle>
                <CardDescription>AI-powered ICP vertical matching and email scoring</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasGemini && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle className="size-4" />
                Connected
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="gemini-api-key" className="flex items-center gap-1.5">
                <Key className="size-3.5" />
                API Key
              </Label>
              <Input
                id="gemini-api-key"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIza..."
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Google AI Studio
                  <ExternalLink className="inline size-3 ml-0.5" />
                </a>
                . Required for ICP vertical classification and email scoring.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Clearout */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-purple-500/10">
                <Mail className="size-4 text-purple-500" />
              </div>
              <div>
                <CardTitle>Clearout</CardTitle>
                <CardDescription>Email deliverability verification and SMTP validation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasClearout && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle className="size-4" />
                Connected
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="clearout-api-key" className="flex items-center gap-1.5">
                <Key className="size-3.5" />
                API Key
              </Label>
              <Input
                id="clearout-api-key"
                value={clearoutApiKey}
                onChange={(e) => setClearoutApiKey(e.target.value)}
                placeholder="Clearout API key"
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a
                  href="https://app.clearout.io/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Clearout Dashboard
                  <ExternalLink className="inline size-3 ml-0.5" />
                </a>
                . Required for email deliverability checks.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          {(hasSupabase || hasGemini || hasClearout) && (
            <Button type="button" variant="outline" onClick={handleClearAll}>
              Clear All
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </form>
    </div>
  );
}
