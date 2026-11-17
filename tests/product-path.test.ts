import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { test } from "node:test";

import { brain, fixtureCopy, testPackageRoot } from "./helpers.ts";

// The packed install's product.path, its Notion build files and DOCUMENTS_TURNED_ON's migration path are checked by scripts/test-package.mjs.
test("status reports the installed package's folder as product.path (cli.md §5.2)", async (context) => {
  const root = await fixtureCopy(context);
  const result = await brain(["status", "--brain", root, "--json"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.product, { path: realpathSync(await testPackageRoot()) });
});
