// A temporary checkout for CC-204's comparison: this repo's tracked files as they are in the working tree, with
// compare/query-variant.ts as src/lib/query.ts and compare/vocabulary.ts beside it. The variant is chosen per run by
// UB_RETRIEVAL_VARIANT, so one checkout serves every variant. Never part of the product; src/ itself is not changed.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const product = join(here, "../../..");

/** Builds the checkout and returns its folder. */
export function variantCheckout() {
  const root = mkdtempSync(join(tmpdir(), "ub-cc204-variant-"));
  const files = execFileSync("git", ["-C", product, "ls-files", "-z", "--", "src", "eval", "package.json", ".agents", "templates", "spec"], { encoding: "utf8" })
    .split("\0").filter(Boolean);
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(join(product, file), join(root, file));
  }
  symlinkSync(join(product, "node_modules"), join(root, "node_modules"));
  copyFileSync(join(here, "query-variant.ts"), join(root, "src/lib/query.ts"));
  copyFileSync(join(here, "vocabulary.ts"), join(root, "src/lib/vocabulary.ts"));
  return root;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(variantCheckout());
