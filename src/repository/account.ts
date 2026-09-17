"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { accounts } from "@/drizzle/schema";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type Account = InferSelectModel<typeof accounts>;
export type CreateAccountData = {
  email: string;
  passwordHash: string;
  role?: "user" | "admin";
  inviteToken?: string;
  linkedUserId?: number;
};

export async function findAccountByEmail(email: string): Promise<Account | undefined> {
  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email.toLowerCase().trim()))
    .limit(1);
  return rows[0];
}

export async function findAccountById(id: number): Promise<Account | undefined> {
  const rows = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return rows[0];
}

export async function createAccount(data: CreateAccountData): Promise<Account> {
  const rows = await db
    .insert(accounts)
    .values({
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      role: data.role ?? "user",
      inviteToken: data.inviteToken,
      linkedUserId: data.linkedUserId,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Failed to create account");
  return row;
}

export async function updateAccountLinkedUser(
  accountId: number,
  linkedUserId: number
): Promise<void> {
  await db
    .update(accounts)
    .set({ linkedUserId, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));
}

export async function findAccountByInviteToken(token: string): Promise<Account | undefined> {
  const rows = await db.select().from(accounts).where(eq(accounts.inviteToken, token)).limit(1);
  return rows[0];
}
