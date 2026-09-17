import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getEnvConfig } from "@/lib/config/env.schema";
import { logger } from "@/lib/logger";
import type { Account } from "@/repository/account";
import { PORTAL_COOKIE_NAME } from "./portal-cookie";

export { PORTAL_COOKIE_NAME } from "./portal-cookie";
const BCRYPT_ROUNDS = 12;
const TOKEN_VERSION = 1;

export interface PortalSession {
  accountId: number;
  email: string;
  role: "user" | "admin";
}

interface PortalTokenPayload extends PortalSession {
  v: number;
  iat: number;
  exp: number;
}

function getSecret(): string {
  const env = getEnvConfig();
  return `portal:${env.PORTAL_JWT_SECRET ?? env.ADMIN_TOKEN}`;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createPortalSessionToken(account: Account): string {
  const env = getEnvConfig();
  const ttl = env.PORTAL_SESSION_TTL_SECONDS ?? 604800;
  const now = Math.floor(Date.now() / 1000);

  const payload: PortalTokenPayload = {
    v: TOKEN_VERSION,
    accountId: account.id,
    email: account.email,
    role: account.role,
    iat: now,
    exp: now + ttl,
  };

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(`${header}.${body}`, getSecret());

  return `${header}.${body}.${sig}`;
}

export function verifyPortalSessionToken(token: string): PortalSession | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts as [string, string, string];
    const expectedSig = sign(`${header}.${body}`, getSecret());

    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as PortalTokenPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (payload.v !== TOKEN_VERSION) return null;
    if (typeof payload.accountId !== "number") return null;
    if (typeof payload.email !== "string") return null;
    if (payload.role !== "user" && payload.role !== "admin") return null;

    return { accountId: payload.accountId, email: payload.email, role: payload.role };
  } catch (error) {
    logger.debug("[PortalAuth] Failed to verify portal session token", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function setPortalAuthCookie(token: string): Promise<void> {
  const env = getEnvConfig();
  const ttl = env.PORTAL_SESSION_TTL_SECONDS ?? 604800;
  const cookieStore = await cookies();
  cookieStore.set(PORTAL_COOKIE_NAME, token, {
    httpOnly: true,
    // Follow the same switch as the admin cookie (src/lib/auth.ts). Keying this
    // off NODE_ENV instead would mark the cookie Secure on any production
    // build, and a browser served over plain HTTP silently drops it, leaving
    // the user stuck on the sign-in screen.
    secure: env.ENABLE_SECURE_COOKIES,
    sameSite: "lax",
    maxAge: ttl,
    path: "/",
  });
}

export async function clearPortalAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PORTAL_COOKIE_NAME);
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyPortalSessionToken(token);
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}
