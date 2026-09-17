"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CcSwitchProvider {
  importId: string;
  name: string;
  appType: string;
  providerType: string;
  url: string;
  alreadyImported: boolean;
}

interface DryRunResponse {
  ok: boolean;
  total: number;
  already_imported: number;
  pending: number;
  providers: CcSwitchProvider[];
  error?: string;
}

interface ImportResponse {
  ok: boolean;
  imported: number;
  failed: number;
  results: { name: string; success: boolean; error?: string }[];
  error?: string;
}

export default function CcSwitchImportClient() {
  const [data, setData] = useState<DryRunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState("");

  async function loadDryRun() {
    setLoading(true);
    setError("");
    setImportResult(null);
    try {
      const res = await fetch("/api/v1/admin/import/cc-switch?dry_run=true");
      const json = (await res.json()) as DryRunResponse;
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to load cc-switch providers");
        return;
      }
      setData(json);
      // Pre-select all pending (not yet imported)
      const pending = json.providers.filter((p) => !p.alreadyImported).map((p) => p.importId);
      setSelected(new Set(pending));
    } catch {
      setError("Network error, please try again");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDryRun();
  }, []);

  function toggleAll(checked: boolean) {
    if (!data) return;
    if (checked) {
      setSelected(new Set(data.providers.filter((p) => !p.alreadyImported).map((p) => p.importId)));
    } else {
      setSelected(new Set());
    }
  }

  function toggleOne(importId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(importId);
      else next.delete(importId);
      return next;
    });
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setError("");
    setImportResult(null);
    try {
      const res = await fetch("/api/v1/admin/import/cc-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importIds: Array.from(selected) }),
      });
      const json = (await res.json()) as ImportResponse;
      setImportResult(json);
      if (json.ok) {
        await loadDryRun();
      }
    } catch {
      setError("Network error, please try again");
    } finally {
      setImporting(false);
    }
  }

  const pendingProviders = data?.providers.filter((p) => !p.alreadyImported) ?? [];
  const importedProviders = data?.providers.filter((p) => p.alreadyImported) ?? [];

  return (
    <div className="space-y-6">
      {importResult && (
        <Card
          className={
            importResult.failed === 0 ? "border-green-600/30 bg-green-500/5" : "border-destructive/30"
          }
        >
          <CardHeader>
            <CardTitle className="text-base">
              {importResult.failed === 0
                ? `Imported ${importResult.imported} provider${importResult.imported !== 1 ? "s" : ""}`
                : `${importResult.imported} imported, ${importResult.failed} failed`}
            </CardTitle>
          </CardHeader>
          {importResult.results.some((r) => !r.success) && (
            <CardContent>
              <ul className="space-y-1 text-sm text-destructive">
                {importResult.results
                  .filter((r) => !r.success)
                  .map((r) => (
                    <li key={r.name}>
                      {r.name}: {r.error}
                    </li>
                  ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={loadDryRun} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total} providers found · {data.already_imported} already imported · {data.pending} pending
          </span>
        )}
      </div>

      {pendingProviders.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Pending import</CardTitle>
                <CardDescription>
                  {pendingProviders.length} provider{pendingProviders.length !== 1 ? "s" : ""} not yet imported
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={
                      pendingProviders.length > 0 &&
                      pendingProviders.every((p) => selected.has(p.importId))
                    }
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                  <Label htmlFor="select-all" className="text-sm cursor-pointer">
                    Select all
                  </Label>
                </div>
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={importing || selected.size === 0}
                >
                  <Download className="h-4 w-4" />
                  {importing ? "Importing..." : `Import ${selected.size}`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="w-10 px-4 py-2" />
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">URL</th>
                </tr>
              </thead>
              <tbody>
                {pendingProviders.map((p) => (
                  <tr key={p.importId} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2">
                      <Checkbox
                        checked={selected.has(p.importId)}
                        onCheckedChange={(v) => toggleOne(p.importId, !!v)}
                      />
                    </td>
                    <td className="px-4 py-2 font-medium">{p.name}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono">
                        {p.providerType}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground hidden sm:table-cell truncate max-w-xs">
                      {p.url}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {importedProviders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              Already imported ({importedProviders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {importedProviders.map((p) => (
                  <tr key={p.importId} className="border-b last:border-0 opacity-50">
                    <td className="px-4 py-2 font-medium">{p.name}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono">
                        {p.providerType}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground hidden sm:table-cell truncate max-w-xs">
                      {p.url}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {!loading && data && data.total === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No providers found in the cc-switch database.
            <br />
            Make sure <code className="font-mono">CC_SWITCH_DB_PATH</code> is set correctly (default:{" "}
            <code className="font-mono">~/.cc-switch/cc-switch.db</code>).
          </CardContent>
        </Card>
      )}
    </div>
  );
}
