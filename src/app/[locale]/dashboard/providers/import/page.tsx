import { redirect } from "@/i18n/routing";
import { getSession } from "@/lib/auth";
import CcSwitchImportClient from "./_components/cc-switch-import-client";

export const dynamic = "force-dynamic";

export default async function CcSwitchImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const session = await getSession();
  if (session?.user.role !== "admin") {
    redirect({ href: session ? "/dashboard" : "/login", locale });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import from cc-switch</h1>
        <p className="mt-2 text-muted-foreground">
          Import provider configurations from your local cc-switch database (
          <code className="font-mono text-sm">~/.cc-switch/cc-switch.db</code>). Claude and Codex
          providers are supported. Already-imported providers are skipped automatically.
        </p>
      </div>

      <CcSwitchImportClient />
    </div>
  );
}
