// A temporary checkout for CC-204's comparison: this repo's tracked files as they are in the working tree, with
// compare/query-variant.ts as src/lib/query.ts and compare/vocabulary.ts beside it. The variant is chosen per run by
// UB_RETRIEVAL_VARIANT, so one checkout serves every variant. Never part of the product; src/ itself is not changed.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const product = join(here, "../../..");

/** Builds the checkout and returns its folder. */
export function variantCheckout() {
  const root = mkdtempSync(join(tmpdir(), "ub-cc204-variant-"));
  const files = execFileSync("git", ["-C", product, "ls-files", "-z", "--", "src", "eval", "package.json", "tsconfig.json", ".agents", "templates", "spec"], { encoding: "utf8" })
    .split("\0").filter(Boolean);
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(join(product, file), join(root, file));
  }
  symlinkSync(join(product, "node_modules"), join(root, "node_modules"));
  copyFileSync(join(here, "query-variant.ts"), join(root, "src/lib/query.ts"));
  copyFileSync(join(here, "vocabulary.ts"), join(root, "src/lib/vocabulary.ts"));
  // A repository of its own, so score.mjs can name its commit; the message names the commit it was copied from.
  const head = execFileSync("git", ["-C", product, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const git = (...args) => execFileSync("git", ["-C", root, "-c", "user.name=variant-checkout", "-c", "user.email=variant-checkout@localhost", ...args], { encoding: "utf8" });
  git("init", "-q");
  writeFileSync(join(root, ".git/info/exclude"), "node_modules\n");
  git("add", "-A");
  git("commit", "-q", "--no-verify", "-m", `variant checkout of ${head}`);
  return root;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(variantCheckout());
