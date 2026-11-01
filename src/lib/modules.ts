import { isRecord } from "./input.ts";

/** The optional modules of spec/schema.md §12 (decision 0048), in contract order. */
export const MODULES = ["domains", "knowledge", "orgs", "documents", "reports", "tasks", "planning"] as const;

export type ModuleName = (typeof MODULES)[number];

export const MODULE_DEFAULTS: Readonly<Record<ModuleName, boolean>> = {
  domains: false,
  knowledge: true,
  orgs: true,
  documents: false,
  reports: false,
  tasks: false,
  planning: false,
};

/** The `notion.databases` keys each module owns. Reports and Tasks own none (Tasks uses `notion.tasks`). */
export const MODULE_DATABASES: Readonly<Record<ModuleName, readonly string[]>> = {
  domains: ["domains"],
  knowledge: ["decisions", "questions", "concepts"],
  orgs: ["orgs"],
  documents: ["documents"],
  reports: [],
  tasks: [],
  planning: ["goals", "key_results"],
};

const MODULE_FOR_TYPE: Readonly<Record<string, ModuleName>> = {
  domain: "domains",
  decision: "knowledge",
  question: "knowledge",
  concept: "knowledge",
  org: "orgs",
  reference: "documents",
  goal: "planning",
};

export function isModuleName(value: string): value is ModuleName {
  return (MODULES as readonly string[]).includes(value);
}

/** Which modules are on: every module except Domains when the block is absent, else each absent key at its default. */
export function modulesOf(config: Record<string, unknown>): Record<ModuleName, boolean> {
  const block = config.modules;
  if (!isRecord(block)) return Object.fromEntries(MODULES.map((name) => [name, name !== "domains"])) as Record<ModuleName, boolean>;
  return Object.fromEntries(MODULES.map((name) => [name, typeof block[name] === "boolean" ? block[name] : MODULE_DEFAULTS[name]])) as Record<ModuleName, boolean>;
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

/** The Notion pieces a module still lacks: its empty database ids, and `tasks` when the tasks database is unset. */
export function missingFor(config: Record<string, unknown>, module: ModuleName): string[] {
  const missing = MODULE_DATABASES[module].filter((key) => databaseId(config, key) === "");
  if (module === "tasks") {
    const notion = config.notion;
    const tasks = isRecord(notion) && isRecord(notion.tasks) ? notion.tasks : {};
    if (typeof tasks.database !== "string" || tasks.database === "") missing.push("tasks");
  }
  return missing;
}

/**
 * A copy of `config` with `block` as its `modules` block: in place when it has one, else after
 * `settings`, or after `budgets` when there is no `settings`, or at the end (spec/cli.md §5.15 step 5).
 */
export function withModules(config: Record<string, unknown>, block: Record<ModuleName, boolean>): Record<string, unknown> {
  const anchor = "modules" in config ? "modules" : "settings" in config ? "settings" : "budgets" in config ? "budgets" : null;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (key !== "modules") next[key] = value;
    if (key === anchor) next.modules = block;
  }
  if (anchor === null) next.modules = block;
  return next;
}
