import { type NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/auth/account-auth";
import { findAccountById } from "@/repository/account";
import { findKeyList } from "@/repository/key";
import { findUsageLogsForKeySlim } from "@/repository/usage-logs";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await findAccountById(session.accountId);
  if (!account?.linkedUserId) {
    return NextResponse.json({ error: "No user account linked" }, { status: 404 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const modelFilter = url.searchParams.get("model") ?? undefined;

  // Get all keys for this user, use the first (most recently created) key
  const keys = await findKeyList(account.linkedUserId);
  if (keys.length === 0) {
    return NextResponse.json({ ok: true, data: [], page, limit, total: 0 });
  }

  const primaryKey = keys[0];
  if (!primaryKey) {
    return NextResponse.json({ ok: true, data: [], page, limit, total: 0 });
  }

  // findUsageLogsForKeySlim requires the raw key string for scoping
  const result = await findUsageLogsForKeySlim({
    keyString: primaryKey.key,
    model: modelFilter,
    page,
    pageSize: limit,
  });

  return NextResponse.json({
    ok: true,
    data: result.logs.map((log) => ({
      id: log.id,
      model: log.model,
      inputTokens: log.inputTokens,
      outputTokens: log.outputTokens,
      costUsd: log.costUsd,
      statusCode: log.statusCode,
      durationMs: log.durationMs,
      createdAt: log.createdAt,
    })),
    page,
    limit,
    total: result.total,
  });
}
