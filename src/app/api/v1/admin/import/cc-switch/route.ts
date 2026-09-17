import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEnvConfig } from "@/lib/config/env.schema";
import { logger } from "@/lib/logger";
import { createProvider } from "@/repository/provider";
import { db } from "@/drizzle/db";
import { providers } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

interface CcSwitchProvider {
  id: string;
  app_type: string;
  name: string;
  settings_config: string;
  category: string | null;
  url: string | null;
}

interface ParsedProvider {
  importId: string;
  appType: string;
  name: string;
  url: string;
  apiKey: string;
  providerType: "claude" | "codex" | "openai-compatible";
}

function parseClaudeProvider(row: CcSwitchProvider): ParsedProvider | null {
  try {
    const config = JSON.parse(row.settings_config) as {
      env?: Record<string, string>;
      apiKey?: string;
    };
    const env = config.env ?? {};
    const baseUrl = env.ANTHROPIC_BASE_URL ?? row.url ?? "";
    const apiKey = env.ANTHROPIC_AUTH_TOKEN ?? config.apiKey ?? "";

    if (!baseUrl || !apiKey) return null;

    return {
      importId: row.id,
      appType: row.app_type,
      name: row.name,
      url: baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`,
      apiKey,
      providerType: "claude",
    };
  } catch {
    return null;
  }
}

function parseCodexProvider(row: CcSwitchProvider): ParsedProvider | null {
  try {
    const config = JSON.parse(row.settings_config) as {
      auth?: Record<string, string>;
      config?: string;
    };

    const apiKey = config.auth?.OPENAI_API_KEY ?? "";

    // Extract base_url from TOML config string
    let baseUrl = row.url ?? "";
    if (config.config) {
      const baseUrlMatch = config.config.match(/base_url\s*=\s*"([^"]+)"/);
      if (baseUrlMatch?.[1]) {
        baseUrl = baseUrlMatch[1];
      }
    }

    if (!baseUrl || !apiKey) return null;

    return {
      importId: row.id,
      appType: row.app_type,
      name: row.name,
      url: baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`,
      apiKey,
      providerType: "openai-compatible",
    };
  } catch {
    return null;
  }
}

async function loadCcSwitchProviders(dbPath: string): Promise<ParsedProvider[]> {
  // Dynamic import to avoid bundling better-sqlite3 into the browser build
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });

  try {
    const rows = db
      .prepare(
        `SELECT p.id, p.app_type, p.name, p.settings_config, p.category,
                e.url
         FROM providers p
         LEFT JOIN provider_endpoints e ON p.id = e.provider_id AND p.app_type = e.app_type
         WHERE p.app_type IN ('claude', 'codex')
           AND p.category != 'official'`
      )
      .all() as CcSwitchProvider[];

    const result: ParsedProvider[] = [];
    for (const row of rows) {
      const parsed = row.app_type === "claude" ? parseClaudeProvider(row) : parseCodexProvider(row);
      if (parsed) result.push(parsed);
    }
    return result;
  } finally {
    db.close();
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (session?.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const env = getEnvConfig();
  const dbPath = env.CC_SWITCH_DB_PATH || `${process.env.HOME}/.cc-switch/cc-switch.db`;

  if (!dbPath) {
    return NextResponse.json({ error: "CC_SWITCH_DB_PATH not configured" }, { status: 400 });
  }

  try {
    const parsed = await loadCcSwitchProviders(dbPath);

    // Check which have already been imported
    const existingRows = await db
      .select({ poolImportId: providers.poolImportId })
      .from(providers)
      .where(eq(providers.poolSource, "cc_switch_import"));

    const importedIds = new Set(existingRows.map((r) => r.poolImportId).filter(Boolean));

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dry_run") === "true";

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      total: parsed.length,
      already_imported: importedIds.size,
      pending: parsed.filter((p) => !importedIds.has(p.importId)).length,
      providers: parsed.map((p) => ({
        importId: p.importId,
        name: p.name,
        appType: p.appType,
        providerType: p.providerType,
        url: p.url,
        alreadyImported: importedIds.has(p.importId),
      })),
    });
  } catch (error) {
    logger.error("[CC-Switch Import] Failed to load providers", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: `Failed to read cc-switch database: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (session?.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const env = getEnvConfig();
  const dbPath = env.CC_SWITCH_DB_PATH || `${process.env.HOME}/.cc-switch/cc-switch.db`;

  const body = (await request.json()) as { importIds?: string[]; importAll?: boolean };
  const { importIds, importAll } = body;

  try {
    const parsed = await loadCcSwitchProviders(dbPath);

    // Check existing imports for idempotency
    const existingRows = await db
      .select({ poolImportId: providers.poolImportId })
      .from(providers)
      .where(eq(providers.poolSource, "cc_switch_import"));
    const importedIds = new Set(existingRows.map((r) => r.poolImportId).filter(Boolean));

    const toImport = parsed.filter((p) => {
      if (importedIds.has(p.importId)) return false;
      if (importAll) return true;
      return importIds?.includes(p.importId) ?? false;
    });

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const p of toImport) {
      try {
        await createProvider({
          name: p.name,
          url: p.url,
          key: p.apiKey,
          provider_type: p.providerType,
          tpm: null,
          rpm: null,
          rpd: null,
          cc: null,
          // Pool metadata stored via direct db update after create
        });

        // Update the pool metadata fields that createProvider doesn't expose
        await db
          .update(providers)
          .set({
            poolLabel: p.name,
            poolSource: "cc_switch_import",
            poolImportId: p.importId,
          })
          .where(eq(providers.poolImportId, p.importId));

        // Use name+url as a lookup since poolImportId was just set
        // Re-find the newly created provider by name and url to set pool fields
        const newProviders = await db
          .select({ id: providers.id })
          .from(providers)
          .where(eq(providers.name, p.name))
          .orderBy(providers.id)
          .limit(1);

        if (newProviders[0]) {
          await db
            .update(providers)
            .set({
              poolLabel: p.name,
              poolSource: "cc_switch_import",
              poolImportId: p.importId,
            })
            .where(eq(providers.id, newProviders[0].id));
        }

        results.push({ name: p.name, success: true });
      } catch (err) {
        logger.error("[CC-Switch Import] Failed to import provider", {
          name: p.name,
          error: err instanceof Error ? err.message : String(err),
        });
        results.push({
          name: p.name,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      imported: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    logger.error("[CC-Switch Import] Error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: `Import failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
