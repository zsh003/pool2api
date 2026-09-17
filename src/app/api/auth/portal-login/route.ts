import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  clearPortalAuthCookie,
  createPortalSessionToken,
  setPortalAuthCookie,
  verifyPassword,
} from "@/lib/auth/account-auth";
import { findAccountByEmail } from "@/repository/account";

export const runtime = "nodejs";

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as LoginBody;
    const { email, password } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const account = await findAccountByEmail(email);
    if (!account) {
      // Constant-time response to avoid email enumeration
      await new Promise((r) => setTimeout(r, 200));
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!account.isEnabled) {
      return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
    }

    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = createPortalSessionToken(account);
    await setPortalAuthCookie(token);

    return NextResponse.json({
      ok: true,
      account: { id: account.id, email: account.email, role: account.role },
    });
  } catch (error) {
    logger.error("[Portal Login] Error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest): Promise<NextResponse> {
  await clearPortalAuthCookie();
  return NextResponse.json({ ok: true });
}
