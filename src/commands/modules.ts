import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { atomicWriteFile } from "../lib/fs-safe.ts";
import { appendLog } from "../lib/log.ts";
import { readFactories, withEveryRepo } from "../lib/factories.ts";
import { factoriesAsked, isModuleName, missingFor, MODULE_DATABASES, MODULE_DEFAULTS, MODULES, modulesOf, RETIRED_MODULE, storedBlock, storedModules, withModules, type ModuleName } from "../lib/modules.ts";
import { describeErrors, loadSchemas } from "../lib/schemas.ts";

/** `brain modules` (spec/cli.md §5.20). */
export const modulesListCommand: Command = {
  name: "modules",
  usage: "brain modules [--json]",
  summary: "List the optional modules, whether each is on, and the Notion pieces it still lacks.",
  options: {},
  maxPositionals: 0,
  needsBrain: true,
  async run({ brain }) {
    const on = modulesOf(brain!.config);
    const modules = MODULES.map((name) => ({ name, on: on[name], default: MODULE_DEFAULTS[name], databases: [...MODULE_DATABASES[name]], missing: missingFor(brain!.config, name), ...(name === "factories" ? { asked: factoriesAsked(brain!.config) } : {}) }));
    const human = modules.map((module) => `${module.on ? "on " : "off"} ${module.name}${module.on && module.missing.length > 0 ? ` (missing: ${module.missing.join(", ")})` : ""}\n`).join("");
    return { data: { modules }, human };
  },
};

export const modulesOnCommand = switchCommand(true);
export const modulesOffCommand = switchCommand(false);

function switchCommand(value: boolean): Command {
  const word = value ? "on" : "off";
  return {
    name: `modules ${word}`,
    usage: `brain modules ${word} <module> [--json]`,
    summary: `Switch an optional module ${word} in brain.json.`,
    options: {},
    maxPositionals: 1,
    needsBrain: true,
    async run({ args, brain, now, environment }) {
      const [name] = args.positionals;
      if (name === undefined) throw new BrainError("USAGE", `brain modules ${word} needs a module: ${MODULES.join(", ")}`);
      if (name === RETIRED_MODULE) throw new BrainError("USAGE", `The Knowledge module is retired in 0.16.0: decisions and questions now show on project and area pages, in their Brief and Decision log. Optional modules: ${MODULES.join(", ")}`);
      if (!isModuleName(name)) throw new BrainError("USAGE", `Unknown module: ${name}. Optional modules: ${MODULES.join(", ")} (core has no switch)`);
      const module: ModuleName = name;
      const config = brain!.config;
      const missing = missingFor(config, module);
      // Factories (0113 §1): turning it on also gives each linked repo its Factory, and a first "no" is kept, though it was off already.
      const made = module === "factories" && value ? withEveryRepo(config, await readFactories(brain!, undefined, environment.homeDirectory), environment.homeDirectory) : null;
      const firstNo = module === "factories" && !value && !factoriesAsked(config);
      if (modulesOf(config)[module] === value && !firstNo && (made === null || made.ids.length === 0)) {
        return { data: { module, on: value, changed: false, missing, ...(made === null ? {} : { factories: [] }) }, human: `${module} is already ${word}\n` };
      }

      // An absent block means every module but Domains and Factories is on (schema §12): write it out whole, then switch.
      // Reports needs Documents (0071): on reports turns Documents on, off documents turns Reports off.
      const stored = storedModules(config);
      const block = { ...storedBlock(config), [module]: value };
      const linked: ModuleName | null = module === "reports" && value ? "documents" : module === "documents" && !value ? "reports" : null;
      if (linked !== null) block[linked] = value;
      const also = linked !== null && stored[linked] !== value ? [{ module: linked, on: value }] : [];
      const next = { ...withModules(config, block), ...(made === null || made.ids.length === 0 ? {} : { factories: made.factories }) };
      const schemas = loadSchemas();
      if (!schemas.brain(next)) throw new BrainError("BRAIN_CONFIG_INVALID", `brain.json would be invalid: ${describeErrors(schemas.brain.errors).join("; ")}`);
      await atomicWriteFile(brain!.root, "brain.json", `${JSON.stringify(next, null, 2)}\n`);
      const logged = [module, ...also.map((entry) => entry.module)].filter((name) => stored[name] !== value || (name === module && (firstNo || made !== null)));
      await appendLog(brain!.root, now, logged.map((name) => ({ op: "modules", id: "-", title: name, pairs: [["state", word]] })));
      const alsoText = also.map((entry) => ` (${entry.module} ${word} too: reports are Documents)`).join("");
      return { data: { module, on: value, changed: true, missing, ...(also.length === 0 ? {} : { also }), ...(made === null ? {} : { factories: made.ids }) }, human: `${module}: ${word}${alsoText}${value && missing.length > 0 ? ` (Notion still needs: ${missing.join(", ")})` : ""}\n` };
    },
  };
}
