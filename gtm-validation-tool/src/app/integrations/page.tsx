"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Key, Brain, Mail, CheckCircle, ExternalLink, Database } from "lucide-react";
import { loadSettings, saveSettings } from "@/app/settings/actions";

export default function IntegrationsPage() {
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [clearoutApiKey, setClearoutApiKey] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [supabaseServiceRoleKey, setSupabaseServiceRoleKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings().then((r) => {
      if (r.settings) {
        if (r.settings.gemini_api_key) setGeminiApiKey(r.settings.gemini_api_key);
        if (r.settings.clearout_api_key) setClearoutApiKey(r.settings.clearout_api_key);
        if (r.settings.supabase_url) setSupabaseUrl(r.settings.supabase_url);
        if (r.settings.supabase_anon_key) setSupabaseAnonKey(r.settings.supabase_anon_key);
        if (r.settings.supabase_service_role_key) setSupabaseServiceRoleKey(r.settings.supabase_service_role_key);
      }
      setLoaded(true);
    });
  }, []);

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      if (geminiApiKey.trim()) formData.set("gemini_api_key", geminiApiKey.trim());
      if (clearoutApiKey.trim()) formData.set("clearout_api_key", clearoutApiKey.trim());
      if (supabaseUrl.trim()) formData.set("supabase_url", supabaseUrl.trim());
      if (supabaseAnonKey.trim()) formData.set("supabase_anon_key", supabaseAnonKey.trim());
      if (supabaseServiceRoleKey.trim()) formData.set("supabase_service_role_key", supabaseServiceRoleKey.trim());

      const result = await saveSettings(formData);
      if (result?.error) throw new Error(result.error);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect external APIs to power the validation pipeline.
        </p>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Database className="size-4 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-base">Supabase</CardTitle>
                <CardDescription>Your per-user Supabase project credentials</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supabase-url" className="text-xs">Project URL</Label>
              <Input id="supabase-url" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} placeholder="https://your-project.supabase.co" className="h-9 text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supabase-anon-key" className="text-xs">Anon Key</Label>
              <Input id="supabase-anon-key" value={supabaseAnonKey} onChange={(e) => setSupabaseAnonKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIs..." className="h-9 text-sm" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supabase-service-key" className="text-xs">Service Role Key</Label>
              <Input id="supabase-service-key" value={supabaseServiceRoleKey} onChange={(e) => setSupabaseServiceRoleKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIs..." className="h-9 text-sm" type="password" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10">
                <Brain className="size-4 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">Google Gemini</CardTitle>
                <CardDescription>AI-powered ICP vertical matching and email scoring</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {geminiApiKey && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle className="size-4" />
                Connected
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="gemini-api-key" className="flex items-center gap-1.5">
                <Key className="size-3.5" />
                API Key
              </Label>
              <Input id="gemini-api-key" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} placeholder="AIza..." type="password" />
              <p className="text-xs text-muted-foreground">
                Get your key from{" "}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Google AI Studio
                  <ExternalLink className="inline size-3 ml-0.5" />
                </a>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10">
                <Mail className="size-4 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-base">Clearout</CardTitle>
                <CardDescription>Email deliverability verification and SMTP validation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {clearoutApiKey && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle className="size-4" />
                Connected
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="clearout-api-key" className="flex items-center gap-1.5">
                <Key className="size-3.5" />
                API Key
              </Label>
              <Input id="clearout-api-key" value={clearoutApiKey} onChange={(e) => setClearoutApiKey(e.target.value)} placeholder="Clearout API key" type="password" />
              <p className="text-xs text-muted-foreground">
                Get your key from{" "}
                <a href="https://app.clearout.io/settings/api" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Clearout Dashboard
                  <ExternalLink className="inline size-3 ml-0.5" />
                </a>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
