import { type NextRequest, NextResponse } from "next/server";
import { getEnvConfig } from "@/lib/config/env.schema";
import { logger } from "@/lib/logger";
import {
  createPortalSessionToken,
  hashPassword,
  setPortalAuthCookie,
} from "@/lib/auth/account-auth";
import { createAccount, findAccountByEmail, findAccountByInviteToken } from "@/repository/account";
import { createUser } from "@/repository/user";

export const runtime = "nodejs";

interface RegisterBody {
  email?: string;
  password?: string;
  inviteToken?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as RegisterBody;
    const { email, password, inviteToken } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const env = getEnvConfig();

    // Invite-only check
    if (env.PORTAL_INVITE_ONLY) {
      if (!inviteToken || typeof inviteToken !== "string") {
        return NextResponse.json(
          { error: "Registration requires an invite token" },
          { status: 403 }
        );
      }

      const tokenAccount = await findAccountByInviteToken(inviteToken);
      if (tokenAccount) {
        return NextResponse.json({ error: "Invite token already used" }, { status: 409 });
      }
    }

    const existing = await findAccountByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    // Create a matching user quota-slot for this account
    const user = await createUser({
      name: email.split("@")[0] ?? email,
      description: `Portal account: ${email}`,
    });

    const account = await createAccount({
      email,
      passwordHash,
      inviteToken: inviteToken ?? undefined,
      linkedUserId: user.id,
    });

    const token = createPortalSessionToken(account);
    await setPortalAuthCookie(token);

    return NextResponse.json({
      ok: true,
      account: { id: account.id, email: account.email, role: account.role },
    });
  } catch (error) {
    logger.error("[Portal Register] Error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
