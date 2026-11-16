import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { isRecord } from "./input.ts";

const MIGRATION = /^([0-9]{4})-.+\.md$/;

/** 0.16.0's one Notion migration: it applies the Review decisions and archives Review, Decisions and Questions (spec/cli.md §5.15). */
export const MIGRATION_0_16_0 = "0027-one-place-to-decide.md";

export interface NotionMigrations {
  /** `notion.template_version`, or null when absent (unknown, spec/setup.md §9). */
  template_version: string | null;
  /** The package's migration file names with a higher number, sorted; null when the version is unknown. */
  newer: string[] | null;
  /** Whether `brain.json` still names the Review database: the 0.16.0 migration has not run (spec/cli.md §5.15, 0096 §6). */
  review_database: boolean;
  /** Whether `brain.json` still names the Decisions or Questions database: the 0.16.0 migration has not run (spec/cli.md §5.15, 0099 §8). */
  knowledge_databases: boolean;
}

/**
 * The Notion migrations of the installed package newer than the brain's template version (spec/cli.md §5.15,
 * spec/setup.md §9). Read only: upgrade never writes the version.
 */
export async function notionMigrations(productRoot: string, config: Record<string, unknown>): Promise<NotionMigrations> {
  const notion = isRecord(config.notion) ? config.notion : {};
  const version = typeof notion.template_version === "string" ? notion.template_version : null;
  const databases = isRecord(notion.databases) ? notion.databases : {};
  const review = Object.hasOwn(databases, "review");
  const knowledge = Object.hasOwn(databases, "decisions") || Object.hasOwn(databases, "questions");
  if (version === null) return { template_version: null, newer: null, review_database: review, knowledge_databases: knowledge };
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
  return { template_version: version, newer: newer.sort(), review_database: review, knowledge_databases: knowledge };
}

/** Upgrade's human lines about them (spec/cli.md §5.15), with full paths under the installed package. */
export function notionMigrationsLine(productRoot: string, migrations: NotionMigrations): string {
  const lines = [newerLine(productRoot, migrations)];
  const migration = join(productRoot, "notion", "migrations", MIGRATION_0_16_0);
  if (migrations.review_database) {
    lines.push(`Notion: your space still has the Review database. Ask your agent to apply the 0.16.0 Notion migration (${migration}): it reads the Review rows once, applies what you decided there, and archives the database.`);
  }
  if (migrations.knowledge_databases) {
    lines.push(`Notion: your space still has the Decisions and Questions databases. Ask your agent to apply the 0.16.0 Notion migration (${migration}): it reads back the Status you set on questions, then archives both databases.`);
  }
  return lines.join("\n");
}

function newerLine(productRoot: string, migrations: NotionMigrations): string {
  const folder = join(productRoot, "notion", "migrations");
  if (migrations.newer === null) {
    return `Notion: template version unknown, so upgrade can't tell which migrations your space needs; ask your agent which ones apply (${folder}/).`;
  }
  if (migrations.newer.length === 0) return `Notion: your space has every migration (template ${migrations.template_version}).`;
  const count = migrations.newer.length === 1 ? "1 migration" : `${migrations.newer.length} migrations`;
  return `Notion: ${count} newer than your space: ${migrations.newer.map((file) => join(folder, file)).join(", ")}. Ask your agent to apply them ("apply the Notion migrations").`;
}
