"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Database, Link, Key, Shield } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [supabaseServiceRoleKey, setSupabaseServiceRoleKey] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      toast.error("Project URL and Anon Key are required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabaseUrl: supabaseUrl.trim(),
          supabaseAnonKey: supabaseAnonKey.trim(),
          supabaseServiceRoleKey: supabaseServiceRoleKey.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      toast.success("Connected to Supabase");
      router.push("/auth/login");
      router.refresh();
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-violet-50">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 mb-4">
            <span className="text-lg font-bold">GT</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Welcome to GTM Validate</h1>
          <p className="text-sm text-neutral-500 mt-2">
            Connect your Supabase project to get started.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Database className="size-4 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-base">Connect Supabase</CardTitle>
                <CardDescription>
                  Enter your project credentials from the Supabase dashboard.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supabase-url" className="flex items-center gap-1.5 text-xs">
                  <Link className="size-3" /> Project URL
                </Label>
                <Input
                  id="supabase-url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supabase-anon-key" className="flex items-center gap-1.5 text-xs">
                  <Key className="size-3" /> Anon Key
                </Label>
                <Input
                  id="supabase-anon-key"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supabase-service-key" className="flex items-center gap-1.5 text-xs">
                  <Shield className="size-3" /> Service Role Key
                </Label>
                <Input
                  id="supabase-service-key"
                  value={supabaseServiceRoleKey}
                  onChange={(e) => setSupabaseServiceRoleKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  className="h-9 text-sm"
                  type="password"
                />
                <p className="text-[11px] text-neutral-400">
                  Found in Project Settings → API in your Supabase dashboard.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Connecting..." : "Connect & Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-neutral-400 mt-6">
          Your credentials are stored securely in your browser and never sent to our servers.
        </p>
      </div>
    </div>
  );
}
