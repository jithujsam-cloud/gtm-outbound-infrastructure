"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Database, Link, Key, Shield, CheckCircle, ExternalLink } from "lucide-react";
import type { SupabaseConfig } from "@/lib/supabase/config";
import { getLocalConfig, saveLocalConfig, clearLocalConfig } from "@/lib/supabase/config";

export default function IntegrationsPage() {
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [serviceRoleKey, setServiceRoleKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const existing = getLocalConfig();
    if (existing) {
      setUrl(existing.url);
      setAnonKey(existing.anonKey);
      setServiceRoleKey(existing.serviceRoleKey);
      setSaved(true);
    }
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      toast.error("Supabase URL and Anon Key are required");
      return;
    }

    setSaving(true);
    const config: SupabaseConfig = {
      url: url.trim(),
      anonKey: anonKey.trim(),
      serviceRoleKey: serviceRoleKey.trim(),
    };

    try {
      saveLocalConfig(config);

      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error("Failed to save to cookies");

      toast.success("Supabase configured successfully");
      setSaved(true);
      router.refresh();
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    clearLocalConfig();
    fetch("/api/integrations", { method: "DELETE" });
    setUrl("");
    setAnonKey("");
    setServiceRoleKey("");
    setSaved(false);
    toast.success("Configuration cleared");
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your Supabase project to power the validation pipeline.
        </p>
      </div>

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
        <CardContent>
          {saved && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 mb-4">
              <CheckCircle className="size-4" />
              Connected
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supabase-url" className="flex items-center gap-1.5">
                <Link className="size-3.5" />
                Project URL
              </Label>
              <Input
                id="supabase-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
              />
              <p className="text-xs text-muted-foreground">
                Your Supabase project URL. Found in Project Settings → API.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supabase-anon-key" className="flex items-center gap-1.5">
                <Key className="size-3.5" />
                Anon Key
              </Label>
              <Input
                id="supabase-anon-key"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
              />
              <p className="text-xs text-muted-foreground">
                The <code>anon</code> public key from Project Settings → API. Safe to expose in the browser.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supabase-service-key" className="flex items-center gap-1.5">
                <Shield className="size-3.5" />
                Service Role Key <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="supabase-service-key"
                value={serviceRoleKey}
                onChange={(e) => setServiceRoleKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                The <code>service_role</code> key for admin API operations. Never exposed to the browser.
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <a
                href="https://supabase.com/dashboard/project/_/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Find your keys in Supabase Dashboard
                <ExternalLink className="size-3" />
              </a>
              <div className="flex gap-2">
                {saved && (
                  <Button type="button" variant="outline" onClick={handleClear}>
                    Disconnect
                  </Button>
                )}
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : saved ? "Update" : "Connect"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
