import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { isRecord } from "./input.ts";

const MIGRATION = /^([0-9]{4})-.+\.md$/;

export interface NotionMigrations {
  /** `notion.template_version`, or null when absent (unknown, spec/setup.md §9). */
  template_version: string | null;
  /** The package's migration file names with a higher number, sorted; null when the version is unknown. */
  newer: string[] | null;
}

/**
 * The Notion migrations of the installed package newer than the brain's template version (spec/cli.md §5.15,
 * spec/setup.md §9). Read only: upgrade never writes the version.
 */
export async function notionMigrations(productRoot: string, config: Record<string, unknown>): Promise<NotionMigrations> {
  const notion = isRecord(config.notion) ? config.notion : {};
  const version = typeof notion.template_version === "string" ? notion.template_version : null;
  if (version === null) return { template_version: null, newer: null };
  let files: string[];
  try {
    files = await readdir(join(productRoot, "notion", "migrations"));
  } catch {
    files = [];
  }
  const newer = files.filter((file) => {
    const number = MIGRATION.exec(file)?.[1];
    return number !== undefined && Number(number) > Number(version);
  });
  return { template_version: version, newer: newer.sort() };
}

/** Upgrade's human line about them (spec/cli.md §5.15), with full paths under the installed package. */
export function notionMigrationsLine(productRoot: string, migrations: NotionMigrations): string {
  const folder = join(productRoot, "notion", "migrations");
  if (migrations.newer === null) {
    return `Notion: template version unknown, so upgrade can't tell which migrations your space needs; ask your agent which ones apply (${folder}/).`;
  }
  if (migrations.newer.length === 0) return `Notion: your space has every migration (template ${migrations.template_version}).`;
  const count = migrations.newer.length === 1 ? "1 migration" : `${migrations.newer.length} migrations`;
  return `Notion: ${count} newer than your space: ${migrations.newer.map((file) => join(folder, file)).join(", ")}. Ask your agent to apply them ("apply the Notion migrations").`;
}
