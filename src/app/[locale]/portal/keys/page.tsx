"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ApiKey {
  id: number;
  name: string;
  key: string;
  isEnabled: boolean | null;
  expiresAt: string | null;
  createdAt: string | null;
}

interface NewKeyResult {
  id: number;
  name: string;
  key: string;
  createdAt: string | null;
}

export default function PortalKeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<NewKeyResult | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadKeys() {
    try {
      const res = await fetch("/api/v1/portal/keys");
      if (res.status === 401) {
        router.push("/portal/login");
        return;
      }
      const data = (await res.json()) as { ok: boolean; data?: ApiKey[] };
      if (data.ok && data.data) {
        setKeys(data.data);
      }
    } catch {
      setError("Failed to load keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadKeys();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    setNewKeyResult(null);

    try {
      const res = await fetch("/api/v1/portal/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string; data?: NewKeyResult };

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to create key");
        return;
      }

      setNewKeyResult(data.data ?? null);
      setNewKeyName("");
      await loadKeys();
    } catch {
      setError("Network error, please try again");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/portal/keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      }
    } catch {
      setError("Failed to delete key");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/portal-login", { method: "DELETE" });
    router.push("/portal/login");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">My API Keys</h1>
        <div className="flex items-center gap-3">
          <a href="/portal/usage" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
            Usage logs
          </a>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </div>

      {newKeyResult && (
        <Card className="border-green-600/30 bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-base">Key created</CardTitle>
            <CardDescription>Copy this key — it won&apos;t be shown again.</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block rounded bg-muted px-3 py-2 text-sm font-mono break-all select-all">
              {newKeyResult.key}
            </code>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. my-laptop"
                disabled={creating}
              />
            </div>
            <Button type="submit" disabled={creating || !newKeyName.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading keys...</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No keys yet. Create one above.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <Card key={key.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{key.key}</p>
                  {key.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(key.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleDelete(key.id)}
                  disabled={deletingId === key.id}
                >
                  {deletingId === key.id ? "Deleting..." : "Delete"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
