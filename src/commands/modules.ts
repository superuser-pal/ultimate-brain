import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { atomicWriteFile } from "../lib/fs-safe.ts";
import { appendLog } from "../lib/log.ts";
import { isModuleName, missingFor, MODULE_DATABASES, MODULE_DEFAULTS, MODULES, modulesOf, withModules, type ModuleName } from "../lib/modules.ts";
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
    const modules = MODULES.map((name) => ({ name, on: on[name], default: MODULE_DEFAULTS[name], databases: [...MODULE_DATABASES[name]], missing: missingFor(brain!.config, name) }));
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
    async run({ args, brain, now }) {
      const [name] = args.positionals;
      if (name === undefined) throw new BrainError("USAGE", `brain modules ${word} needs a module: ${MODULES.join(", ")}`);
      if (!isModuleName(name)) throw new BrainError("USAGE", `Unknown module: ${name}. Optional modules: ${MODULES.join(", ")} (core has no switch)`);
      const module: ModuleName = name;
      const config = brain!.config;
      const missing = missingFor(config, module);
      if (modulesOf(config)[module] === value) {
        return { data: { module, on: value, changed: false, missing }, human: `${module} is already ${word}\n` };
      }

      // An absent block means every module is on (schema §12): write it out whole, then switch.
      const next = withModules(config, { ...modulesOf(config), [module]: value });
      const schemas = loadSchemas();
      if (!schemas.brain(next)) throw new BrainError("BRAIN_CONFIG_INVALID", `brain.json would be invalid: ${describeErrors(schemas.brain.errors).join("; ")}`);
      await atomicWriteFile(brain!.root, "brain.json", `${JSON.stringify(next, null, 2)}\n`);
      await appendLog(brain!.root, now, [{ op: "modules", id: "-", title: module, pairs: [["state", word]] }]);
      return { data: { module, on: value, changed: true, missing }, human: `${module}: ${word}${value && missing.length > 0 ? ` (Notion still needs: ${missing.join(", ")})` : ""}\n` };
    },
  };
}
