import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getPortalSession } from "@/lib/auth/account-auth";
import { logger } from "@/lib/logger";
import { findAccountById } from "@/repository/account";
import { createKey, findKeyList } from "@/repository/key";

export const runtime = "nodejs";

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await findAccountById(session.accountId);
  if (!account?.linkedUserId) {
    return NextResponse.json({ error: "No user account linked" }, { status: 404 });
  }

  const keys = await findKeyList(account.linkedUserId);

  return NextResponse.json({
    ok: true,
    data: keys.map((k) => ({
      id: k.id,
      name: k.name,
      key: maskKey(k.key),
      isEnabled: k.isEnabled,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await findAccountById(session.accountId);
  if (!account?.linkedUserId) {
    return NextResponse.json({ error: "No user account linked" }, { status: 404 });
  }

  const body = (await request.json()) as { name?: string; expiresInDays?: number };
  const { name, expiresInDays } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Key name is required" }, { status: 400 });
  }

  const keyString = `sk-pool2api-${randomBytes(24).toString("hex")}`;

  const expiresAt =
    typeof expiresInDays === "number" && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86400 * 1000)
      : undefined;

  try {
    const key = await createKey({
      user_id: account.linkedUserId,
      key: keyString,
      name: name.trim(),
      expires_at: expiresAt ?? null,
      can_login_web_ui: false,
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: key.id,
        name: key.name,
        key: keyString, // return full key only at creation
        isEnabled: key.isEnabled,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      },
    });
  } catch (error) {
    logger.error("[Portal Keys] Create key failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}

function maskKey(key: string): string {
  if (key.length <= 12) return "***";
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}
