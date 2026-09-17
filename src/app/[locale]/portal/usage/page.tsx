"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UsageLog {
  id: number;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: string | null;
  statusCode: number | null;
  durationMs: number | null;
  createdAt: string | null;
}

interface UsageResponse {
  ok: boolean;
  data: UsageLog[];
  page: number;
  limit: number;
  total: number;
}

export default function PortalUsagePage() {
  const router = useRouter();
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  useEffect(() => {
    void loadUsage(page);
  }, [page]);

  async function loadUsage(p: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/portal/usage?page=${p}&limit=${limit}`);
      if (res.status === 401) {
        router.push("/portal/login");
        return;
      }
      const data = (await res.json()) as UsageResponse;
      if (data.ok) {
        setLogs(data.data);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Usage Logs</h1>
        <a href="/portal/keys" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
          Back to keys
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {total > 0 ? `${total} requests total` : "No requests yet"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              No usage logs found. Make a request using one of your API keys.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Time</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Model</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground tabular-nums">In tokens</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground tabular-nums">Out tokens</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground tabular-nums">Cost</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground tabular-nums">Status</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground tabular-nums">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2 text-muted-foreground text-xs tabular-nums">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{log.model ?? "-"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{log.inputTokens ?? "-"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{log.outputTokens ?? "-"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {log.costUsd != null ? `$${Number(log.costUsd).toFixed(6)}` : "-"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        <span
                          className={
                            log.statusCode === 200
                              ? "text-green-600 dark:text-green-400"
                              : "text-destructive"
                          }
                        >
                          {log.statusCode ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {log.durationMs != null ? `${log.durationMs}ms` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="rounded px-3 py-1.5 border hover:bg-muted disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="rounded px-3 py-1.5 border hover:bg-muted disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
