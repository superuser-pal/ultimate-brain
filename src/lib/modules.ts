import { isRecord } from "./input.ts";

/** The optional modules of spec/schema.md §12 (decision 0048), in contract order. Knowledge is retired in 0.16.0 (0099): a stored key is never read. */
export const MODULES = ["domains", "orgs", "documents", "reports", "tasks", "planning", "factories"] as const;

/** The module retired in 0.16.0 (0099 §1): decisions and questions are always extracted and never published as rows. */
export const RETIRED_MODULE = "knowledge";

export type ModuleName = (typeof MODULES)[number];

export const MODULE_DEFAULTS: Readonly<Record<ModuleName, boolean>> = {
  domains: false,
  orgs: true,
  documents: false,
  reports: false,
  tasks: false,
  planning: false,
  factories: false,
};

/**
 * The `notion.databases` keys each module uses. Reports shares Documents (a report is a Documents row, 0071);
 * `moduleForDatabase` still names Documents for it. Tasks owns none (it uses `notion.tasks`).
 */
export const MODULE_DATABASES: Readonly<Record<ModuleName, readonly string[]>> = {
  domains: ["domains"],
  orgs: ["orgs"],
  documents: ["documents"],
  reports: ["documents"],
  tasks: [],
  planning: ["goals", "key_results"],
  factories: ["factories"],
};

const MODULE_FOR_TYPE: Readonly<Record<string, ModuleName>> = {
  domain: "domains",
  org: "orgs",
  reference: "documents",
  goal: "planning",
};

export function isModuleName(value: string): value is ModuleName {
  return (MODULES as readonly string[]).includes(value);
}

/** The switches as `brain.json` stores them: every module except Domains and Factories when the block is absent, else each absent key at its default. */
export function storedModules(config: Record<string, unknown>): Record<ModuleName, boolean> {
  const block = config.modules;
  if (!isRecord(block)) return Object.fromEntries(MODULES.map((name) => [name, name !== "domains" && name !== "factories"])) as Record<ModuleName, boolean>;
  return Object.fromEntries(MODULES.map((name) => [name, typeof block[name] === "boolean" ? block[name] : MODULE_DEFAULTS[name]])) as Record<ModuleName, boolean>;
}

/** Whether Factories was ever answered: its key is written only by a switch, so an absent one means "never asked" (schema §12, 0113 §1). */
export function factoriesAsked(config: Record<string, unknown>): boolean {
  return isRecord(config.modules) && typeof config.modules.factories === "boolean";
}

/** The stored switches as a block to write back: the same, without `factories` while it was never asked (cli.md §5.15 step 5, §5.20). */
export function storedBlock(config: Record<string, unknown>): Partial<Record<ModuleName, boolean>> {
  const { factories, ...rest } = storedModules(config);
  return factoriesAsked(config) ? { ...rest, factories } : rest;
}

/** Which modules are on: the stored switches, with Reports off while Documents is off (schema §12, 0071). */
export function modulesOf(config: Record<string, unknown>): Record<ModuleName, boolean> {
  const stored = storedModules(config);
  return { ...stored, reports: stored.reports && stored.documents };
}

/** The module a note type belongs to, or null for a core type (or one that is never published). */
export function moduleForType(type: string): ModuleName | null {
  return MODULE_FOR_TYPE[type] ?? null;
}

/** The module a `notion.databases` key belongs to, or null for a core database. */
export function moduleForDatabase(key: string): ModuleName | null {
  const name = MODULES.find((module) => MODULE_DATABASES[module].includes(key));
  return name ?? null;
}

/** Whether rows of this note type are published and taken in. */
export function typeIsOn(config: Record<string, unknown>, type: string): boolean {
  const module = moduleForType(type);
  return module === null || modulesOf(config)[module];
}

/**
 * Read a `notion.databases` id, accepting the keys renamed by `brain upgrade`: `inbox` was
 * `capture_inbox` and `documents` was `references` (schema §12, 0049). Empty string when unset.
 */
export function databaseId(config: Record<string, unknown>, key: string): string {
  const notion = config.notion;
  const databases = isRecord(notion) && isRecord(notion.databases) ? notion.databases : {};
  const legacy = key === "inbox" ? "capture_inbox" : key === "documents" ? "references" : null;
  const value = databases[key] === undefined && legacy !== null ? databases[legacy] : databases[key];
  return typeof value === "string" ? value : "";
}

/** How `missing` names the Factory relation of the Tasks database: a property, not a database (cli.md §5.20). */
export const TASKS_FACTORY = "tasks.factory";

/** The Tasks database's Factory relation, `notion.tasks.properties.factory` (0113 §3); "" when unmapped. */
export function taskFactoryProperty(config: Record<string, unknown>): string {
  const tasks = isRecord(config.notion) && isRecord(config.notion.tasks) ? config.notion.tasks : {};
  const value = isRecord(tasks.properties) ? tasks.properties.factory : undefined;
  return typeof value === "string" ? value : "";
}

/** The Notion pieces a module still lacks: its empty database ids, `tasks` when the tasks database is unset, and Factories' relation on Tasks. */
export function missingFor(config: Record<string, unknown>, module: ModuleName): string[] {
  const missing = MODULE_DATABASES[module].filter((key) => databaseId(config, key) === "");
  const notion = config.notion;
  const tasks = isRecord(notion) && isRecord(notion.tasks) ? notion.tasks : {};
  if (module === "tasks" && (typeof tasks.database !== "string" || tasks.database === "")) missing.push("tasks");
  if (module === "factories" && modulesOf(config).tasks && taskFactoryProperty(config) === "") missing.push(TASKS_FACTORY);
  return missing;
}

/**
 * A copy of `config` with `block` as its `modules` block: in place when it has one, else after
 * `settings`, or after `budgets` when there is no `settings`, or at the end (spec/cli.md §5.15 step 5).
 */
export function withModules(config: Record<string, unknown>, block: Partial<Record<ModuleName, boolean>>): Record<string, unknown> {
  const anchor = "modules" in config ? "modules" : "settings" in config ? "settings" : "budgets" in config ? "budgets" : null;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (key !== "modules") next[key] = value;
    if (key === anchor) next.modules = block;
  }
  if (anchor === null) next.modules = block;
  return next;
}
