import type { ReactNode } from "react";
import { redirect } from "@/i18n/routing";
import { getPortalSession } from "@/lib/auth/account-auth";

export default async function PortalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getPortalSession();

  // Allow login and register pages without auth
  // Auth check is done per-page for protected routes
  void session;
  void locale;

  return (
    <div className="min-h-[var(--cch-viewport-height,100vh)] bg-background">
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
