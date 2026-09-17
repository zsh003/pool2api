import { type NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/auth/account-auth";
import { logger } from "@/lib/logger";
import { findAccountById } from "@/repository/account";
import { deleteKey, findKeyById } from "@/repository/key";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const keyId = Number(id);
  if (!Number.isFinite(keyId) || keyId <= 0) {
    return NextResponse.json({ error: "Invalid key ID" }, { status: 400 });
  }

  const account = await findAccountById(session.accountId);
  if (!account?.linkedUserId) {
    return NextResponse.json({ error: "No user account linked" }, { status: 404 });
  }

  // Verify the key belongs to this account's linked user
  const key = await findKeyById(keyId);
  if (!key) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  if (key.userId !== account.linkedUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteKey(keyId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[Portal Keys] Delete key failed", {
      keyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
  }
}
