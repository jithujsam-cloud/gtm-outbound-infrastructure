"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Key, Brain, Mail, CheckCircle, ExternalLink, Database } from "lucide-react";
import { getLocalConfig, saveLocalConfig, clearLocalConfig } from "@/lib/supabase/config";

export default function IntegrationsPage() {
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [clearoutApiKey, setClearoutApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [clearoutSaved, setClearoutSaved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const config = getLocalConfig();
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
    setSaving(true);
    try {
      saveLocalConfig({
        geminiApiKey: geminiApiKey.trim(),
        clearoutApiKey: clearoutApiKey.trim(),
      });

      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geminiApiKey: geminiApiKey.trim(),
          clearoutApiKey: clearoutApiKey.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      setGeminiSaved(!!geminiApiKey.trim());
      setClearoutSaved(!!clearoutApiKey.trim());
      toast.success("API keys saved");
      router.refresh();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleClearAll() {
    clearLocalConfig();
    fetch("/api/integrations", { method: "DELETE" });
    setGeminiApiKey("");
    setClearoutApiKey("");
    setGeminiSaved(false);
    setClearoutSaved(false);
    toast.success("All API keys cleared");
    router.refresh();
  }

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
                <CardDescription>Database configured during initial setup</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-emerald-700">
              Connected and ready. To change your Supabase project, visit{" "}
              <a href="/auth/setup" className="underline font-medium">
                Setup
              </a>
              .
            </p>
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
            {geminiSaved && (
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
              <Input
                id="gemini-api-key"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIza..."
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                Get your key from{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
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
            {clearoutSaved && (
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
              <Input
                id="clearout-api-key"
                value={clearoutApiKey}
                onChange={(e) => setClearoutApiKey(e.target.value)}
                placeholder="Clearout API key"
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                Get your key from{" "}
                <a
                  href="https://app.clearout.io/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Clearout Dashboard
                  <ExternalLink className="inline size-3 ml-0.5" />
                </a>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          {(geminiSaved || clearoutSaved) && (
            <Button type="button" variant="outline" onClick={handleClearAll}>
              Clear All
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save API Keys"}
          </Button>
        </div>
      </form>
    </div>
  );
}
